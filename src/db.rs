use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Video {
    pub id: String,
    pub file_path: String,
    pub original_filename: String,
    pub uploaded_at: DateTime<Utc>,
}

impl Video {
    pub fn new(file_path: String, original_filename: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            file_path,
            original_filename,
            uploaded_at: Utc::now(),
        }
    }
}

/// Database connection and operations
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// Create a new database connection
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = SqlitePool::connect(database_url).await?;
        Ok(Self { pool })
    }

    /// Run migrations
    pub async fn run_migrations(&self) -> Result<(), sqlx::Error> {
        sqlx::migrate!("./migrations").run(&self.pool).await?;
        Ok(())
    }

    /// Get the connection pool
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Insert a new video record
    pub async fn insert_video(&self, video: &Video) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "INSERT INTO videos (id, file_path, original_filename, uploaded_at) VALUES (?, ?, ?, ?)",
            video.id,
            video.file_path,
            video.original_filename,
            video.uploaded_at
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Get a video by ID
    pub async fn get_video(&self, id: &str) -> Result<Option<Video>, sqlx::Error> {
        let video = sqlx::query_as!(
            Video,
            r#"SELECT id, file_path, original_filename, uploaded_at as "uploaded_at: _" FROM videos WHERE id = ?"#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(video)
    }

    /// List all videos
    pub async fn list_videos(&self) -> Result<Vec<Video>, sqlx::Error> {
        let videos = sqlx::query_as!(
            Video,
            r#"SELECT id, file_path, original_filename, uploaded_at as "uploaded_at: _" FROM videos ORDER BY uploaded_at DESC"#
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(videos)
    }

    /// Delete a video by ID
    pub async fn delete_video(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query!("DELETE FROM videos WHERE id = ?", id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
