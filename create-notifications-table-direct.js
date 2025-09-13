import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

console.log('Environment check:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function createNotificationsTable() {
  console.log('🔧 Creating notifications table directly...');

  // First, let's try to create the enum type using raw SQL
  try {
    console.log('Creating notification_type enum...');
    const { data: enumData, error: enumError } = await supabase
      .rpc('exec_sql', {
        sql: "CREATE TYPE notification_type AS ENUM ('request_approved', 'request_rejected', 'new_request');"
      });
      
    if (enumError && !enumError.message.includes('already exists')) {
      console.error('Error creating enum:', enumError);
    } else {
      console.log('✅ Enum ready');
    }
  } catch (error) {
    console.log('Enum might already exist, continuing...');
  }

  // Now create the table
  try {
    console.log('Creating notifications table...');
    const { data, error } = await supabase
      .rpc('exec_sql', {
        sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type notification_type NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
          request_id INTEGER REFERENCES event_attendees(id) ON DELETE CASCADE,
          is_read BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
        `
      });
      
    if (error) {
      console.error('❌ Error creating table:', error);
    } else {
      console.log('✅ Table creation command executed');
    }

    // Test access
    const { data: testData, error: testError } = await supabase
      .from('notifications')
      .select('*')
      .limit(1);

    if (testError) {
      console.error('❌ Table test failed:', testError);
    } else {
      console.log('✅ Notifications table is accessible and ready');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createNotificationsTable();