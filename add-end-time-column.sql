-- Add end_time column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;

-- Update existing events with a default end time (2 hours after start)
UPDATE events 
SET end_time = date + INTERVAL '2 hours' 
WHERE end_time IS NULL;

-- Make end_time NOT NULL after setting defaults
ALTER TABLE events ALTER COLUMN end_time SET NOT NULL;