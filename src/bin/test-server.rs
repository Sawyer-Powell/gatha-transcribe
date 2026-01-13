use gatha_transcribe::{
    create_router, db::Database, filestore::LocalFileStore, session_store::InMemorySessionStore,
    test_data, upload::AppState,
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

    // Seed test videos (using Zoom video from fixtures)
    let video_filenames = &["Zoom Meeting Recording.mp4"];
    let test_videos = test_data::seed_test_videos(&db, &test_user.id, video_filenames).await?;
    println!("Seeded {} test video(s)", test_videos.len());

    // Use fixtures/videos as filestore (where test videos actually exist)
    let filestore_path = PathBuf::from("fixtures/videos");
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

    let (router, _api) = create_router(state);

    axum::serve(listener, router).await?;

    Ok(())
}
