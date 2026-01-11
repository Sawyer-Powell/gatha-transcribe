mod common;

use common::{create_test_state, start_test_server};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

#[tokio::test]
async fn test_websocket_sends_state_sync_on_connect() {
    let (state, _db_dir, _filestore_dir) = create_test_state().await;
    let base_url = start_test_server(state.clone()).await;

    // Register user and capture auth cookie from response
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

    assert_eq!(register_response.status(), 200);

    // Extract auth cookie from Set-Cookie header
    let cookie_header = register_response
        .headers()
        .get("set-cookie")
        .expect("No Set-Cookie header in registration response")
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string();

    // Upload a test video to get video_id (include auth cookie)
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

    assert_eq!(upload_response.status(), 200);
    let upload_json: serde_json::Value = upload_response.json().await.unwrap();
    let video_id = upload_json["id"].as_str().unwrap();

    // Connect WebSocket with auth cookie
    let ws_url = base_url.replace("http://", "ws://");
    let full_url = format!("{}/ws/{}", ws_url, video_id);

    // Use the IntoClientRequest trait to properly set WebSocket headers
    let mut ws_request = tokio_tungstenite::tungstenite::client::IntoClientRequest::into_client_request(&full_url).unwrap();
    ws_request.headers_mut().insert("Cookie", cookie_header.parse().unwrap());

    let (ws_stream, _) = connect_async(ws_request).await.unwrap();
    let (_write, mut read) = ws_stream.split();

    // Wait for StateSync message
    let msg = tokio::time::timeout(
        tokio::time::Duration::from_secs(2),
        read.next()
    )
    .await
    .expect("Timeout waiting for StateSync")
    .expect("WebSocket closed")
    .expect("WebSocket error");

    // Verify message structure
    if let Message::Text(text) = msg {
        let parsed: serde_json::Value = serde_json::from_str(&text).unwrap();

        // Verify it's a StateSync message
        assert_eq!(parsed["type"], "StateSync");

        // Verify session structure
        let session = &parsed["session"];
        assert!(session.is_object(), "session should be an object");

        // Verify current_time field exists and is a number
        assert!(session["current_time"].is_f64() || session["current_time"].is_i64(),
                "current_time should be a number");

        // For new session, current_time should be 0
        assert_eq!(session["current_time"].as_f64().unwrap(), 0.0);

        println!("✓ StateSync message verified:");
        println!("  Format: {}", serde_json::to_string_pretty(&parsed).unwrap());
    } else {
        panic!("Expected text message, got binary");
    }
}

#[tokio::test]
async fn test_websocket_receives_playback_update() {
    let (state, _db_dir, _filestore_dir) = create_test_state().await;
    let base_url = start_test_server(state.clone()).await;

    // Register user and capture auth cookie from response
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

    assert_eq!(register_response.status(), 200);

    // Extract auth cookie from Set-Cookie header
    let cookie_header = register_response
        .headers()
        .get("set-cookie")
        .expect("No Set-Cookie header in registration response")
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string();

    // Upload a test video (include auth cookie)
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
    let video_id = upload_json["id"].as_str().unwrap();

    // Connect WebSocket
    let ws_url = base_url.replace("http://", "ws://");
    let full_url = format!("{}/ws/{}", ws_url, video_id);

    // Use the IntoClientRequest trait to properly set WebSocket headers
    let mut ws_request = tokio_tungstenite::tungstenite::client::IntoClientRequest::into_client_request(&full_url).unwrap();
    ws_request.headers_mut().insert("Cookie", cookie_header.parse().unwrap());

    let (ws_stream, _) = connect_async(ws_request).await.unwrap();
    let (mut write, mut read) = ws_stream.split();

    // Read initial StateSync
    let _ = read.next().await.unwrap().unwrap();

    // Send playback position update
    let update = serde_json::json!({
        "type": "UpdatePlaybackPosition",
        "current_time": 42.5
    });
    write.send(Message::Text(update.to_string().into())).await.unwrap();

    // Give server time to process
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Verify state was updated in session store (in-memory)
    let user_result = state.db.get_user_by_email("test2@example.com").await.unwrap();
    let user = user_result.expect("User should exist");

    let session_key = (user.id.clone(), video_id.to_string());
    let session = state
        .session_store
        .get(&session_key)
        .await
        .unwrap()
        .expect("Session should exist in session store");

    assert_eq!(session.current_time, 42.5);

    println!("✓ Playback update received and stored in session store");
}
