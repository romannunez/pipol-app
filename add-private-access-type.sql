-- Add private_access_type enum and column to events table
DO $$ 
BEGIN
    -- Create enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'private_access_type') THEN
        CREATE TYPE private_access_type AS ENUM ('solicitud', 'postulacion', 'paga');
    END IF;
END $$;

-- Add column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'private_access_type') THEN
        ALTER TABLE events ADD COLUMN private_access_type private_access_type DEFAULT 'solicitud';
    END IF;
END $$;