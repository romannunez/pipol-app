import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const createTables = async () => {
  console.log('Creating database tables...');

  const sql = `
    -- Create enums first
    DO $$ BEGIN
        CREATE TYPE event_category AS ENUM ('social', 'music', 'spiritual', 'education', 'sports', 'food', 'art', 'technology', 'games', 'outdoor', 'networking', 'workshop', 'conference', 'party', 'fair', 'exhibition');
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

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT,
      name TEXT NOT NULL,
      bio TEXT,
      avatar TEXT,
      supabase_id TEXT UNIQUE,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Events table
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category event_category NOT NULL,
      date TIMESTAMP NOT NULL,
      latitude DECIMAL(10, 6) NOT NULL,
      longitude DECIMAL(10, 6) NOT NULL,
      location_name TEXT NOT NULL,
      location_address TEXT NOT NULL,
      payment_type payment_type NOT NULL DEFAULT 'free',
      price DECIMAL(10, 2),
      max_capacity INTEGER,
      privacy_type privacy_type NOT NULL DEFAULT 'public',
      private_access_type private_access_type,
      application_questions TEXT,
      photo_url TEXT,
      photo_urls TEXT,
      video_url TEXT,
      video_urls TEXT,
      media_items TEXT,
      main_media_type multimedia_type DEFAULT 'photo',
      main_media_url TEXT,
      organizer_id INTEGER REFERENCES users(id) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Event attendees table
    CREATE TABLE IF NOT EXISTS event_attendees (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) NOT NULL,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      status attendee_status DEFAULT 'approved' NOT NULL,
      payment_status TEXT DEFAULT 'pending',
      payment_intent_id TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- User interests table
    CREATE TABLE IF NOT EXISTS user_interests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      category event_category NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Create indexes for performance (only if they don't exist)
    CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
    CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
    CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
    CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('Error creating tables:', error);
      return false;
    }
    
    console.log('Database tables created successfully!');
    return true;
  } catch (error) {
    console.error('Error executing SQL:', error);
    return false;
  }
};

// Run the setup
createTables().then(success => {
  if (success) {
    console.log('Database setup completed successfully!');
  } else {
    console.log('Database setup failed.');
  }
  process.exit(success ? 0 : 1);
});