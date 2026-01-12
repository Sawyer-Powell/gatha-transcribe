-- Add metadata fields to videos table
ALTER TABLE videos ADD COLUMN width INTEGER;
ALTER TABLE videos ADD COLUMN height INTEGER;
ALTER TABLE videos ADD COLUMN duration_seconds REAL;
