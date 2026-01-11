use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, State, WebSocketUpgrade,
    },
    response::Response,
};
use chrono::Utc;
use futures_util::sink::SinkExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};

use crate::{
    auth::AuthUser,
    messages::ServerMessage,
    session_store::{SessionKey, TranscriptionSession},
    upload::AppState,
};

/// Client message types
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    UpdatePlaybackPosition { current_time: f64 },
}

/// WebSocket handler with auth and video_id
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(video_id): Path<String>,
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
) -> Response {
    info!(
        user_id = %auth_user.user_id,
        video_id = %video_id,
        "WebSocket connection upgrading"
    );

    ws.on_upgrade(move |socket| handle_socket(socket, state, auth_user.user_id, video_id))
}

async fn handle_socket(
    mut socket: WebSocket,
    state: Arc<AppState>,
    user_id: String,
    video_id: String,
) {
    let session_key: SessionKey = (user_id.clone(), video_id.clone());

    info!(
        user_id = %user_id,
        video_id = %video_id,
        "WebSocket connection established"
    );

    // Load or create session
    let session = match load_or_create_session(&state, &session_key).await {
        Ok(s) => s,
        Err(e) => {
            error!(
                user_id = %user_id,
                video_id = %video_id,
                error = %e,
                "Failed to load/create session"
            );
            let _ = socket.close().await;
            return;
        }
    };

    // Send initial state to client
    if let Err(e) = send_state_sync(&mut socket, &session).await {
        error!(
            user_id = %user_id,
            video_id = %video_id,
            error = %e,
            "Failed to send initial state"
        );
        return;
    }

    // Handle incoming messages
    loop {
        match socket.recv().await {
            Some(Ok(Message::Text(text))) => {
                if let Err(e) = handle_text_message(&text, &state, &session_key).await {
                    warn!(
                        user_id = %user_id,
                        video_id = %video_id,
                        error = %e,
                        "Error handling message"
                    );
                }
            }
            Some(Ok(Message::Close(_))) => {
                info!(
                    user_id = %user_id,
                    video_id = %video_id,
                    "WebSocket closed by client"
                );
                break;
            }
            Some(Err(e)) => {
                warn!(
                    user_id = %user_id,
                    video_id = %video_id,
                    error = %e,
                    "WebSocket error"
                );
                break;
            }
            None => {
                info!(
                    user_id = %user_id,
                    video_id = %video_id,
                    "WebSocket connection closed"
                );
                break;
            }
            _ => {} // Ignore other message types
        }
    }

    // Connection closed - persist final state and cleanup
    info!(
        user_id = %user_id,
        video_id = %video_id,
        "WebSocket disconnected, cleaning up session"
    );

    // Get final session state
    if let Ok(Some(session)) = state.session_store.get(&session_key).await {
        // Persist final state if dirty
        if session.dirty {
            match serde_json::to_string(&session) {
                Ok(state_json) => {
                    if let Err(e) = state.db.upsert_session(&user_id, &video_id, &state_json).await {
                        warn!(
                            user_id = %user_id,
                            video_id = %video_id,
                            error = %e,
                            "Failed to persist final session state"
                        );
                    } else {
                        info!(
                            user_id = %user_id,
                            video_id = %video_id,
                            "Persisted final session state"
                        );
                    }
                }
                Err(e) => {
                    error!(
                        user_id = %user_id,
                        video_id = %video_id,
                        error = %e,
                        "Failed to serialize final session state"
                    );
                }
            }
        }
    }

    // Remove session from memory
    if let Err(e) = state.session_store.delete(&session_key).await {
        warn!(
            user_id = %user_id,
            video_id = %video_id,
            error = %e,
            "Failed to delete session from memory"
        );
    } else {
        info!(
            user_id = %user_id,
            video_id = %video_id,
            "Removed session from memory"
        );
    }
}

/// Load session from memory or DB, or create new
async fn load_or_create_session(
    state: &Arc<AppState>,
    session_key: &SessionKey,
) -> Result<TranscriptionSession, String> {
    let (user_id, video_id) = session_key;

    // Try memory first
    if let Ok(Some(session)) = state.session_store.get(session_key).await {
        info!(
            user_id = %user_id,
            video_id = %video_id,
            "Loaded session from memory"
        );
        return Ok(session);
    }

    // Try database
    match state.db.get_session(user_id, video_id).await {
        Ok(Some(state_json)) => {
            match serde_json::from_str::<TranscriptionSession>(&state_json) {
                Ok(mut session) => {
                    info!(
                        user_id = %user_id,
                        video_id = %video_id,
                        "Loaded session from database"
                    );
                    // Mark as clean since we just loaded from DB
                    session.dirty = false;
                    // Store in memory
                    let _ = state.session_store.set(session_key, session.clone()).await;
                    return Ok(session);
                }
                Err(e) => {
                    warn!(
                        user_id = %user_id,
                        video_id = %video_id,
                        error = %e,
                        "Failed to deserialize session from DB, creating new"
                    );
                }
            }
        }
        Ok(None) => {
            info!(
                user_id = %user_id,
                video_id = %video_id,
                "No existing session found"
            );
        }
        Err(e) => {
            warn!(
                user_id = %user_id,
                video_id = %video_id,
                error = %e,
                "Database error loading session"
            );
        }
    }

    // Create new session
    let session = TranscriptionSession {
        user_id: user_id.clone(),
        video_id: video_id.clone(),
        current_time: 0.0,
        updated_at: Utc::now(),
        dirty: false, // New session, not dirty yet
    };

    info!(
        user_id = %user_id,
        video_id = %video_id,
        "Created new session"
    );

    // Store in memory
    state
        .session_store
        .set(session_key, session.clone())
        .await
        .map_err(|e| format!("Failed to store session: {}", e))?;

    Ok(session)
}

/// Send state sync to client
async fn send_state_sync(
    socket: &mut WebSocket,
    session: &TranscriptionSession,
) -> Result<(), String> {
    #[derive(Serialize)]
    struct StateSyncMessage {
        current_time: f64,
    }

    let session_data = StateSyncMessage {
        current_time: session.current_time,
    };

    let session_value = serde_json::to_value(session_data).map_err(|e| format!("JSON error: {}", e))?;

    let msg = ServerMessage::StateSync {
        session: session_value,
    };

    let json = serde_json::to_string(&msg).map_err(|e| format!("JSON error: {}", e))?;

    socket
        .send(Message::Text(json.into()))
        .await
        .map_err(|e| format!("Send error: {}", e))
}

/// Handle text message from client
async fn handle_text_message(
    text: &str,
    state: &Arc<AppState>,
    session_key: &SessionKey,
) -> Result<(), String> {
    let msg: ClientMessage =
        serde_json::from_str(text).map_err(|e| format!("Parse error: {}", e))?;

    match msg {
        ClientMessage::UpdatePlaybackPosition { current_time } => {
            // Get current session
            let mut session = state
                .session_store
                .get(session_key)
                .await
                .map_err(|e| format!("Store error: {}", e))?
                .ok_or_else(|| "Session not found".to_string())?;

            // Update playback position
            session.current_time = current_time;
            session.updated_at = Utc::now();
            session.dirty = true; // Mark as dirty for persistence

            // Store updated session
            state
                .session_store
                .set(session_key, session)
                .await
                .map_err(|e| format!("Store error: {}", e))?;

            info!(
                user_id = %session_key.0,
                video_id = %session_key.1,
                current_time = %current_time,
                "Updated playback position"
            );

            Ok(())
        }
    }
}
