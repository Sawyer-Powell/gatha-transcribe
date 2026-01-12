use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Video {
    pub id: String,
    pub file_path: String,
    pub original_filename: String,
    pub user_id: String,
    #[schema(value_type = String, format = DateTime)]
    pub uploaded_at: DateTime<Utc>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration_seconds: Option<f64>,
}

impl Video {
    pub fn new(file_path: String, original_filename: String, user_id: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            file_path,
            original_filename,
            user_id,
            uploaded_at: Utc::now(),
            width: None,
            height: None,
            duration_seconds: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing)] // Never send to client
    pub hashed_password: String,
    pub created_at: DateTime<Utc>,
}

impl User {
    pub fn new(name: String, email: String, hashed_password: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            email,
            hashed_password,
            created_at: Utc::now(),
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
            "INSERT INTO videos (id, file_path, original_filename, user_id, uploaded_at, width, height, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            video.id,
            video.file_path,
            video.original_filename,
            video.user_id,
            video.uploaded_at,
            video.width,
            video.height,
            video.duration_seconds
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Get a video by ID
    pub async fn get_video(&self, id: &str) -> Result<Option<Video>, sqlx::Error> {
        let video = sqlx::query_as!(
            Video,
            r#"SELECT id, file_path, original_filename, user_id, uploaded_at as "uploaded_at: _", width, height, duration_seconds FROM videos WHERE id = ?"#,
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
            r#"SELECT id, file_path, original_filename, user_id, uploaded_at as "uploaded_at: _", width, height, duration_seconds FROM videos ORDER BY uploaded_at DESC"#
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(videos)
    }

    /// Get all videos uploaded by a specific user
    pub async fn get_videos_by_user(&self, user_id: &str) -> Result<Vec<Video>, sqlx::Error> {
        let videos = sqlx::query_as!(
            Video,
            r#"SELECT id, file_path, original_filename, user_id, uploaded_at as "uploaded_at: _", width, height, duration_seconds FROM videos WHERE user_id = ? ORDER BY uploaded_at DESC"#,
            user_id
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

    /// Insert a new user record
    pub async fn insert_user(&self, user: &User) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "INSERT INTO users (id, name, email, hashed_password, created_at) VALUES (?, ?, ?, ?, ?)",
            user.id,
            user.name,
            user.email,
            user.hashed_password,
            user.created_at
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Get a user by email (for login)
    pub async fn get_user_by_email(&self, email: &str) -> Result<Option<User>, sqlx::Error> {
        let user = sqlx::query_as!(
            User,
            r#"SELECT id, name, email, hashed_password, created_at as "created_at: _" FROM users WHERE email = ?"#,
            email
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(user)
    }

    /// Get a user by ID (for auth middleware)
    pub async fn get_user_by_id(&self, id: &str) -> Result<Option<User>, sqlx::Error> {
        let user = sqlx::query_as!(
            User,
            r#"SELECT id, name, email, hashed_password, created_at as "created_at: _" FROM users WHERE id = ?"#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(user)
    }

    /// Upsert a transcription session (insert or update)
    pub async fn upsert_session(
        &self,
        user_id: &str,
        video_id: &str,
        state_json: &str,
    ) -> Result<(), sqlx::Error> {
        let now = Utc::now();

        sqlx::query!(
            r#"
            INSERT INTO transcription_sessions (user_id, video_id, state_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, video_id) DO UPDATE SET
                state_json = excluded.state_json,
                updated_at = excluded.updated_at
            "#,
            user_id,
            video_id,
            state_json,
            now,
            now
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Get a transcription session by user_id and video_id
    pub async fn get_session(
        &self,
        user_id: &str,
        video_id: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let result = sqlx::query!(
            "SELECT state_json FROM transcription_sessions WHERE user_id = ? AND video_id = ?",
            user_id,
            video_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.map(|row| row.state_json))
    }

    /// List all sessions (for loading on startup)
    pub async fn list_all_sessions(&self) -> Result<Vec<(String, String, String)>, sqlx::Error> {
        let rows = sqlx::query!(
            "SELECT user_id, video_id, state_json FROM transcription_sessions"
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| (row.user_id, row.video_id, row.state_json))
            .collect())
    }

    /// Batch upsert multiple sessions in a single transaction
    pub async fn upsert_sessions_batch(
        &self,
        sessions: Vec<(String, String, String)>, // (user_id, video_id, state_json)
    ) -> Result<(), sqlx::Error> {
        if sessions.is_empty() {
            return Ok(());
        }

        let now = Utc::now();
        let mut tx = self.pool.begin().await?;

        for (user_id, video_id, state_json) in sessions {
            sqlx::query!(
                r#"
                INSERT INTO transcription_sessions (user_id, video_id, state_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id, video_id) DO UPDATE SET
                    state_json = excluded.state_json,
                    updated_at = excluded.updated_at
                "#,
                user_id,
                video_id,
                state_json,
                now,
                now
            )
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }
}
