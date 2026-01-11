use gatha_transcribe::{create_router, db::Database, filestore::LocalFileStore, upload::AppState};
use reqwest::Client;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::net::TcpListener;

/// Helper to create test app state with temporary database and filestore
async fn create_test_state() -> (Arc<AppState>, TempDir, TempDir) {
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

    let state = Arc::new(AppState {
        db,
        filestore: Arc::new(filestore),
    });

    (state, db_dir, filestore_dir)
}

/// Start server on a random available port
async fn start_test_server(state: Arc<AppState>) -> String {
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

#[tokio::test]
async fn test_full_auth_flow() {
    // This ONE test covers: register, duplicate email, login, /me endpoint, logout
    let (state, _db_dir, _filestore_dir) = create_test_state().await;
    let base_url = start_test_server(state.clone()).await;
    let client = Client::builder()
        .cookie_store(true) // Persist cookies across requests
        .build()
        .unwrap();

    // 1. Register new user
    let response = client
        .post(format!("{}/api/auth/register", base_url))
        .json(&serde_json::json!({
            "name": "Test User",
            "email": "test@example.com",
            "password": "password123"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let json: serde_json::Value = response.json().await.unwrap();
    assert_eq!(json["user"]["email"], "test@example.com");
    assert_eq!(json["user"]["name"], "Test User");
    assert_eq!(json["message"], "Registration successful");

    // Verify database: bcrypt hash, user saved
    let user = state
        .db
        .get_user_by_email("test@example.com")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(user.name, "Test User");
    assert!(user.hashed_password.starts_with("$2b$")); // bcrypt

    // 2. Try duplicate email (should fail)
    let dup_response = client
        .post(format!("{}/api/auth/register", base_url))
        .json(&serde_json::json!({
            "name": "Duplicate",
            "email": "test@example.com",
            "password": "different"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(dup_response.status(), 400);

    // 3. Test /me endpoint (should work with cookie from registration)
    let me_response = client
        .get(format!("{}/api/auth/me", base_url))
        .send()
        .await
        .unwrap();
    assert_eq!(me_response.status(), 200);
    let me_json: serde_json::Value = me_response.json().await.unwrap();
    assert_eq!(me_json["email"], "test@example.com");

    // 4. Logout
    let logout_response = client
        .post(format!("{}/api/auth/logout", base_url))
        .send()
        .await
        .unwrap();
    assert_eq!(logout_response.status(), 200);

    // 5. Verify /me fails after logout
    let me_after_logout = client
        .get(format!("{}/api/auth/me", base_url))
        .send()
        .await
        .unwrap();
    assert_eq!(me_after_logout.status(), 401);

    // 6. Login again
    let login_response = client
        .post(format!("{}/api/auth/login", base_url))
        .json(&serde_json::json!({
            "email": "test@example.com",
            "password": "password123"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(login_response.status(), 200);
    let login_json: serde_json::Value = login_response.json().await.unwrap();
    assert_eq!(login_json["user"]["email"], "test@example.com");
    assert_eq!(login_json["message"], "Login successful");

    // 7. Verify /me works after login
    let me_after_login = client
        .get(format!("{}/api/auth/me", base_url))
        .send()
        .await
        .unwrap();
    assert_eq!(me_after_login.status(), 200);
}

#[tokio::test]
async fn test_auth_failures() {
    // This ONE test covers: invalid login, wrong password
    let (state, _db_dir, _filestore_dir) = create_test_state().await;
    let base_url = start_test_server(state.clone()).await;
    let client = Client::new();

    // 1. Login without registration
    let no_user_response = client
        .post(format!("{}/api/auth/login", base_url))
        .json(&serde_json::json!({
            "email": "nonexistent@example.com",
            "password": "password123"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(no_user_response.status(), 401);

    // 2. Register user
    client
        .post(format!("{}/api/auth/register", base_url))
        .json(&serde_json::json!({
            "name": "Test User",
            "email": "test@example.com",
            "password": "correctpassword"
        }))
        .send()
        .await
        .unwrap();

    // 3. Login with wrong password
    let wrong_pass_response = client
        .post(format!("{}/api/auth/login", base_url))
        .json(&serde_json::json!({
            "email": "test@example.com",
            "password": "wrongpassword"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(wrong_pass_response.status(), 401);
}
