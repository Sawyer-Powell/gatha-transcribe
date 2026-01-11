-- Create videos table
CREATE TABLE videos (
    id TEXT PRIMARY KEY NOT NULL,
    file_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
);

-- Create index on uploaded_at for sorting
CREATE INDEX idx_videos_uploaded_at ON videos(uploaded_at);
