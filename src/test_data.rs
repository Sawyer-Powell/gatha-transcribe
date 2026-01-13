//! Test data seeding utilities for test server
//!
//! This module provides functions to seed test users and videos
//! for consistent test environments.

use crate::db::{Database, User, Video};
use chrono::Utc;
use uuid::Uuid;

/// Known test user credentials
pub const TEST_USER_EMAIL: &str = "test@example.com";
pub const TEST_USER_PASSWORD: &str = "password123";
pub const TEST_USER_NAME: &str = "Test User";

/// Seed a test user with known credentials
///
/// Creates a user with email "test@example.com" and password "password123".
/// Password is properly hashed with bcrypt.
///
/// Returns the created User.
pub async fn seed_test_user(db: &Database) -> Result<User, sqlx::Error> {
    // Hash password with bcrypt (same as auth.rs)
    let hashed_password = bcrypt::hash(TEST_USER_PASSWORD, bcrypt::DEFAULT_COST)
        .map_err(|e| sqlx::Error::Protocol(format!("Failed to hash password: {}", e)))?;

    let user = User {
        id: Uuid::new_v4().to_string(),
        name: TEST_USER_NAME.to_string(),
        email: TEST_USER_EMAIL.to_string(),
        hashed_password,
        created_at: Utc::now(),
    };

    db.insert_user(&user).await?;

    Ok(user)
}

/// Seed test videos using files from fixtures/videos/
///
/// Creates video database entries pointing to files in the fixtures directory.
/// The files must exist at the specified paths.
///
/// Returns the list of created Videos.
pub async fn seed_test_videos(
    db: &Database,
    user_id: &str,
    video_filenames: &[&str],
) -> Result<Vec<Video>, sqlx::Error> {
    let mut videos = Vec::new();

    for filename in video_filenames {
        let video = Video {
            id: Uuid::new_v4().to_string(),
            file_path: filename.to_string(),
            original_filename: filename.to_string(),
            user_id: user_id.to_string(),
            uploaded_at: Utc::now(),
            width: None,
            height: None,
            duration_seconds: None,
        };

        db.insert_video(&video).await?;
        videos.push(video);
    }

    Ok(videos)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    #[tokio::test]
    async fn test_seed_user_creates_valid_user() {
        let db = Database::new("sqlite::memory:").await.unwrap();
        db.run_migrations().await.unwrap();

        let user = seed_test_user(&db).await.unwrap();

        assert_eq!(user.email, TEST_USER_EMAIL);
        assert_eq!(user.name, TEST_USER_NAME);

        // Verify password hash is valid
        assert!(bcrypt::verify(TEST_USER_PASSWORD, &user.hashed_password).unwrap());

        // Verify user can be retrieved from database
        let retrieved = db.get_user_by_email(TEST_USER_EMAIL).await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, user.id);
    }

    #[tokio::test]
    async fn test_seed_videos_creates_entries() {
        let db = Database::new("sqlite::memory:").await.unwrap();
        db.run_migrations().await.unwrap();

        let user = seed_test_user(&db).await.unwrap();

        let videos = seed_test_videos(&db, &user.id, &["test1.mp4", "test2.mp4"])
            .await
            .unwrap();

        assert_eq!(videos.len(), 2);
        assert_eq!(videos[0].original_filename, "test1.mp4");
        assert_eq!(videos[1].original_filename, "test2.mp4");
        assert_eq!(videos[0].file_path, "test1.mp4");
        assert_eq!(videos[1].file_path, "test2.mp4");

        // Verify videos can be retrieved from database
        let user_videos = db.get_videos_by_user(&user.id).await.unwrap();
        assert_eq!(user_videos.len(), 2);
    }
}
