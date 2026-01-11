use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::{sync::Arc, time::Instant};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tracing::{error, info, warn};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    db::{Database, Video},
    error::AppError,
    filestore::FileStore,
    session_store::SessionStore,
};

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UploadResponse {
    pub id: String,
    pub message: String,
}

pub struct AppState {
    pub db: Database,
    pub filestore: Arc<dyn FileStore>,
    pub session_store: Arc<dyn SessionStore>,
}

/// Process MP4 video to optimize for streaming (move moov atom to beginning)
/// Uses ffmpeg with -movflags +faststart to reorganize the file
/// Works with any FileStore implementation by using temp files
async fn process_video_for_streaming(
    filestore: &Arc<dyn FileStore>,
    file_id: &str,
) -> Result<(), AppError> {
    // Only process MP4 files
    if !file_id.ends_with(".mp4") && !file_id.ends_with(".MP4") {
        info!(file_id = file_id, "Skipping video processing for non-MP4 file");
        return Ok(());
    }

    let process_start = Instant::now();

    info!(file_id = file_id, "Starting video processing with ffmpeg");

    // Step 1: Download file from FileStore to temp file
    let temp_input = format!("/tmp/ffmpeg_input_{}.mp4", Uuid::new_v4());
    let temp_output = format!("/tmp/ffmpeg_output_{}.mp4", Uuid::new_v4());

    info!(file_id = file_id, "Step 1: Downloading file from FileStore");
    let file_data = filestore.get_file(file_id).await
        .map_err(|e| {
            error!(error = %e, file_id = file_id, "Failed to get file from filestore");
            AppError::Internal(format!("Failed to get file: {}", e))
        })?;

    let original_size = file_data.len();
    info!(file_id = file_id, size_mb = original_size / 1024 / 1024, "Downloaded file from FileStore");

    info!(file_id = file_id, temp_path = %temp_input, "Writing to temp input file");
    tokio::fs::write(&temp_input, &file_data).await
        .map_err(|e| {
            error!(error = %e, file_id = file_id, "Failed to write temp input file");
            AppError::Internal(format!("Failed to write temp file: {}", e))
        })?;
    info!(file_id = file_id, "Temp input file written successfully");

    // Step 2: Run ffmpeg to reorganize MP4 with faststart flag
    // -i: input file
    // -movflags +faststart: move moov atom to beginning for fast seeking
    // -c copy: copy streams without re-encoding (fast)
    // -f mp4: explicitly specify output format
    let output = Command::new("ffmpeg")
        .args(&[
            "-i", &temp_input,
            "-movflags", "+faststart",
            "-c", "copy",
            "-f", "mp4",
            "-y", // Overwrite output file if exists
            &temp_output,
        ])
        .output()
        .await
        .map_err(|e| {
            error!(error = %e, file_id = file_id, "Failed to execute ffmpeg");
            let _ = tokio::fs::remove_file(&temp_input);
            AppError::Internal(format!("Video processing failed: {}", e))
        })?;

    // Clean up input temp file
    let _ = tokio::fs::remove_file(&temp_input).await;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        warn!(
            file_id = file_id,
            exit_code = ?output.status.code(),
            stderr = %stderr,
            "ffmpeg processing failed, keeping original file"
        );
        // Clean up output temp file if it exists
        let _ = tokio::fs::remove_file(&temp_output).await;
        return Ok(()); // Don't fail upload, just skip processing
    }

    info!(file_id = file_id, "ffmpeg processing succeeded, reading output file");

    // Step 3: Read processed file and save back to FileStore
    let processed_data = tokio::fs::read(&temp_output).await
        .map_err(|e| {
            error!(error = %e, file_id = file_id, "Failed to read processed file");
            let _ = tokio::fs::remove_file(&temp_output);
            AppError::Internal(format!("Failed to read processed file: {}", e))
        })?;

    // Clean up output temp file
    let _ = tokio::fs::remove_file(&temp_output).await;

    // Delete old file and save new processed version
    filestore.delete_file(file_id).await
        .map_err(|e| {
            error!(error = %e, file_id = file_id, "Failed to delete original file");
            AppError::Internal(format!("Failed to delete original: {}", e))
        })?;

    // Save processed file back to filestore
    let reader: Box<dyn tokio::io::AsyncRead + Unpin + Send> = Box::new(std::io::Cursor::new(processed_data));
    filestore.save_file(file_id, reader).await
        .map_err(|e| {
            error!(error = %e, file_id = file_id, "Failed to save processed file");
            AppError::Internal(format!("Failed to save processed file: {}", e))
        })?;

    let process_duration = process_start.elapsed();
    info!(
        file_id = file_id,
        duration_ms = process_duration.as_millis(),
        "Video processing completed successfully"
    );

    Ok(())
}

