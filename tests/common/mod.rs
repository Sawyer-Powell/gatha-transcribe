use gatha_transcribe::{
    create_router,
    db::Database,
    filestore::LocalFileStore,
    session_store::InMemorySessionStore,
    upload::AppState,
};
use reqwest::Client;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::net::TcpListener;

/// Helper to create test app state with temporary database and filestore
pub async fn create_test_state() -> (Arc<AppState>, TempDir, TempDir) {
    let db_dir = TempDir::new().unwrap();
    let filestore_dir = TempDir::new().unwrap();

    let db_path = db_dir.path().join("test.db");
    std::fs::File::create(&db_path).unwrap();

    let db_url = format!("sqlite:{}", db_path.display());
    let db = Database::new(&db_url).await.unwrap();
    db.run_migrations().await.unwrap();

    let filestore = LocalFileStore::new(filestore_dir.path().to_path_buf())
        .await
        .unwrap();

    let session_store = InMemorySessionStore::new();

    let state = Arc::new(AppState {
        db,
        filestore: Arc::new(filestore),
        session_store: Arc::new(session_store),
    });

    (state, db_dir, filestore_dir)
}

/// Start server on a random available port
pub async fn start_test_server(state: Arc<AppState>) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let base_url = format!("http://{}", addr);

    let (router, _api) = create_router(state);

    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    base_url
}

/// Register a test user and return an authenticated client with cookies
pub async fn create_authenticated_client(base_url: &str, email: &str, name: &str) -> Client {
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .unwrap();

    // Register user
    let response = client
        .post(format!("{}/api/auth/register", base_url))
        .json(&serde_json::json!({
            "name": name,
            "email": email,
            "password": "password123"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 200, "Failed to register test user");

    client
}
