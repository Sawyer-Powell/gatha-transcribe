mod common;

use common::{create_test_state, start_test_server};
use gatha_transcribe::{test_data, upload::AppState};
use reqwest::Client;
use serde_json::json;
use std::sync::Arc;

/// Helper to create test server with seeded data
async fn create_seeded_test_server() -> (Arc<AppState>, String) {
    let (state, _db_dir, _filestore_dir) = create_test_state().await;

    // Seed test user
    let test_user = test_data::seed_test_user(&state.db).await.unwrap();

    // Seed test videos (note: files won't exist in temp filestore, but DB entries will)
    let video_filenames = &["test_video.mp4"];
    test_data::seed_test_videos(&state.db, &test_user.id, video_filenames)
        .await
        .unwrap();

    let base_url = start_test_server(state.clone()).await;

    (state, base_url)
}

#[tokio::test]
async fn test_seeded_user_can_login() {
    let (_state, base_url) = create_seeded_test_server().await;

    let client = Client::builder()
        .cookie_store(true)
        .build()
        .unwrap();

    // Login with seeded test credentials
    let response = client
        .post(format!("{}/api/auth/login", base_url))
        .json(&json!({
            "email": test_data::TEST_USER_EMAIL,
            "password": test_data::TEST_USER_PASSWORD
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        200,
        "Should be able to login with seeded credentials"
    );

    let json: serde_json::Value = response.json().await.unwrap();
    assert_eq!(json["user"]["email"], test_data::TEST_USER_EMAIL);
    assert_eq!(json["user"]["name"], test_data::TEST_USER_NAME);

    println!("✓ Seeded user can login with known credentials");
}

#[tokio::test]
async fn test_seeded_videos_accessible() {
    let (_state, base_url) = create_seeded_test_server().await;

    let client = Client::builder()
        .cookie_store(true)
        .build()
        .unwrap();

    // Login first
    client
        .post(format!("{}/api/auth/login", base_url))
        .json(&json!({
            "email": test_data::TEST_USER_EMAIL,
            "password": test_data::TEST_USER_PASSWORD
        }))
        .send()
        .await
        .unwrap();

    // Fetch videos
    let response = client
        .get(format!("{}/api/videos", base_url))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 200);

    let videos: Vec<serde_json::Value> = response.json().await.unwrap();
    assert_eq!(videos.len(), 1, "Should have 1 seeded video");

    let video = &videos[0];
    assert_eq!(video["original_filename"], "test_video.mp4");
    assert_eq!(video["file_path"], "fixtures/videos/test_video.mp4");

    println!("✓ Seeded videos are accessible via API");
}

#[tokio::test]
async fn test_seed_multiple_videos() {
    let (state, _db_dir, _filestore_dir) = create_test_state().await;

    // Seed user
    let test_user = test_data::seed_test_user(&state.db).await.unwrap();

    // Seed multiple videos
    let video_filenames = &["video1.mp4", "video2.mp4", "video3.mp4"];
    let videos = test_data::seed_test_videos(&state.db, &test_user.id, video_filenames)
        .await
        .unwrap();

    assert_eq!(videos.len(), 3);
    assert_eq!(videos[0].original_filename, "video1.mp4");
    assert_eq!(videos[1].original_filename, "video2.mp4");
    assert_eq!(videos[2].original_filename, "video3.mp4");

    // Verify all videos are in database
    let user_videos = state.db.get_videos_by_user(&test_user.id).await.unwrap();
    assert_eq!(user_videos.len(), 3);

    println!("✓ Can seed multiple videos");
}

#[tokio::test]
async fn test_seeded_user_password_hash_valid() {
    let (state, _db_dir, _filestore_dir) = create_test_state().await;

    let test_user = test_data::seed_test_user(&state.db).await.unwrap();

    // Verify password is properly hashed with bcrypt
    assert!(
        bcrypt::verify(test_data::TEST_USER_PASSWORD, &test_user.hashed_password).unwrap(),
        "Password should be properly hashed with bcrypt"
    );

    println!("✓ Seeded user password is properly hashed");
}
