import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function setupNotificationsTable() {
  console.log('🔧 Setting up notifications table...');
  
  try {
    // Create notification_type enum if it doesn't exist
    const enumResult = await supabase
      .rpc('exec_sql', { 
        sql: "CREATE TYPE notification_type AS ENUM ('request_approved', 'request_rejected', 'new_request')"
      });
    
    console.log('✅ Notification type enum created (or already exists)');
  } catch (error) {
    // Enum might already exist, that's ok
    console.log('⚠️ Notification type enum might already exist');
  }

  try {
    // Create notifications table
    const tableResult = await supabase
      .rpc('exec_sql', { 
        sql: `
          CREATE TABLE notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            type notification_type NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            event_id INTEGER REFERENCES events(id),
            request_id INTEGER REFERENCES event_attendees(id),
            is_read BOOLEAN DEFAULT FALSE NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `
      });
      
    console.log('✅ Notifications table created successfully');
    
    // Test the table by checking if it exists
    const testResult = await supabase
      .from('notifications')
      .select('*')
      .limit(1);
      
    if (testResult.error && testResult.error.code === '42P01') {
      console.log('❌ Table creation failed');
      console.error(testResult.error);
    } else {
      console.log('✅ Notifications table is accessible');
    }
    
  } catch (error) {
    console.error('❌ Error creating notifications table:', error);
  }
}

setupNotificationsTable();