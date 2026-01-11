-- Add user_id column to videos table
ALTER TABLE videos ADD COLUMN user_id TEXT NOT NULL DEFAULT '';

-- Create index on user_id for faster queries
CREATE INDEX idx_videos_user_id ON videos(user_id);