/// Handle video upload
#[utoipa::path(
    post,
    path = "/api/videos/upload",
    request_body(content_type = "multipart/form-data"),
    responses(
        (status = 200, description = "Video uploaded successfully", body = UploadResponse),
        (status = 400, description = "Bad request - missing video file or invalid data"),
        (status = 401, description = "Unauthorized - authentication required"),
        (status = 500, description = "Internal server error - failed to save file or database error")
    ),
    tag = "videos"
)]
pub async fn upload_video(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    let upload_start = Instant::now();

    // Process multipart fields
    while let Some(mut field) = multipart.next_field().await.map_err(|e| {
        warn!(error = %e, "Failed to read multipart field");
        AppError::BadRequest(format!("Failed to read multipart: {}", e))
    })? {
        let name = field.name().unwrap_or("").to_string();

        if name == "video" {
            // Get original filename
            let original_filename = field.file_name().ok_or_else(|| {
                warn!("No filename provided in multipart upload");
                AppError::BadRequest("No filename provided".to_string())
            })?.to_string();

            // Determine file extension from original filename
            let extension = std::path::Path::new(&original_filename)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("mp4");

            // Generate UUID for this video
            let video_id = Uuid::new_v4().to_string();

            // Create file path for storage: {video_id}.{extension}
            let file_path = format!("{}.{}", video_id, extension);

            info!(
                video_id = %video_id,
                filename = %original_filename,
                extension = %extension,
                "Starting video upload"
            );

            // Create a duplex pipe for streaming
            let (mut writer, reader) = tokio::io::duplex(8192); // 8KB buffer

            // Clone state for async task
            let filestore = state.filestore.clone();
            let file_path_clone = file_path.clone();

            // Spawn task to save file (consuming reader end of pipe)
            let save_handle = tokio::spawn(async move {
                filestore.save_file(&file_path_clone, Box::new(reader)).await
            });

            // Stream field chunks to writer end of pipe
            let mut total_bytes = 0u64;
            let mut chunk_count = 0usize;

            while let Some(chunk) = field.chunk().await.map_err(|e| {
                error!(error = %e, "Failed to read chunk from multipart field");
                AppError::BadRequest(format!("Failed to read chunk: {}", e))
            })? {
                let chunk_size = chunk.len();
                total_bytes += chunk_size as u64;
                chunk_count += 1;

                writer.write_all(&chunk).await.map_err(|e| {
                    error!(error = %e, bytes_received = total_bytes, "Failed to write chunk to pipe");
                    AppError::Internal(format!("Failed to write chunk: {}", e))
                })?;

                // Log progress every 100MB
                if total_bytes % (100 * 1024 * 1024) < chunk_size as u64 {
                    info!(
                        video_id = %video_id,
                        bytes_received = total_bytes,
                        chunks = chunk_count,
                        "Upload progress"
                    );
                }
            }

            // Close writer to signal EOF
            drop(writer);

            info!(
                video_id = %video_id,
                total_bytes = total_bytes,
                total_chunks = chunk_count,
                "Streaming complete, waiting for file save"
            );

            // Wait for save to complete
            save_handle.await.map_err(|e| {
                error!(error = %e, video_id = %video_id, "Save task panicked");
                AppError::Internal(format!("Save task failed: {}", e))
            })?
            .map_err(|e| {
                error!(error = %e, video_id = %video_id, total_bytes, "File save failed");
                AppError::BadRequest(format!("Upload failed: {}", e))
            })?;

            // Process video to optimize for streaming (move moov atom to beginning)
            // This works with any FileStore implementation (local, S3, etc.)
            process_video_for_streaming(&state.filestore, &file_path).await?;

            // Create video record with the same UUID used for file path
            let video = Video {
                id: video_id.clone(),
                file_path: file_path.clone(),
                original_filename: original_filename.clone(),
                user_id: auth_user.user_id.clone(),
                uploaded_at: chrono::Utc::now(),
            };

            // Save video metadata to database
            state.db.insert_video(&video).await?;

            let upload_duration = upload_start.elapsed();
            let throughput_mbps = if upload_duration.as_secs_f64() > 0.0 {
                (total_bytes as f64 / 1_024_000.0) / upload_duration.as_secs_f64()
            } else {
                0.0
            };

            info!(
                video_id = %video_id,
                filename = %original_filename,
                size_bytes = total_bytes,
                size_mb = total_bytes / 1_024_000,
                duration_ms = upload_duration.as_millis(),
                throughput_mbps = format!("{:.2}", throughput_mbps),
                "Upload completed successfully"
            );

            return Ok((
                StatusCode::OK,
                Json(UploadResponse {
                    id: video_id,
                    message: "Video uploaded successfully".to_string(),
                }),
            ));
        }
    }

    // No video field found
    warn!("No video field found in multipart upload");
    Err(AppError::BadRequest("No video file provided".to_string()))
}

