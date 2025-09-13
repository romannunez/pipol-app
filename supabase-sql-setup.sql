-- Direct SQL commands for Supabase SQL Editor

-- Create enums for event categories
CREATE TYPE event_category AS ENUM (
  'social', 'music', 'spiritual', 'education', 
  'sports', 'food', 'art', 'technology',
  'games', 'outdoor', 'networking', 'workshop',
  'conference', 'party', 'fair', 'exhibition'
);

-- Create enums for privacy
CREATE TYPE privacy_type AS ENUM ('public', 'private');

-- Create enums for private event access type
CREATE TYPE private_access_type AS ENUM ('solicitud', 'postulacion', 'paga');

-- Create enums for payment type
CREATE TYPE payment_type AS ENUM ('free', 'paid');

-- Create enums for multimedia type
CREATE TYPE multimedia_type AS ENUM ('photo', 'video');

-- Create enums for attendee status
CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected');

-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password TEXT,
  name TEXT,
  bio TEXT,
  avatar TEXT,
  supabase_id UUID REFERENCES auth.users(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create Events Table
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
  organizer_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create Event Attendees Junction Table
CREATE TABLE IF NOT EXISTS event_attendees (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  status attendee_status NOT NULL DEFAULT 'approved',
  payment_status TEXT DEFAULT 'pending',
  payment_intent_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create User Interests Table
CREATE TABLE IF NOT EXISTS user_interests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  category event_category NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users are viewable by everyone" 
  ON users FOR SELECT 
  USING (true);

CREATE POLICY "Users can be updated by themselves" 
  ON users FOR UPDATE 
  USING (auth.uid() = supabase_id);

-- Create policies for events table
CREATE POLICY "Events are viewable by everyone" 
  ON events FOR SELECT 
  USING (true);

CREATE POLICY "Events can be inserted by authenticated users" 
  ON events FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = organizer_id 
    AND users.supabase_id = auth.uid()
  ));

CREATE POLICY "Events can be updated by their organizers" 
  ON events FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = organizer_id 
    AND users.supabase_id = auth.uid()
  ));

CREATE POLICY "Events can be deleted by their organizers" 
  ON events FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = organizer_id 
    AND users.supabase_id = auth.uid()
  ));

-- Create policies for event_attendees table
CREATE POLICY "Event attendees are viewable by everyone" 
  ON event_attendees FOR SELECT 
  USING (true);

CREATE POLICY "Users can register for events" 
  ON event_attendees FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = user_id 
    AND users.supabase_id = auth.uid()
  ));

CREATE POLICY "Users can update their attendance" 
  ON event_attendees FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = user_id 
    AND users.supabase_id = auth.uid()
  ));

CREATE POLICY "Users can delete their attendance" 
  ON event_attendees FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = user_id 
    AND users.supabase_id = auth.uid()
  ));

-- Create policies for user_interests table
CREATE POLICY "User interests are viewable by everyone" 
  ON user_interests FOR SELECT 
  USING (true);

CREATE POLICY "Users can manage their interests" 
  ON user_interests FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = user_id 
    AND users.supabase_id = auth.uid()
  ));

-- Create a function to link Supabase Auth users to our users table
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (username, email, name, supabase_id, created_at, updated_at)
  VALUES (
    NEW.email, -- temporary username based on email
    NEW.email,
    SPLIT_PART(NEW.email, '@', 1), -- username without domain as default name
    NEW.id,
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE
  SET supabase_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();