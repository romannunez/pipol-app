// Script para crear el esquema de la base de datos usando pgSQL
import pkg from 'pg';
const { Client } = pkg;

async function createSchema() {
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();
    
    console.log('Conectado a la base de datos');
    
    // Crear los tipos ENUM
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE event_category AS ENUM (
          'social', 'music', 'spiritual', 'education', 'sports', 'food', 'art', 'technology',
          'games', 'outdoor', 'networking', 'workshop', 'conference', 'party', 'fair', 'exhibition'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE privacy_type AS ENUM ('public', 'private');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE private_access_type AS ENUM ('solicitud', 'postulacion', 'paga');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE payment_type AS ENUM ('free', 'paid');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE multimedia_type AS ENUM ('photo', 'video');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    console.log('Tipos ENUM creados');
    
    // Crear tabla users
    await client.query(`
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
    
    console.log('Tabla users creada');
    
    // Crear tabla events
    await client.query(`
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
    
    console.log('Tabla events creada');
    
    // Crear tabla event_attendees
    await client.query(`
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
    
    console.log('Tabla event_attendees creada');
    
    // Crear tabla user_interests
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_interests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        category event_category NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Tabla user_interests creada');
    
    // Crear tabla sessions (Para autenticación)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire);
    `);
    
    console.log('Tabla sessions creada');
    
    await client.end();
    
    console.log('Esquema de base de datos creado exitosamente');
    
  } catch (error) {
    console.error('Error al crear el esquema:', error);
    process.exit(1);
  }
}

createSchema();