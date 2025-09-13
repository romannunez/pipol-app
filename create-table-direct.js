import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  db: { schema: 'public' }
});

async function createTableDirect() {
  try {
    console.log('Creating event_attendees table via REST API...');
    
    // First, check what tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
      
    if (!tablesError) {
      console.log('Existing tables:', tables.map(t => t.table_name));
    }
    
    // Try to create the enum using a different approach
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sql: `
          DO $$ BEGIN
              CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected');
          EXCEPTION
              WHEN duplicate_object THEN null;
          END $$;
          
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
          
          CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
          CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
        `
      })
    });
    
    const result = await response.text();
    console.log('SQL execution response:', response.status, result);
    
    // Test if table was created by trying to query it
    const { data: testData, error: testError } = await supabase
      .from('event_attendees')
      .select('id')
      .limit(1);
      
    if (testError) {
      console.error('Table creation failed:', testError);
      console.log('\nPlease manually execute this SQL in Supabase Dashboard:');
      console.log(`
DO $$ BEGIN
    CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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

CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
      `);
    } else {
      console.log('✓ event_attendees table created successfully!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTableDirect();