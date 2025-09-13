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

async function createMissingTable() {
  try {
    console.log('Creating missing event_attendees table...');
    
    // Create the attendee_status enum first
    const enumSQL = `
      DO $$ BEGIN
          CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `;
    
    // Create the table
    const tableSQL = `
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
    `;
    
    // Execute enum creation
    const { data: enumData, error: enumError } = await supabase.rpc('sql', { 
      query: enumSQL 
    });
    
    if (enumError) {
      console.log('Enum creation status:', enumError.message);
    } else {
      console.log('✓ Enum created successfully');
    }
    
    // Execute table creation
    const { data: tableData, error: tableError } = await supabase.rpc('sql', { 
      query: tableSQL 
    });
    
    if (tableError) {
      console.error('Table creation error:', tableError);
      // Try with a simpler approach - check if we can insert test data
      const { error: testError } = await supabase
        .from('event_attendees')
        .select('id')
        .limit(1);
        
      if (testError && testError.code === '42P01') {
        console.log('\n❌ Table still does not exist.');
        console.log('Please execute this SQL in Supabase Dashboard > SQL Editor:');
        console.log('\n' + enumSQL + '\n' + tableSQL);
      } else {
        console.log('✓ Table appears to exist now');
      }
    } else {
      console.log('✓ Table created successfully');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createMissingTable();