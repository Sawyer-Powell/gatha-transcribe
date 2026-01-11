//! Bootstrap script for setting up a fresh development environment
//!
//! This script will:
//! 1. Clear the filestore directory
//! 2. Delete the SQLite database
//! 3. Start a test server directly
//! 4. Create a test user via /api/auth/register
//! 5. Upload a test video via /api/videos/upload
//!
//! The server will automatically run migrations and handle video processing.
//!
//! Usage: cargo run --bin bootstrap

use gatha_transcribe::start_server;
use reqwest::multipart::{Form, Part};
use reqwest::Client;
use serde_json::json;
use std::path::PathBuf;
use tokio::fs;
use tokio::time::{sleep, Duration};

const DB_FILE: &str = "gatha.db";
const FILESTORE_PATH: &str = "test_filestore";
const TEST_VIDEO_PATH: &str = "test_files/Zoom Meeting Recording.mp4";
const SERVER_URL: &str = "http://localhost:3000";

// Test user credentials
const USER_NAME: &str = "Sawyer Powell";
const USER_EMAIL: &str = "sawyerhpowell@gmail.com";
const USER_PASSWORD: &str = "shoemakerlevi9";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize simple logging
    tracing_subscriber::fmt()
        .with_target(false)
        .with_level(false)
        .init();

    println!("Bootstrapping development environment\n");

    // Step 1: Clear filestore
    println!("Step 1: Clearing filestore directory");
    if PathBuf::from(FILESTORE_PATH).exists() {
        fs::remove_dir_all(FILESTORE_PATH).await?;
        println!("  Filestore cleared");
    } else {
        println!("  Filestore directory doesn't exist");
    }

    // Step 2: Delete database
    println!("\nStep 2: Resetting database");
    if PathBuf::from(DB_FILE).exists() {
        fs::remove_file(DB_FILE).await?;
        println!("  Database deleted");
    } else {
        println!("  Database doesn't exist");
    }

    // Also remove WAL and SHM files if they exist
    for ext in &["-shm", "-wal"] {
        let wal_path = format!("{}{}", DB_FILE, ext);
        if PathBuf::from(&wal_path).exists() {
            fs::remove_file(&wal_path).await?;
        }
    }

    // Step 3: Start test server directly in background task
    println!("\nStep 3: Starting test server");
    let (server_task, _state) = start_server(
        3000,
        Some("sqlite:gatha.db?mode=rwc".to_string()),
        Some(PathBuf::from(FILESTORE_PATH)),
    ).await?;

    println!("  Server started on port 3000");

    // Wait a moment for server to be fully ready
    sleep(Duration::from_millis(500)).await;

    // Step 4: Register test user
    println!("\nStep 4: Creating test user");
    let client = Client::new();
    let register_response = client
        .post(&format!("{}/api/auth/register", SERVER_URL))
        .json(&json!({
            "name": USER_NAME,
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        }))
        .send()
        .await?;

    if !register_response.status().is_success() {
        let error_text = register_response.text().await?;
        server_task.abort();
        return Err(format!("Failed to register user: {}", error_text).into());
    }

    let register_data: serde_json::Value = register_response.json().await?;
    println!("  User created: {} ({})", USER_NAME, USER_EMAIL);
    if let Some(user_id) = register_data["user"]["id"].as_str() {
        println!("  User ID: {}", user_id);
    }

    // Step 5: Upload test video
    println!("\nStep 5: Uploading test video");

    // Check if test video exists
    if !PathBuf::from(TEST_VIDEO_PATH).exists() {
        server_task.abort();
        return Err(format!("Test video not found at: {}", TEST_VIDEO_PATH).into());
    }

    let video_data = fs::read(TEST_VIDEO_PATH).await?;
    let video_size_mb = video_data.len() / 1024 / 1024;
    println!("  Video size: {} MB", video_size_mb);
    println!("  Uploading and processing (this may take a few seconds)...");

    let video_part = Part::bytes(video_data)
        .file_name("Zoom Meeting Recording.mp4")
        .mime_str("video/mp4")?;

    let form = Form::new().part("video", video_part);

    // Create authenticated client with cookies
    let auth_client = Client::builder()
        .cookie_store(true)
        .build()?;

    // Login to get auth cookie
    auth_client
        .post(&format!("{}/api/auth/login", SERVER_URL))
        .json(&json!({
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        }))
        .send()
        .await?;

    let upload_response = auth_client
        .post(&format!("{}/api/videos/upload", SERVER_URL))
        .multipart(form)
        .send()
        .await?;

    if !upload_response.status().is_success() {
        let error_text = upload_response.text().await?;
        server_task.abort();
        return Err(format!("Failed to upload video: {}", error_text).into());
    }

    let upload_data: serde_json::Value = upload_response.json().await?;
    println!("  Video uploaded and optimized");
    if let Some(video_id) = upload_data["id"].as_str() {
        println!("  Video ID: {}", video_id);
    }

    // Step 6: Shutdown server
    println!("\nStep 6: Shutting down test server");
    server_task.abort();
    println!("  Server stopped");

    println!("\nBootstrap complete!");
    println!("\nSummary:");
    println!("  Database: {}", DB_FILE);
    println!("  Filestore: {}", FILESTORE_PATH);
    println!("  User: {} ({})", USER_NAME, USER_EMAIL);
    println!("  Video: Zoom Meeting Recording.mp4 ({} MB)", video_size_mb);
    println!("\nYou can now run the server with: cargo run");

    Ok(())
}
