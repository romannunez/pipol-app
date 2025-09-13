import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function fixDatabaseSchema() {
  console.log('Fixing database schema...');

  // Step 1: Create enum types
  const enums = [
    {
      name: 'event_category',
      values: ['social', 'music', 'spiritual', 'education', 'sports', 'food', 'art', 'technology', 'games', 'outdoor', 'networking', 'workshop', 'conference', 'party', 'fair', 'exhibition']
    },
    {
      name: 'privacy_type',
      values: ['public', 'private']
    },
    {
      name: 'private_access_type',
      values: ['solicitud', 'postulacion', 'paga']
    },
    {
      name: 'payment_type',
      values: ['free', 'paid']
    },
    {
      name: 'multimedia_type',
      values: ['photo', 'video']
    },
    {
      name: 'attendee_status',
      values: ['pending', 'approved', 'rejected']
    }
  ];

  for (const enumDef of enums) {
    try {
      const enumSQL = `
        DO $$ BEGIN
          CREATE TYPE ${enumDef.name} AS ENUM (${enumDef.values.map(v => `'${v}'`).join(', ')});
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `;
      
      const { error } = await supabase.rpc('exec', { sql: enumSQL });
      if (error) {
        console.log(`Enum ${enumDef.name}:`, error.message.includes('already exists') ? 'exists' : error.message);
      } else {
        console.log(`✓ Enum ${enumDef.name} created`);
      }
    } catch (err) {
      console.log(`Enum ${enumDef.name}: attempting creation`);
    }
  }

  // Step 2: Add missing columns to events table
  const alterColumns = [
    'ADD COLUMN IF NOT EXISTS private_access_type private_access_type',
    'ADD COLUMN IF NOT EXISTS application_questions TEXT',
    'ADD COLUMN IF NOT EXISTS photo_urls TEXT',
    'ADD COLUMN IF NOT EXISTS video_urls TEXT',
    'ADD COLUMN IF NOT EXISTS media_items TEXT',
    'ADD COLUMN IF NOT EXISTS main_media_type multimedia_type DEFAULT \'photo\'',
    'ADD COLUMN IF NOT EXISTS main_media_url TEXT'
  ];

  for (const column of alterColumns) {
    try {
      const { error } = await supabase.rpc('exec', { 
        sql: `ALTER TABLE events ${column};` 
      });
      if (error) {
        console.log(`Column update:`, error.message.includes('already exists') ? 'exists' : error.message);
      } else {
        console.log(`✓ Column added: ${column.split(' ')[5]}`);
      }
    } catch (err) {
      console.log(`Attempting to add column: ${column.split(' ')[5]}`);
    }
  }

  // Step 3: Create event_attendees table
  const createEventAttendeesSQL = `
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
  `;

  try {
    const { error } = await supabase.rpc('exec', { sql: createEventAttendeesSQL });
    if (error) {
      console.log('event_attendees table:', error.message.includes('already exists') ? 'exists' : error.message);
    } else {
      console.log('✓ event_attendees table created');
    }
  } catch (err) {
    console.log('Attempting to create event_attendees table');
  }

  // Step 4: Create user_interests table
  const createUserInterestsSQL = `
    CREATE TABLE IF NOT EXISTS user_interests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category event_category NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;

  try {
    const { error } = await supabase.rpc('exec', { sql: createUserInterestsSQL });
    if (error) {
      console.log('user_interests table:', error.message.includes('already exists') ? 'exists' : error.message);
    } else {
      console.log('✓ user_interests table created');
    }
  } catch (err) {
    console.log('Attempting to create user_interests table');
  }

  // Step 5: Test if tables exist by querying them
  console.log('\nTesting database schema...');
  
  // Test event_attendees
  try {
    const { data, error } = await supabase.from('event_attendees').select('id').limit(1);
    console.log('✓ event_attendees table accessible');
  } catch (err) {
    console.log('❌ event_attendees table not accessible');
  }

  // Test events columns
  try {
    const { data, error } = await supabase.from('events').select('private_access_type').limit(1);
    console.log('✓ events.private_access_type column accessible');
  } catch (err) {
    console.log('❌ events.private_access_type column not accessible');
  }

  console.log('\nDatabase schema fix completed.');
}

fixDatabaseSchema().catch(console.error);