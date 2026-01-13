mod common;

use common::{create_test_state, start_test_server};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

#[tokio::test]
async fn test_session_persists_on_disconnect() {
    // Test that session changes are saved to DB when WebSocket disconnects
    let (state, _db_dir, _filestore_dir) = create_test_state().await;
    let base_url = start_test_server(state.clone()).await;

    // Register user
    let client = reqwest::Client::new();
    let register_response = client
        .post(format!("{}/api/auth/register", base_url))
        .json(&serde_json::json!({
            "name": "Test User",
            "email": "test@example.com",
            "password": "password123"
        }))
        .send()
        .await
        .unwrap();

    let cookie_header = register_response
        .headers()
        .get("set-cookie")
        .unwrap()
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string();

    // Upload video
    let video_data = vec![0u8; 1024];
    let part = reqwest::multipart::Part::bytes(video_data)
        .file_name("test.mp4".to_string())
        .mime_str("video/mp4")
        .unwrap();
    let form = reqwest::multipart::Form::new().part("video", part);

    let upload_response = client
        .post(format!("{}/api/videos/upload", base_url))
        .header("Cookie", &cookie_header)
        .multipart(form)
        .send()
        .await
        .unwrap();

    let upload_json: serde_json::Value = upload_response.json().await.unwrap();
    let video_id = upload_json["id"].as_str().unwrap().to_string();

    // Get user_id for DB verification
    let user = state
        .db
        .get_user_by_email("test@example.com")
        .await
        .unwrap()
        .unwrap();

    // Verify no session exists in DB yet
    let initial_db_session = state.db.get_session(&user.id, &video_id).await.unwrap();
    assert!(initial_db_session.is_none(), "Session should not exist in DB initially");

    // Connect WebSocket
    let ws_url = base_url.replace("http://", "ws://");
    let full_url = format!("{}/ws/{}", ws_url, video_id);
    let mut ws_request =
        tokio_tungstenite::tungstenite::client::IntoClientRequest::into_client_request(&full_url)
            .unwrap();
    ws_request
        .headers_mut()
        .insert("Cookie", cookie_header.parse().unwrap());

    let (ws_stream, _) = connect_async(ws_request).await.unwrap();
    let (mut write, mut read) = ws_stream.split();

    // Read initial messages (VideoMetadata and StateSync)
    for _ in 0..2 {
        let _ = read.next().await.unwrap().unwrap();
    }

    // Send playback updates to make session dirty
    let update = serde_json::json!({
        "type": "UpdatePlaybackPosition",
        "current_time": 123.45,
        "version": 1
    });
    write.send(Message::Text(update.to_string().into())).await.unwrap();

    // Wait for processing
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    // Close WebSocket (triggers persistence)
    write.send(Message::Close(None)).await.unwrap();
    drop(write);
    drop(read);

    // Wait for cleanup to complete
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Verify session was persisted to DB
    let persisted_json = state
        .db
        .get_session(&user.id, &video_id)
        .await
        .unwrap()
        .expect("Session should be persisted to DB after disconnect");

    let persisted: serde_json::Value = serde_json::from_str(&persisted_json).unwrap();
    assert_eq!(persisted["current_time"].as_f64().unwrap(), 123.45);
    assert_eq!(persisted["version"].as_i64().unwrap(), 1);

    println!("✓ Session persisted to DB on disconnect");
}

