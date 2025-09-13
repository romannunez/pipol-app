import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createNotificationsTable() {
  try {
    console.log('🔧 Creating notification_type enum...');
    
    // Create enum type first
    const { error: enumError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ BEGIN
          CREATE TYPE notification_type AS ENUM ('new_request', 'request_approved', 'request_rejected');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `
    });

    if (enumError) {
      console.error('Error creating enum:', enumError);
    } else {
      console.log('✅ notification_type enum created/exists');
    }

    console.log('🔧 Creating notifications table...');
    
    // Create notifications table
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type notification_type NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
          request_id INTEGER,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
        CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
      `
    });

    if (tableError) {
      console.error('Error creating notifications table:', tableError);
    } else {
      console.log('✅ notifications table created successfully');
    }

    // Verify table exists
    const { data: tables, error: verifyError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'notifications');

    if (verifyError) {
      console.error('Error verifying table:', verifyError);
    } else if (tables && tables.length > 0) {
      console.log('✅ notifications table verified in database');
    } else {
      console.log('❌ notifications table not found after creation');
    }

  } catch (error) {
    console.error('Exception creating notifications table:', error);
  }
}

createNotificationsTable().then(() => {
  console.log('🎉 Notifications table setup complete');
  process.exit(0);
}).catch(error => {
  console.error('Failed to create notifications table:', error);
  process.exit(1);
});