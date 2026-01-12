use serde::{Deserialize, Serialize};
use ts_rs::TS;

// ============================================================================
// Shared Session State (Single Source of Truth)
// ============================================================================

/// Session state - the canonical shape for all session data.
/// Used by: ServerMessage::StateSync, client SyncState, localStorage, etc.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct SessionState {
    pub current_time: f64,
    pub playback_speed: f64,
    pub volume: f64,
    #[ts(type = "number")]
    pub version: i64,
}

// ============================================================================
// Client → Server Messages
// ============================================================================

/// Playback position update (sent frequently during playback)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct PlaybackUpdate {
    pub current_time: f64,
    #[ts(type = "number")]
    pub version: i64,
}

/// Playback speed update (sent when user changes speed)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct PlaybackSpeedUpdate {
    pub playback_speed: f64,
    #[ts(type = "number")]
    pub version: i64,
}

/// Volume update (sent when user changes volume)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct VolumeUpdate {
    pub volume: f64,
    #[ts(type = "number")]
    pub version: i64,
}

// ============================================================================
// Server → Client Messages
// ============================================================================

/// Messages sent from server to client
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum ServerMessage {
    TestMessage { text: String },
    /// Initial state sync on connection - uses typed SessionState
    StateSync { session: SessionState },
    VideoMetadata {
        #[ts(type = "number | null")]
        width: Option<i64>,
        #[ts(type = "number | null")]
        height: Option<i64>,
        duration_seconds: Option<f64>,
    },
}

/// Messages sent from client to server
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum ClientMessage {
    /// Regular playback position updates (throttled on client)
    UpdatePlaybackPosition(PlaybackUpdate),
    /// Playback speed change
    UpdatePlaybackSpeed(PlaybackSpeedUpdate),
    /// Volume change
    UpdateVolume(VolumeUpdate),
    /// Authoritative state sync from client (used when client wins conflict resolution)
    SyncState(SessionState),
}
