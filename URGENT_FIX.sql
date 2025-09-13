-- URGENT DATABASE FIX FOR PIPOL APPLICATION
-- Execute this SQL in Supabase Dashboard > SQL Editor to complete the database setup

-- Step 1: Create all required enum types (safe - won't error if they exist)
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
    CREATE TYPE payment_type AS ENUM ('free', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Create event_attendees table (required for events API)
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

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- Step 4: Insert sample events for testing (only if no events exist)
INSERT INTO events (
    title, description, category, date, latitude, longitude, 
    location_name, location_address, payment_type, price, 
    max_capacity, privacy_type, organizer_id, created_at, updated_at
)
SELECT 
    'Evento de Prueba en Córdoba',
    'Un evento de prueba para verificar que la aplicación Pipol funciona correctamente. Este evento muestra la funcionalidad básica del mapa y la creación de eventos.',
    'social'::event_category,
    NOW() + INTERVAL '7 days',
    -31.4201,
    -64.1888,
    'Centro de Córdoba',
    'Calle Rivadavia 100, Córdoba, Argentina',
    'free'::payment_type,
    0,
    50,
    'public'::privacy_type,
    (SELECT id FROM users LIMIT 1),
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM events LIMIT 1);

-- Step 5: Add sample attendee if event was created
INSERT INTO event_attendees (event_id, user_id, status, created_at)
SELECT 
    e.id,
    u.id,
    'approved'::attendee_status,
    NOW()
FROM events e, users u
WHERE NOT EXISTS (SELECT 1 FROM event_attendees LIMIT 1)
LIMIT 1;

-- Step 6: Verification queries
SELECT 'Database setup completed successfully!' as message;

SELECT 
    'Events table' as table_name,
    count(*) as row_count 
FROM events
UNION ALL
SELECT 
    'Event attendees table' as table_name,
    count(*) as row_count 
FROM event_attendees
UNION ALL
SELECT 
    'Users table' as table_name,
    count(*) as row_count 
FROM users;