#!/bin/bash

# Create remaining tables for Pipol application
export PGPASSWORD="${DATABASE_PASSWORD}"

psql -h aws-0-sa-east-1.pooler.supabase.com -p 6543 -U postgres.pbvkjkjdtwftjetpreai -d postgres << 'EOF'

-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    location_name TEXT NOT NULL,
    location_address TEXT NOT NULL,
    payment_type TEXT NOT NULL DEFAULT 'free',
    price NUMERIC(10, 2),
    max_capacity INTEGER,
    privacy_type TEXT NOT NULL DEFAULT 'public',
    organizer_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    media_items JSONB DEFAULT '[]'::jsonb,
    main_media_url TEXT,
    main_media_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create attendees table
CREATE TABLE IF NOT EXISTS public.attendees (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(event_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON public.events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);
CREATE INDEX IF NOT EXISTS idx_events_location ON public.events(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_attendees_event_id ON public.attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_user_id ON public.attendees(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_event_id ON public.messages(event_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);

-- Enable RLS on all tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Verify all tables exist
SELECT 'All tables created successfully' as result;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

EOF

echo "All database tables created successfully"