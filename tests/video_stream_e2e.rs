mod common;

use common::{create_authenticated_client, create_test_state, start_test_server};
use reqwest::multipart;

#[tokio::test]
async fn test_stream_full_video() {
    let (state, _db_dir, _filestore_dir) = create_test_state().await;
    let base_url = start_test_server(state.clone()).await;
    let client = create_authenticated_client(&base_url, "test@example.com", "Test User").await;

    // Create a small test video (10KB of data)
    let test_data = vec![0u8; 10 * 1024];

    // Upload video
    let part = multipart::Part::bytes(test_data.clone())
        .file_name("test_video.mp4".to_string())
        .mime_str("video/mp4")
        .unwrap();

    let form = multipart::Form::new().part("video", part);

    let upload_response = client
        .post(format!("{}/api/videos/upload", base_url))
        .multipart(form)
        .send()
        .await
        .unwrap();

    assert_eq!(upload_response.status(), 200);

    let upload_json: serde_json::Value = upload_response.json().await.unwrap();
    let video_id = upload_json["id"].as_str().unwrap();

    // Stream the video (no Range header - should get full file)
    let stream_response = client
        .get(format!("{}/api/videos/{}/stream", base_url, video_id))
        .send()
        .await
        .unwrap();

    // Verify response
    assert_eq!(stream_response.status(), 200, "Stream should return 200 OK");

    // Check headers
    assert_eq!(
        stream_response.headers().get("content-type").unwrap(),
        "video/mp4"
    );
    assert_eq!(
        stream_response.headers().get("content-length").unwrap(),
        "10240" // 10KB
    );
    assert_eq!(
        stream_response.headers().get("accept-ranges").unwrap(),
        "bytes"
    );

    // Verify body matches original data
    let body = stream_response.bytes().await.unwrap();
    assert_eq!(body.len(), test_data.len());
    assert_eq!(body.as_ref(), test_data.as_slice());

    println!("✓ Successfully streamed full video (10KB)");
}

#[tokio::test]
async fn test_stream_partial_content() {
    let (state, _db_dir, _filestore_dir) = create_test_state().await;
    let base_url = start_test_server(state.clone()).await;
    let client = create_authenticated_client(&base_url, "test@example.com", "Test User").await;

    // Create a small test video (10KB of data with a known pattern)
    let mut test_data = vec![0u8; 10 * 1024];
    for (i, byte) in test_data.iter_mut().enumerate() {
        *byte = (i % 256) as u8;
    }

    // Upload video
    let part = multipart::Part::bytes(test_data.clone())
        .file_name("test_video.mp4".to_string())
        .mime_str("video/mp4")
        .unwrap();

    let form = multipart::Form::new().part("video", part);

    let upload_response = client
        .post(format!("{}/api/videos/upload", base_url))
        .multipart(form)
        .send()
        .await
        .unwrap();

    assert_eq!(upload_response.status(), 200);

    let upload_json: serde_json::Value = upload_response.json().await.unwrap();
    let video_id = upload_json["id"].as_str().unwrap();

    // Request partial content (first 1024 bytes)
    let stream_response = client
        .get(format!("{}/api/videos/{}/stream", base_url, video_id))
        .header("Range", "bytes=0-1023")
        .send()
        .await
        .unwrap();

    // Verify response
    assert_eq!(
        stream_response.status(),
        206,
        "Stream should return 206 Partial Content"
    );

    // Check headers
    assert_eq!(
        stream_response.headers().get("content-type").unwrap(),
        "video/mp4"
    );
    assert_eq!(
        stream_response.headers().get("content-length").unwrap(),
        "1024"
    );
    assert_eq!(
        stream_response.headers().get("content-range").unwrap(),
        "bytes 0-1023/10240"
    );
    assert_eq!(
        stream_response.headers().get("accept-ranges").unwrap(),
        "bytes"
    );

    // Verify body matches first 1024 bytes of original data
    let body = stream_response.bytes().await.unwrap();
    assert_eq!(body.len(), 1024);
    assert_eq!(body.as_ref(), &test_data[0..1024]);

    println!("✓ Successfully streamed partial content (1024 bytes)");
}

