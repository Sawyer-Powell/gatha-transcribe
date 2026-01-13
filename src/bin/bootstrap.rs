//! Bootstrap script for setting up a fresh development environment
//!
//! This script will:
//! 1. Clear the filestore directory
//! 2. Delete the SQLite database
//! 3. Run database migrations
//! 4. Seed test user using test_data module
//! 5. Seed test video using test_data module
//!
//! Usage: cargo run --bin bootstrap

use gatha_transcribe::{db::Database, test_data};
use std::path::PathBuf;
use tokio::fs;

const DB_FILE: &str = "gatha.db";
const FILESTORE_PATH: &str = "test_filestore";
const SOURCE_VIDEO_PATH: &str = "fixtures/videos/test_video1.mp4";

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

    // Step 3: Initialize database
    println!("\nStep 3: Initializing database");
    let database_url = format!("sqlite:{}?mode=rwc", DB_FILE);
    let db = Database::new(&database_url).await?;
    db.run_migrations().await?;
    println!("  Database initialized and migrations complete");

    // Step 4: Seed test user
    println!("\nStep 4: Seeding test user");
    let test_user = test_data::seed_test_user(&db).await?;
    println!("  User created: {} ({})", test_user.name, test_user.email);
    println!("  User ID: {}", test_user.id);
    println!("  Password: {}", test_data::TEST_USER_PASSWORD);

    // Step 5: Copy test video to filestore and seed database entry
    println!("\nStep 5: Seeding test video");

    // Check if source video exists
    if !PathBuf::from(SOURCE_VIDEO_PATH).exists() {
        return Err(format!("Test video not found at: {}", SOURCE_VIDEO_PATH).into());
    }

    // Create filestore directory
    fs::create_dir_all(FILESTORE_PATH).await?;

    // Copy video to filestore
    let video_filename = "test_video1.mp4";
    let dest_path = PathBuf::from(FILESTORE_PATH).join(video_filename);
    fs::copy(SOURCE_VIDEO_PATH, &dest_path).await?;

    let metadata = fs::metadata(&dest_path).await?;
    let video_size_mb = metadata.len() / 1024 / 1024;
    println!("  Copied video to filestore ({} MB)", video_size_mb);

    // Seed video database entry
    let test_videos = test_data::seed_test_videos(&db, &test_user.id, &[video_filename]).await?;
    println!("  Video database entry created");
    if let Some(video) = test_videos.first() {
        println!("  Video ID: {}", video.id);
    }

    println!("\nBootstrap complete!");
    println!("\nSummary:");
    println!("  Database: {}", DB_FILE);
    println!("  Filestore: {}", FILESTORE_PATH);
    println!("  User: {} ({})", test_user.name, test_user.email);
    println!("  Password: {}", test_data::TEST_USER_PASSWORD);
    println!("  Video: {} ({} MB)", video_filename, video_size_mb);
    println!("\nYou can now run the server with: cargo run");

    Ok(())
}
