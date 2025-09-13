#!/bin/bash

# Create users table using psql directly
export PGPASSWORD="${DATABASE_PASSWORD}"

psql -h aws-0-sa-east-1.pooler.supabase.com -p 6543 -U postgres.pbvkjkjdtwftjetpreai -d postgres << 'EOF'

-- Create users table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON public.users(supabase_id);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY IF NOT EXISTS "Enable insert for registration" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid()::text = supabase_id);

CREATE POLICY IF NOT EXISTS "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid()::text = supabase_id);

-- Verify table creation
SELECT 'Users table created successfully' as result;

EOF

echo "Database setup complete"