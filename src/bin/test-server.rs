use gatha_transcribe::{create_router, db::Database, filestore::LocalFileStore, upload::AppState};
use std::sync::Arc;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Use in-memory SQLite database for testing
    let db = Database::new("sqlite::memory:").await?;
    db.run_migrations().await?;

    // Create temporary filestore
    let temp_dir = tempfile::tempdir()?;
    let filestore = LocalFileStore::new(temp_dir.path().to_path_buf()).await?;

    let state = Arc::new(AppState {
        db,
        filestore: Arc::new(filestore),
    });

    // Get port from env or use 3000
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("127.0.0.1:{}", port);

    let listener = TcpListener::bind(&addr).await?;
    let actual_addr = listener.local_addr()?;

    println!("Test server listening on http://{}", actual_addr);

    let (router, _api) = create_router(state);

    axum::serve(listener, router).await?;

    Ok(())
}
