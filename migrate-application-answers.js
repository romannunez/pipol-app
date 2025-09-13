import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || "https://pbvkjkjdtwftjetpreai.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBidmtqa2pkdHdmdGpldHByZWFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODgxNjc2OSwiZXhwIjoyMDU0MzkyNzY5fQ.jckYD_TEuV0Z-1lPSWdL0lINmAc5EKaZwC-k_-IX1oA";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addApplicationAnswersColumn() {
  try {
    console.log('🔄 Checking current event_attendees table structure...');
    
    // First, check if the column already exists by testing a simple query
    const { data: testData, error: testError } = await supabase
      .from('event_attendees')
      .select('application_answers')
      .limit(1);

    if (!testError) {
      console.log('✅ Column application_answers already exists in event_attendees table');
      console.log('Migration completed successfully - no changes needed');
      return;
    }

    console.log('🔄 Column does not exist, adding it now...');
    
    // Use a direct raw SQL query through the Supabase SQL editor approach
    // Since we can't use execute_sql RPC, we'll need to handle this differently
    
    console.log('❌ Cannot add column via Supabase client. Please add the column manually:');
    console.log('ALTER TABLE event_attendees ADD COLUMN application_answers TEXT;');
    console.log('The system will work without this column for now, but private event applications may have limited functionality.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

addApplicationAnswersColumn();