/// Get all videos uploaded by the authenticated user
#[utoipa::path(
    get,
    path = "/api/videos",
    responses(
        (status = 200, description = "List of videos uploaded by the user", body = Vec<Video>),
        (status = 401, description = "Unauthorized - authentication required"),
        (status = 500, description = "Internal server error")
    ),
    tag = "videos"
)]
pub async fn get_user_videos(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    let videos = state
        .db
        .get_videos_by_user(&auth_user.user_id)
        .await?;

    info!(
        user_id = %auth_user.user_id,
        count = videos.len(),
        "Fetched user videos"
    );

    Ok((StatusCode::OK, Json(videos)))
}

/// Helper: Determine MIME type from file extension
fn get_content_type(file_path: &str) -> &'static str {
    match std::path::Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
    {
        Some("mp4") => "video/mp4",
        Some("mov") => "video/quicktime",
        Some("avi") => "video/x-msvideo",
        Some("webm") => "video/webm",
        Some("mkv") => "video/x-matroska",
        _ => "application/octet-stream",
    }
}

/// Helper: Parse Range header (e.g., "bytes=0-1023")
/// Returns (start, end) where end is inclusive
fn parse_range_header(range_header: &str, file_size: u64) -> Option<(u64, u64)> {
    // Expected format: "bytes=start-end" or "bytes=start-" or "bytes=-end"
    let range_header = range_header.trim();

    if !range_header.starts_with("bytes=") {
        return None;
    }

    let range_spec = &range_header[6..]; // Skip "bytes="
    let parts: Vec<&str> = range_spec.split('-').collect();

    if parts.len() != 2 {
        return None;
    }

    let start_str = parts[0].trim();
    let end_str = parts[1].trim();

    match (start_str.is_empty(), end_str.is_empty()) {
        (false, false) => {
            // "start-end"
            let start = start_str.parse::<u64>().ok()?;
            let end = end_str.parse::<u64>().ok()?;
            Some((start, end.min(file_size - 1)))
        }
        (false, true) => {
            // "start-" (from start to end of file)
            let start = start_str.parse::<u64>().ok()?;
            Some((start, file_size - 1))
        }
        (true, false) => {
            // "-end" (last N bytes)
            let suffix_length = end_str.parse::<u64>().ok()?;
            let start = file_size.saturating_sub(suffix_length);
            Some((start, file_size - 1))
        }
        (true, true) => None, // Invalid: "-"
    }
}