#[tokio::test]
async fn test_session_loads_from_db_after_reconnect() {
    // Test full lifecycle: connect → update → disconnect → reconnect → state restored
    let (state, _db_dir, _filestore_dir) = create_test_state().await;
    let base_url = start_test_server(state.clone()).await;

    // Register user
    let client = reqwest::Client::new();
    let register_response = client
        .post(format!("{}/api/auth/register", base_url))
        .json(&serde_json::json!({
            "name": "Test User 2",
            "email": "test2@example.com",
            "password": "password123"
        }))
        .send()
        .await
        .unwrap();

    let cookie_header = register_response
        .headers()
        .get("set-cookie")
        .unwrap()
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string();

    // Upload video
    let video_data = vec![0u8; 1024];
    let part = reqwest::multipart::Part::bytes(video_data)
        .file_name("test2.mp4".to_string())
        .mime_str("video/mp4")
        .unwrap();
    let form = reqwest::multipart::Form::new().part("video", part);

    let upload_response = client
        .post(format!("{}/api/videos/upload", base_url))
        .header("Cookie", &cookie_header)
        .multipart(form)
        .send()
        .await
        .unwrap();

    let upload_json: serde_json::Value = upload_response.json().await.unwrap();
    let video_id = upload_json["id"].as_str().unwrap().to_string();

    // === FIRST CONNECTION: Update session ===
    let ws_url = base_url.replace("http://", "ws://");
    let full_url = format!("{}/ws/{}", ws_url, video_id);
    let mut ws_request =
        tokio_tungstenite::tungstenite::client::IntoClientRequest::into_client_request(&full_url)
            .unwrap();
    ws_request
        .headers_mut()
        .insert("Cookie", cookie_header.parse().unwrap());

    let (ws_stream, _) = connect_async(ws_request).await.unwrap();
    let (mut write, mut read) = ws_stream.split();

    // Read initial messages
    for _ in 0..2 {
        let _ = read.next().await.unwrap().unwrap();
    }

    // Send multiple updates
    let update1 = serde_json::json!({
        "type": "UpdatePlaybackPosition",
        "current_time": 42.5,
        "version": 1
    });
    write.send(Message::Text(update1.to_string().into())).await.unwrap();

    let update2 = serde_json::json!({
        "type": "UpdatePlaybackSpeed",
        "playback_speed": 1.5,
        "version": 2
    });
    write.send(Message::Text(update2.to_string().into())).await.unwrap();

    let update3 = serde_json::json!({
        "type": "UpdateVolume",
        "volume": 0.8,
        "version": 3
    });
    write.send(Message::Text(update3.to_string().into())).await.unwrap();

    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    // Close connection (triggers persistence)
    write.send(Message::Close(None)).await.unwrap();
    drop(write);
    drop(read);

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // === SECOND CONNECTION: Verify state restored ===
    let mut ws_request2 =
        tokio_tungstenite::tungstenite::client::IntoClientRequest::into_client_request(&full_url)
            .unwrap();
    ws_request2
        .headers_mut()
        .insert("Cookie", cookie_header.parse().unwrap());

    let (ws_stream2, _) = connect_async(ws_request2).await.unwrap();
    let (_write2, mut read2) = ws_stream2.split();

    // Wait for StateSync message
    let mut state_sync_found = false;
    for _ in 0..3 {
        let msg = tokio::time::timeout(tokio::time::Duration::from_secs(2), read2.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();

        if let Message::Text(text) = msg {
            let parsed: serde_json::Value = serde_json::from_str(&text).unwrap();

            if parsed["type"].as_str() == Some("StateSync") {
                let session = &parsed["session"];

                // Verify all persisted state was restored
                assert_eq!(session["current_time"].as_f64().unwrap(), 42.5);
                assert_eq!(session["playback_speed"].as_f64().unwrap(), 1.5);
                assert_eq!(session["volume"].as_f64().unwrap(), 0.8);
                assert_eq!(session["version"].as_i64().unwrap(), 3);

                state_sync_found = true;
                println!("✓ Session state restored from DB after reconnect:");
                println!("  current_time: 42.5");
                println!("  playback_speed: 1.5");
                println!("  volume: 0.8");
                println!("  version: 3");
                break;
            }
        }
    }

    assert!(state_sync_found, "Should receive StateSync with persisted state");
}

#[tokio::test]
async fn test_clean_session_not_persisted() {
    // Test that a session with no updates (dirty=false) is not persisted to DB
    let (state, _db_dir, _filestore_dir) = create_test_state().await;
    let base_url = start_test_server(state.clone()).await;

    // Register user
    let client = reqwest::Client::new();
    let register_response = client
        .post(format!("{}/api/auth/register", base_url))
        .json(&serde_json::json!({
            "name": "Test User 3",
            "email": "test3@example.com",
            "password": "password123"
        }))
        .send()
        .await
        .unwrap();

    let cookie_header = register_response
        .headers()
        .get("set-cookie")
        .unwrap()
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string();

    // Upload video
    let video_data = vec![0u8; 1024];
    let part = reqwest::multipart::Part::bytes(video_data)
        .file_name("test3.mp4".to_string())
        .mime_str("video/mp4")
        .unwrap();
    let form = reqwest::multipart::Form::new().part("video", part);

    let upload_response = client
        .post(format!("{}/api/videos/upload", base_url))
        .header("Cookie", &cookie_header)
        .multipart(form)
        .send()
        .await
        .unwrap();

    let upload_json: serde_json::Value = upload_response.json().await.unwrap();
    let video_id = upload_json["id"].as_str().unwrap().to_string();

    let user = state
        .db
        .get_user_by_email("test3@example.com")
        .await
        .unwrap()
        .unwrap();

    // Connect WebSocket but don't send any updates
    let ws_url = base_url.replace("http://", "ws://");
    let full_url = format!("{}/ws/{}", ws_url, video_id);
    let mut ws_request =
        tokio_tungstenite::tungstenite::client::IntoClientRequest::into_client_request(&full_url)
            .unwrap();
    ws_request
        .headers_mut()
        .insert("Cookie", cookie_header.parse().unwrap());

    let (ws_stream, _) = connect_async(ws_request).await.unwrap();
    let (mut write, mut read) = ws_stream.split();

    // Read initial messages
    for _ in 0..2 {
        let _ = read.next().await.unwrap().unwrap();
    }

    // Close immediately without sending updates
    write.send(Message::Close(None)).await.unwrap();
    drop(write);
    drop(read);

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Verify session was NOT persisted to DB (clean session optimization)
    let db_session = state.db.get_session(&user.id, &video_id).await.unwrap();
    assert!(
        db_session.is_none(),
        "Clean session should not be persisted to DB"
    );

    println!("✓ Clean session skipped DB persistence (optimization)");
}