#[tokio::test]
async fn test_stream_video_not_found() {
    let (state, _db_dir, _filestore_dir) = create_test_state().await;
    let base_url = start_test_server(state.clone()).await;
    let client = create_authenticated_client(&base_url, "test@example.com", "Test User").await;

    // Try to stream a non-existent video
    let stream_response = client
        .get(format!("{}/api/videos/nonexistent-id/stream", base_url))
        .send()
        .await
        .unwrap();

    assert_eq!(stream_response.status(), 404, "Should return 404 Not Found");

    println!("✓ Correctly returns 404 for non-existent video");
}

#[tokio::test]
async fn test_stream_range_large_file_seeking() {
    let (state, _db_dir, _filestore_dir) = create_test_state().await;
    let base_url = start_test_server(state.clone()).await;
    let client = create_authenticated_client(&base_url, "test@example.com", "Test User").await;

    // Create a 50MB test file to simulate a large video
    // Fill with pattern so we can verify correct byte range is returned
    let file_size = 50 * 1024 * 1024; // 50MB
    let mut test_data = vec![0u8; file_size];
    for (i, byte) in test_data.iter_mut().enumerate() {
        *byte = (i % 256) as u8;
    }

    // Upload video
    let part = multipart::Part::bytes(test_data.clone())
        .file_name("large_video.mp4".to_string())
        .mime_str("video/mp4")
        .unwrap();

    let form = multipart::Form::new().part("video", part);

    let upload_response = client
        .post(format!("{}/api/videos/upload", base_url))
        .multipart(form)
        .send()
        .await
        .unwrap();

    assert_eq!(upload_response.status(), 200);

    let upload_json: serde_json::Value = upload_response.json().await.unwrap();
    let video_id = upload_json["id"].as_str().unwrap();

    // Simulate seeking to 1-hour mark in a 3-hour video
    // Request bytes from 80% into the file (simulating late-stage seeking)
    let seek_position = (file_size as f64 * 0.8) as u64; // Seek to 80% through file
    let range_size = 1024 * 1024; // Request 1MB
    let end_position = seek_position + range_size - 1;

    let start = std::time::Instant::now();
    let stream_response = client
        .get(format!("{}/api/videos/{}/stream", base_url, video_id))
        .header("Range", format!("bytes={}-{}", seek_position, end_position))
        .send()
        .await
        .unwrap();
    let elapsed = start.elapsed();

    // Verify response
    assert_eq!(
        stream_response.status(),
        206,
        "Stream should return 206 Partial Content"
    );

    // Check headers
    assert_eq!(
        stream_response.headers().get("content-type").unwrap(),
        "video/mp4"
    );
    assert_eq!(
        stream_response.headers().get("content-length").unwrap(),
        format!("{}", range_size).as_str()
    );
    assert_eq!(
        stream_response
            .headers()
            .get("content-range")
            .unwrap()
            .to_str()
            .unwrap(),
        format!("bytes {}-{}/{}", seek_position, end_position, file_size)
    );

    // Verify body matches expected slice from original data
    let body = stream_response.bytes().await.unwrap();
    assert_eq!(body.len(), range_size as usize);
    assert_eq!(
        body.as_ref(),
        &test_data[seek_position as usize..=end_position as usize]
    );

    println!(
        "✓ Successfully streamed 1MB from 80% position of 50MB file in {:?}",
        elapsed
    );
    println!("  Performance: Seeking to late-stage position without loading full file");

    // Performance assertion - should be fast since we're not loading the full 50MB
    // On M-series Mac, should complete in < 50ms
    assert!(
        elapsed.as_millis() < 100,
        "Range request should be fast (< 100ms), took {:?}",
        elapsed
    );
}
