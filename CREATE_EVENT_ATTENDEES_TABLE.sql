-- Create attendee_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create event_attendees table
CREATE TABLE IF NOT EXISTS event_attendees (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status attendee_status DEFAULT 'approved' NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    payment_intent_id TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(event_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_status ON event_attendees(status);

-- Insert a comment to track table creation
COMMENT ON TABLE event_attendees IS 'Junction table for managing event attendance and registration status';