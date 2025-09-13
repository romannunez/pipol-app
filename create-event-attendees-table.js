import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createEventAttendeesTable() {
  try {
    console.log('Creating event_attendees table...');
    
    // First, create the attendee_status enum if it doesn't exist
    const { error: enumError } = await supabase.rpc('create_enum_if_not_exists', {
      enum_name: 'attendee_status',
      enum_values: ['pending', 'approved', 'rejected']
    });
    
    if (enumError) {
      console.log('Enum creation result:', enumError.message);
    }
    
    // Create the table using raw SQL
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS event_attendees (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        status attendee_status DEFAULT 'approved' NOT NULL,
        payment_status TEXT DEFAULT 'pending',
        payment_intent_id TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(event_id, user_id)
      );
    `;
    
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: createTableSQL 
    });
    
    if (error) {
      console.error('Error creating table:', error);
      
      // Try alternative approach with direct query
      const { error: directError } = await supabase
        .from('event_attendees')
        .select('*')
        .limit(1);
        
      if (directError && directError.code === '42P01') {
        console.log('Table does not exist, attempting to create with service key...');
        // We need to create this table through Supabase dashboard or use a different approach
        console.log('Please create the event_attendees table manually in Supabase dashboard with this SQL:');
        console.log(createTableSQL);
      }
    } else {
      console.log('✓ event_attendees table created successfully');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createEventAttendeesTable();