/// Stream a video file with Range request support
#[utoipa::path(
    get,
    path = "/api/videos/{id}/stream",
    responses(
        (status = 200, description = "Full video file"),
        (status = 206, description = "Partial content (range request)"),
        (status = 404, description = "Video not found"),
        (status = 416, description = "Range not satisfiable"),
        (status = 500, description = "Internal server error")
    ),
    tag = "videos"
)]
pub async fn stream_video(
    Path(video_id): Path<String>,
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Result<Response, AppError> {
    // Get file size without loading content
    let video = state
        .db
        .get_video(&video_id)
        .await?
        .ok_or_else(|| {
            warn!(video_id = %video_id, "Video not found");
            AppError::NotFound("Video not found".to_string())
        })?;

    let file_size = state.filestore.get_file_size(&video.file_path).await?;
    let content_type = get_content_type(&video.file_path);

    // Check for Range header
    let range_header = headers.get(header::RANGE).and_then(|h| h.to_str().ok());

    // Log detailed request info for debugging
    info!(
        video_id = %video_id,
        file_size = file_size,
        range = ?range_header,
        "Video stream request"
    );

    match range_header {
        Some(range) => {
            // Parse range request
            match parse_range_header(range, file_size) {
                Some((start, end)) => {
                    // Validate range
                    if start >= file_size {
                        warn!(
                            video_id = %video_id,
                            start = start,
                            file_size = file_size,
                            "Range start exceeds file size"
                        );
                        return Err(AppError::BadRequest(format!(
                            "Range start {} exceeds file size {}",
                            start, file_size
                        )));
                    }

                    let end = end.min(file_size - 1);
                    let content_length = end - start + 1;

                    // Read only the requested byte range
                    let slice = state
                        .filestore
                        .get_file_range(&video.file_path, start, end)
                        .await?;

                    info!(
                        video_id = %video_id,
                        start = start,
                        end = end,
                        content_length = content_length,
                        "Serving partial content"
                    );

                    // Build 206 Partial Content response with caching headers
                    Ok(Response::builder()
                        .status(StatusCode::PARTIAL_CONTENT)
                        .header(header::CONTENT_TYPE, content_type)
                        .header(header::CONTENT_LENGTH, content_length)
                        .header(
                            header::CONTENT_RANGE,
                            format!("bytes {}-{}/{}", start, end, file_size),
                        )
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
                        .header(header::ETAG, format!("\"{}\"", video.id))
                        .body(Body::from(slice))
                        .unwrap())
                }
                None => {
                    // Invalid range format - serve full file
                    warn!(
                        video_id = %video_id,
                        range = range,
                        "Invalid Range header format, serving full file"
                    );
                    let file_data = state.filestore.get_file(&video.file_path).await?;
                    Ok(Response::builder()
                        .status(StatusCode::OK)
                        .header(header::CONTENT_TYPE, content_type)
                        .header(header::CONTENT_LENGTH, file_size)
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
                        .header(header::ETAG, format!("\"{}\"", video.id))
                        .body(Body::from(file_data))
                        .unwrap())
                }
            }
        }
        None => {
            // No Range header - serve full file
            info!(
                video_id = %video_id,
                size_bytes = file_size,
                "Serving full video file"
            );

            let file_data = state.filestore.get_file(&video.file_path).await?;
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CONTENT_LENGTH, file_size)
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
                .header(header::ETAG, format!("\"{}\"", video.id))
                .body(Body::from(file_data))
                .unwrap())
        }
    }
}
