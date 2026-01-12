use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, State, WebSocketUpgrade,
    },
    response::Response,
};
use futures_util::sink::SinkExt;
use std::sync::Arc;
use tracing::{error, info, warn};

use crate::{
    auth::AuthUser,
    messages::{ClientMessage, ServerMessage, SessionState},
    session_store::{SessionKey, TranscriptionSession},
    upload::AppState,
};

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

    // Get video metadata from database
    let video = match state.db.get_video(&video_id).await {
        Ok(Some(v)) => v,
        Ok(None) => {
            error!(
                user_id = %user_id,
                video_id = %video_id,
                "Video not found"
            );
            let _ = socket.close().await;
            return;
        }
        Err(e) => {
            error!(
                user_id = %user_id,
                video_id = %video_id,
                error = %e,
                "Failed to get video"
            );
            let _ = socket.close().await;
            return;
        }
    };

    // Send video metadata to client (for immediate sizing)
    if let Err(e) = send_video_metadata(&mut socket, &video).await {
        error!(
            user_id = %user_id,
            video_id = %video_id,
            error = %e,
            "Failed to send video metadata"
        );
        return;
    }

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
        playback_speed: 1.0,
        volume: 1.0,
        version: 0,
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

/// Send video metadata to client
async fn send_video_metadata(
    socket: &mut WebSocket,
    video: &crate::db::Video,
) -> Result<(), String> {
    let msg = ServerMessage::VideoMetadata {
        width: video.width,
        height: video.height,
        duration_seconds: video.duration_seconds,
    };

    let json = serde_json::to_string(&msg).map_err(|e| format!("JSON error: {}", e))?;

    socket
        .send(Message::Text(json.into()))
        .await
        .map_err(|e| format!("Send error: {}", e))
}

/// Send state sync to client
async fn send_state_sync(
    socket: &mut WebSocket,
    session: &TranscriptionSession,
) -> Result<(), String> {
    let msg = ServerMessage::StateSync {
        session: SessionState {
            current_time: session.current_time,
            playback_speed: session.playback_speed,
            volume: session.volume,
            version: session.version,
        },
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
        ClientMessage::UpdatePlaybackPosition(playback) => {
            // Get current session
            let mut session = state
                .session_store
                .get(session_key)
                .await
                .map_err(|e| format!("Store error: {}", e))?
                .ok_or_else(|| "Session not found".to_string())?;

            // Only apply update if client version is newer
            if playback.version >= session.version {
                session.current_time = playback.current_time;
                session.version = playback.version;
                session.dirty = true;

                state
                    .session_store
                    .set(session_key, session)
                    .await
                    .map_err(|e| format!("Store error: {}", e))?;

                info!(
                    user_id = %session_key.0,
                    video_id = %session_key.1,
                    current_time = %playback.current_time,
                    version = %playback.version,
                    "Updated playback position"
                );
            }

            Ok(())
        }

        ClientMessage::UpdatePlaybackSpeed(update) => {
            let mut session = state
                .session_store
                .get(session_key)
                .await
                .map_err(|e| format!("Store error: {}", e))?
                .ok_or_else(|| "Session not found".to_string())?;

            if update.version >= session.version {
                session.playback_speed = update.playback_speed;
                session.version = update.version;
                session.dirty = true;

                state
                    .session_store
                    .set(session_key, session)
                    .await
                    .map_err(|e| format!("Store error: {}", e))?;

                info!(
                    user_id = %session_key.0,
                    video_id = %session_key.1,
                    playback_speed = %update.playback_speed,
                    version = %update.version,
                    "Updated playback speed"
                );
            }

            Ok(())
        }

        ClientMessage::UpdateVolume(update) => {
            let mut session = state
                .session_store
                .get(session_key)
                .await
                .map_err(|e| format!("Store error: {}", e))?
                .ok_or_else(|| "Session not found".to_string())?;

            if update.version >= session.version {
                session.volume = update.volume;
                session.version = update.version;
                session.dirty = true;

                state
                    .session_store
                    .set(session_key, session)
                    .await
                    .map_err(|e| format!("Store error: {}", e))?;

                info!(
                    user_id = %session_key.0,
                    video_id = %session_key.1,
                    volume = %update.volume,
                    version = %update.version,
                    "Updated volume"
                );
            }

            Ok(())
        }

        ClientMessage::SyncState(client_state) => {
            // Authoritative sync from client - always accept (client won conflict resolution)
            let mut session = state
                .session_store
                .get(session_key)
                .await
                .map_err(|e| format!("Store error: {}", e))?
                .ok_or_else(|| "Session not found".to_string())?;

            info!(
                user_id = %session_key.0,
                video_id = %session_key.1,
                current_time = %client_state.current_time,
                playback_speed = %client_state.playback_speed,
                volume = %client_state.volume,
                version = %client_state.version,
                old_version = %session.version,
                "Accepting authoritative state sync from client"
            );

            session.current_time = client_state.current_time;
            session.playback_speed = client_state.playback_speed;
            session.volume = client_state.volume;
            session.version = client_state.version;
            session.dirty = true;

            // Store updated session
            state
                .session_store
                .set(session_key, session)
                .await
                .map_err(|e| format!("Store error: {}", e))?;

            Ok(())
        }
    }
}
