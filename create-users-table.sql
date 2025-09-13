-- Essential SQL to fix registration - Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.users (
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON public.users(supabase_id);

-- Set up Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY IF NOT EXISTS "Enable insert for registration" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid()::text = supabase_id);

CREATE POLICY IF NOT EXISTS "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid()::text = supabase_id);