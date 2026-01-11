use gatha_transcribe::{
    create_router,
    db::Database,
    filestore::LocalFileStore,
    upload::AppState,
};
use std::{path::PathBuf, sync::Arc};
use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[tokio::main]
async fn main() {
    // Initialize tracing subscriber
    // Can be configured with RUST_LOG env var, defaults to info level
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info"))
        )
        .with(
            fmt::layer()
                .with_target(true)
                .with_thread_ids(false)
                .with_level(true)
                .compact()
        )
        .init();

    info!("Starting gatha-transcribe server");

    // Load environment variables
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:gatha.db".to_string());

    let filestore_path = std::env::var("FILESTORE_PATH")
        .unwrap_or_else(|_| "test_filestore".to_string());

    // Initialize database
    info!(database_url = %database_url, "Connecting to database");
    let db = Database::new(&database_url)
        .await
        .expect("Failed to connect to database");

    // Run migrations
    info!("Running database migrations");
    db.run_migrations()
        .await
        .expect("Failed to run migrations");
    info!("Database migrations complete");

    // Initialize filestore
    info!(path = %filestore_path, "Initializing filestore");
    let filestore = LocalFileStore::new(PathBuf::from(filestore_path))
        .await
        .expect("Failed to initialize filestore");
    info!("Filestore initialized");

    // Create app state
    let state = Arc::new(AppState {
        db,
        filestore: Arc::new(filestore),
    });

    let (router, _api) = create_router(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("Failed to bind to port 3000");

    let addr = listener.local_addr().expect("Failed to get local address");
    info!(%addr, "Server listening");

    axum::serve(listener, router)
        .await
        .expect("Server failed");
}
