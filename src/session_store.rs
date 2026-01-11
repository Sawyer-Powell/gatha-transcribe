use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;

#[derive(Error, Debug)]
pub enum SessionStoreError {
    #[error("Session not found")]
    NotFound,
    #[error("Internal error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, SessionStoreError>;

/// Key for indexing sessions by (user_id, video_id)
pub type SessionKey = (String, String);

/// Transcription session state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionSession {
    pub user_id: String,
    pub video_id: String,
    pub current_time: f64,
    pub updated_at: DateTime<Utc>,
    #[serde(skip)]
    pub dirty: bool, // Track if changed since last persist
}

/// Trait for storing and retrieving transcription sessions
#[async_trait::async_trait]
pub trait SessionStore: Send + Sync {
    /// Get a session by key
    async fn get(&self, key: &SessionKey) -> Result<Option<TranscriptionSession>>;

    /// Set/update a session
    async fn set(&self, key: &SessionKey, session: TranscriptionSession) -> Result<()>;

    /// Delete a session
    async fn delete(&self, key: &SessionKey) -> Result<()>;

    /// List all sessions (for persistence task)
    async fn list_all(&self) -> Result<Vec<(SessionKey, TranscriptionSession)>>;
}

/// In-memory implementation of SessionStore
pub struct InMemorySessionStore {
    sessions: Arc<RwLock<HashMap<SessionKey, TranscriptionSession>>>,
}

impl InMemorySessionStore {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[async_trait::async_trait]
impl SessionStore for InMemorySessionStore {
    async fn get(&self, key: &SessionKey) -> Result<Option<TranscriptionSession>> {
        let sessions = self.sessions.read().await;
        Ok(sessions.get(key).cloned())
    }

    async fn set(&self, key: &SessionKey, session: TranscriptionSession) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        sessions.insert(key.clone(), session);
        Ok(())
    }

    async fn delete(&self, key: &SessionKey) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        sessions.remove(key);
        Ok(())
    }

    async fn list_all(&self) -> Result<Vec<(SessionKey, TranscriptionSession)>> {
        let sessions = self.sessions.read().await;
        Ok(sessions
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_session_store_operations() {
        let store = InMemorySessionStore::new();
        let key = ("user1".to_string(), "video1".to_string());

        // Get non-existent session
        let result = store.get(&key).await.unwrap();
        assert!(result.is_none());

        // Set session
        let session = TranscriptionSession {
            user_id: "user1".to_string(),
            video_id: "video1".to_string(),
            current_time: 42.5,
            updated_at: Utc::now(),
            dirty: false,
        };
        store.set(&key, session.clone()).await.unwrap();

        // Get session
        let result = store.get(&key).await.unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().current_time, 42.5);

        // List all
        let all = store.list_all().await.unwrap();
        assert_eq!(all.len(), 1);

        // Delete session
        store.delete(&key).await.unwrap();
        let result = store.get(&key).await.unwrap();
        assert!(result.is_none());
    }
}
