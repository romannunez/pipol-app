-- Execute this SQL in your Supabase Dashboard > SQL Editor
-- This will fix all missing database schema elements

-- Step 1: Create all required enum types
DO $$ BEGIN
    CREATE TYPE event_category AS ENUM (
        'social', 'music', 'spiritual', 'education', 
        'sports', 'food', 'art', 'technology',
        'games', 'outdoor', 'networking', 'workshop',
        'conference', 'party', 'fair', 'exhibition'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE privacy_type AS ENUM ('public', 'private');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE private_access_type AS ENUM ('solicitud', 'postulacion', 'paga');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM ('free', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE multimedia_type AS ENUM ('photo', 'video');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add missing columns to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS private_access_type private_access_type,
ADD COLUMN IF NOT EXISTS application_questions TEXT,
ADD COLUMN IF NOT EXISTS photo_urls TEXT,
ADD COLUMN IF NOT EXISTS video_urls TEXT,
ADD COLUMN IF NOT EXISTS media_items TEXT,
ADD COLUMN IF NOT EXISTS main_media_type multimedia_type DEFAULT 'photo',
ADD COLUMN IF NOT EXISTS main_media_url TEXT;

-- Step 3: Create the event_attendees table
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

-- Step 4: Create user_interests table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_interests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category event_category NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_privacy_type ON events(privacy_type);
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_status ON event_attendees(status);

CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_category ON user_interests(category);

-- Step 6: Add table comments
COMMENT ON TABLE event_attendees IS 'Junction table for managing event attendance and registration status';
COMMENT ON TABLE user_interests IS 'Table for storing user interests for future recommendations';

-- Step 7: Verification queries
SELECT 'Database schema update completed successfully' as status;

-- Check if all tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('events', 'users', 'event_attendees', 'user_interests') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('events', 'users', 'event_attendees', 'user_interests')
ORDER BY table_name;