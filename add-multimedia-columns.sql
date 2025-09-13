-- Add multimedia columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS media_items text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS main_media_type text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS main_media_url text;