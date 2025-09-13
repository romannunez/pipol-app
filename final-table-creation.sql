-- Execute this SQL in your Supabase SQL Editor to create all required tables
-- This will fix the registration error completely

-- Drop existing tables if they exist (to ensure clean creation)
DROP TABLE IF EXISTS public.user_interests CASCADE;
DROP TABLE IF EXISTS public.event_attendees CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop existing types if they exist
DROP TYPE IF EXISTS event_category CASCADE;
DROP TYPE IF EXISTS privacy_type CASCADE;
DROP TYPE IF EXISTS private_access_type CASCADE;
DROP TYPE IF EXISTS payment_type CASCADE;
DROP TYPE IF EXISTS multimedia_type CASCADE;
DROP TYPE IF EXISTS attendee_status CASCADE;

-- Create enums
CREATE TYPE event_category AS ENUM ('social', 'music', 'spiritual', 'education', 'sports', 'food', 'art', 'technology', 'games', 'outdoor', 'networking', 'workshop', 'conference', 'party', 'fair', 'exhibition');
CREATE TYPE privacy_type AS ENUM ('public', 'private');
CREATE TYPE private_access_type AS ENUM ('solicitud', 'postulacion', 'paga');
CREATE TYPE payment_type AS ENUM ('free', 'paid');
CREATE TYPE multimedia_type AS ENUM ('photo', 'video');
CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected');

-- Create users table
CREATE TABLE public.users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    name TEXT NOT NULL,
    bio TEXT,
    avatar TEXT,
    supabase_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create events table
CREATE TABLE public.events (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category event_category NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
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
    organizer_id BIGINT REFERENCES public.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create event_attendees table
CREATE TABLE public.event_attendees (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT REFERENCES public.events(id) NOT NULL,
    user_id BIGINT REFERENCES public.users(id) NOT NULL,
    status attendee_status DEFAULT 'approved' NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    payment_intent_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create user_interests table
CREATE TABLE public.user_interests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(id) NOT NULL,
    category event_category NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_supabase_id ON public.users(supabase_id);
CREATE INDEX idx_events_category ON public.events(category);
CREATE INDEX idx_events_date ON public.events(date);
CREATE INDEX idx_events_organizer ON public.events(organizer_id);
CREATE INDEX idx_event_attendees_event ON public.event_attendees(event_id);
CREATE INDEX idx_event_attendees_user ON public.event_attendees(user_id);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Enable insert for registration" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid()::text = supabase_id);

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid()::text = supabase_id);

-- Create policies for events table
CREATE POLICY "Anyone can view public events" ON public.events
    FOR SELECT USING (privacy_type = 'public');

CREATE POLICY "Users can view their own events" ON public.events
    FOR SELECT USING (auth.uid()::text = (SELECT supabase_id FROM public.users WHERE id = organizer_id));

CREATE POLICY "Authenticated users can create events" ON public.events
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own events" ON public.events
    FOR UPDATE USING (auth.uid()::text = (SELECT supabase_id FROM public.users WHERE id = organizer_id));

-- Create policies for event_attendees table
CREATE POLICY "Users can view their own attendance" ON public.event_attendees
    FOR SELECT USING (auth.uid()::text = (SELECT supabase_id FROM public.users WHERE id = user_id));

CREATE POLICY "Authenticated users can register for events" ON public.event_attendees
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create policies for user_interests table
CREATE POLICY "Users can manage their own interests" ON public.user_interests
    FOR ALL USING (auth.uid()::text = (SELECT supabase_id FROM public.users WHERE id = user_id));

-- Verify table creation
SELECT 'All tables created successfully!' as result;