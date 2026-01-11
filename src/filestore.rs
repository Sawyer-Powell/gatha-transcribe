use std::path::PathBuf;
use thiserror::Error;
use tokio::fs;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};

#[derive(Error, Debug)]
pub enum FileStoreError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("File not found: {0}")]
    NotFound(String),
    #[error("File size exceeds maximum allowed ({0} bytes)")]
    FileTooLarge(u64),
}

pub type Result<T> = std::result::Result<T, FileStoreError>;

/// Trait for storing and retrieving files
#[async_trait::async_trait]
pub trait FileStore: Send + Sync {
    /// Save a file with the given ID by streaming from an AsyncRead source
    async fn save_file(
        &self,
        file_id: &str,
        reader: Box<dyn AsyncRead + Unpin + Send>,
    ) -> Result<String>;

    /// Get file data by ID
    async fn get_file(&self, file_id: &str) -> Result<Vec<u8>>;

    /// Delete a file by ID
    async fn delete_file(&self, file_id: &str) -> Result<()>;

    /// Check if a file exists
    async fn file_exists(&self, file_id: &str) -> Result<bool>;
}

/// Local filesystem implementation of FileStore
pub struct LocalFileStore {
    base_path: PathBuf,
}

impl LocalFileStore {
    /// Create a new LocalFileStore with the given base directory
    pub async fn new(base_path: PathBuf) -> Result<Self> {
        // Create directory if it doesn't exist
        fs::create_dir_all(&base_path).await?;
        Ok(Self { base_path })
    }

    fn get_file_path(&self, file_id: &str) -> PathBuf {
        self.base_path.join(file_id)
    }
}

const MAX_FILE_SIZE: u64 = 2 * 1024 * 1024 * 1024; // 2GB
const CHUNK_SIZE: usize = 1024 * 1024; // 1MB chunks

#[async_trait::async_trait]
impl FileStore for LocalFileStore {
    async fn save_file(
        &self,
        file_id: &str,
        mut reader: Box<dyn AsyncRead + Unpin + Send>,
    ) -> Result<String> {
        let file_path = self.get_file_path(file_id);

        // Create parent directories if needed
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let mut file = fs::File::create(&file_path).await?;

        // Stream with size validation
        let mut buffer = vec![0u8; CHUNK_SIZE];
        let mut total = 0u64;

        loop {
            let n = reader.read(&mut buffer).await?;

            if n == 0 {
                break;
            }

            total += n as u64;
            if total > MAX_FILE_SIZE {
                // Clean up partial file before returning error
                let _ = fs::remove_file(&file_path).await;
                return Err(FileStoreError::FileTooLarge(MAX_FILE_SIZE));
            }

            file.write_all(&buffer[..n]).await?;
        }

        file.sync_all().await?;

        Ok(file_id.to_string())
    }

    async fn get_file(&self, file_id: &str) -> Result<Vec<u8>> {
        let file_path = self.get_file_path(file_id);

        if !file_path.exists() {
            return Err(FileStoreError::NotFound(file_id.to_string()));
        }

        let data = fs::read(&file_path).await?;
        Ok(data)
    }

    async fn delete_file(&self, file_id: &str) -> Result<()> {
        let file_path = self.get_file_path(file_id);

        if !file_path.exists() {
            return Err(FileStoreError::NotFound(file_id.to_string()));
        }

        fs::remove_file(&file_path).await?;
        Ok(())
    }

    async fn file_exists(&self, file_id: &str) -> Result<bool> {
        let file_path = self.get_file_path(file_id);
        Ok(file_path.exists())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_save_and_retrieve_file() {
        let temp_dir = std::env::temp_dir().join("filestore_test");
        let store = LocalFileStore::new(temp_dir.clone()).await.unwrap();

        let file_id = "test_file.txt";
        let data = b"Hello, World!";

        // Save file (now streaming from boxed &[u8])
        store
            .save_file(file_id, Box::new(&data[..]))
            .await
            .unwrap();

        // Retrieve file
        let retrieved = store.get_file(file_id).await.unwrap();
        assert_eq!(retrieved, data);

        // Clean up
        store.delete_file(file_id).await.unwrap();
        fs::remove_dir_all(temp_dir).await.unwrap();
    }
}
