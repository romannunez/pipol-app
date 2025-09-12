import { sql } from 'drizzle-orm';
import { db } from '@db';
import * as schema from '@shared/schema';

async function initSchema() {
  console.log('Initializing database schema...');
  
  try {
    // Create enums first
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE event_category AS ENUM (
          'social', 'music', 'spiritual', 'education', 
          'sports', 'food', 'art', 'technology',
          'games', 'outdoor', 'networking', 'workshop',
          'conference', 'party', 'fair', 'exhibition'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE privacy_type AS ENUM ('public', 'private');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE private_access_type AS ENUM ('solicitud', 'postulacion', 'paga');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE payment_type AS ENUM ('free', 'paid');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE multimedia_type AS ENUM ('photo', 'video');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    
    console.log('Created enum types');
    
    // Create tables one by one
    // Users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        bio TEXT,
        avatar TEXT,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Created users table');
    
    // Events table
    await db.execute(sql`
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
    `);
    
    console.log('Created events table');
    
    // Event Attendees table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS event_attendees (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        status attendee_status NOT NULL DEFAULT 'approved',
        payment_status TEXT DEFAULT 'pending',
        payment_intent_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Created event_attendees table');
    
    // User Interests table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_interests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        category event_category NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Created user_interests table');
    
    console.log('Database schema initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}

initSchema()
  .then(() => {
    console.log('Schema initialization completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Schema initialization failed:', error);
    process.exit(1);
  });