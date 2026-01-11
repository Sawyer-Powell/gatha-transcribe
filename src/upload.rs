use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::{sync::Arc, time::Instant};
use tokio::io::AsyncWriteExt;
use tracing::{error, info, warn};
use utoipa::ToSchema;

use crate::{
    db::{Database, Video},
    filestore::FileStore,
};

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UploadResponse {
    pub id: String,
    pub message: String,
}

pub struct AppState {
    pub db: Database,
    pub filestore: Arc<dyn FileStore>,
}

/// Handle video upload
#[utoipa::path(
    post,
    path = "/api/videos/upload",
    request_body(content_type = "multipart/form-data"),
    responses(
        (status = 200, description = "Video uploaded successfully", body = UploadResponse),
        (status = 400, description = "Bad request - missing video file or invalid data"),
        (status = 500, description = "Internal server error - failed to save file or database error")
    ),
    tag = "videos"
)]
pub async fn upload_video(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let upload_start = Instant::now();

    // Process multipart fields
    while let Some(mut field) = multipart
        .next_field()
        .await
        .map_err(|e| {
            warn!(error = %e, "Failed to read multipart field");
            (StatusCode::BAD_REQUEST, format!("Failed to read multipart: {}", e))
        })?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "video" {
            // Get original filename
            let original_filename = field
                .file_name()
                .ok_or_else(|| {
                    warn!("No filename provided in multipart upload");
                    (
                        StatusCode::BAD_REQUEST,
                        "No filename provided".to_string(),
                    )
                })?
                .to_string();

            // Determine file extension from original filename
            let extension = std::path::Path::new(&original_filename)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("mp4");

            // Generate UUID for this video
            let video_id = uuid::Uuid::new_v4().to_string();

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
                (
                    StatusCode::BAD_REQUEST,
                    format!("Failed to read chunk: {}", e),
                )
            })? {
                let chunk_size = chunk.len();
                total_bytes += chunk_size as u64;
                chunk_count += 1;

                writer.write_all(&chunk).await.map_err(|e| {
                    error!(error = %e, bytes_received = total_bytes, "Failed to write chunk to pipe");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Failed to write chunk: {}", e),
                    )
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
            save_handle
                .await
                .map_err(|e| {
                    error!(error = %e, video_id = %video_id, "Save task panicked");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Save task failed: {}", e),
                    )
                })?
                .map_err(|e| {
                    error!(error = %e, video_id = %video_id, total_bytes, "File save failed");
                    (StatusCode::BAD_REQUEST, format!("Upload failed: {}", e))
                })?;

            // Create video record with the same UUID used for file path
            let video = Video {
                id: video_id.clone(),
                file_path: file_path.clone(),
                original_filename: original_filename.clone(),
                uploaded_at: chrono::Utc::now(),
            };

            // Save video metadata to database
            state.db.insert_video(&video).await.map_err(|e| {
                error!(error = %e, video_id = %video_id, "Failed to save video metadata to database");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to save video metadata: {}", e),
                )
            })?;

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
    Err((StatusCode::BAD_REQUEST, "No video file provided".to_string()))
}
