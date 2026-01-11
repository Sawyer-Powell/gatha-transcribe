CREATE TABLE transcription_sessions (
    user_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, video_id)
);

CREATE INDEX idx_sessions_video ON transcription_sessions(video_id);
CREATE INDEX idx_sessions_user ON transcription_sessions(user_id);
