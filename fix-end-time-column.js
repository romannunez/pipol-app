import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addEndTimeColumn() {
  try {
    console.log('Checking if end_time column exists...');
    
    // First, let's check the current table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('events')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Error checking table:', tableError);
      return;
    }
    
    // Check if we can query end_time
    const { data: testData, error: testError } = await supabase
      .from('events')
      .select('end_time')
      .limit(1);
    
    if (testError && testError.message.includes('end_time')) {
      console.log('end_time column is missing. This is expected.');
      console.log('The column needs to be added manually in the Supabase dashboard.');
      console.log('Go to your Supabase project dashboard:');
      console.log('1. Navigate to Table Editor');
      console.log('2. Select the "events" table');
      console.log('3. Click "Add Column"');
      console.log('4. Name: end_time');
      console.log('5. Type: timestamptz (timestamp with time zone)');
      console.log('6. Allow nullable: true');
      console.log('7. Save the column');
      return;
    }
    
    console.log('end_time column exists or can be queried');
    console.log('Test data:', testData);
    
  } catch (err) {
    console.error('Exception:', err);
  }
}

addEndTimeColumn();