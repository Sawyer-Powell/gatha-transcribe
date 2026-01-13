use gatha_transcribe::{
    create_router, db::Database, filestore::LocalFileStore,
    session_store::InMemorySessionStore, test_data, upload::AppState,
};
use std::{path::PathBuf, sync::Arc};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Use in-memory SQLite database for testing
    let db = Database::new("sqlite::memory:").await?;
    db.run_migrations().await?;

    // Seed test user
    println!("Seeding test data...");
    let test_user = test_data::seed_test_user(&db).await?;
    println!("Test user created: {}", test_user.email);

    // Seed test videos (using test_video1 from fixtures)
    let video_filenames = &["test_video1.mp4"];
    let test_videos = test_data::seed_test_videos(&db, &test_user.id, video_filenames).await?;
    println!("Seeded {} test video(s)", test_videos.len());

    // Use fixtures/videos as filestore (where test videos actually exist)
    // Resolve to absolute path relative to project root
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let filestore_path = PathBuf::from(manifest_dir).join("fixtures/videos");
    let filestore = LocalFileStore::new(filestore_path).await?;

    // Create session store
    let session_store = InMemorySessionStore::new();

    let state = Arc::new(AppState {
        db,
        filestore: Arc::new(filestore),
        session_store: Arc::new(session_store),
    });

    // Get port from env or use 3000
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("127.0.0.1:{}", port);

    let listener = TcpListener::bind(&addr).await?;
    let actual_addr = listener.local_addr()?;

    println!("\nTest server ready");
    println!("URL: http://{}", actual_addr);
    println!("\nTest credentials:");
    println!("Email: {}", test_data::TEST_USER_EMAIL);
    println!("Password: {}", test_data::TEST_USER_PASSWORD);
    println!();

    // Serve frontend from dist directory
    // Use FRONTEND_DIST_PATH env var, or default to ../frontend/dist from binary location
    let frontend_path = if let Ok(path) = std::env::var("FRONTEND_DIST_PATH") {
        PathBuf::from(path)
    } else {
        // Default: assume running from project root
        // Resolve to absolute path relative to the binary's location
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        PathBuf::from(manifest_dir).join("frontend/dist")
    };

    // Verify paths exist
    if !frontend_path.exists() {
        eprintln!("ERROR: Frontend path does not exist: {:?}", frontend_path);
        eprintln!("Set FRONTEND_DIST_PATH environment variable or build frontend first");
        return Err("Frontend dist directory not found".into());
    }

    println!("Serving frontend from: {:?}", frontend_path);

    let (router, _api) = create_router(state, Some(frontend_path));

    axum::serve(listener, router).await?;

    Ok(())
}
