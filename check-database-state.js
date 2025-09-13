import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabaseState() {
  console.log('Checking actual database state...');

  // Check what columns exist in events table
  try {
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'events')
      .eq('table_schema', 'public');

    if (columns && columns.length > 0) {
      console.log('Events table columns:');
      columns.sort((a, b) => a.column_name.localeCompare(b.column_name)).forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('No columns found or error:', error?.message);
    }
  } catch (err) {
    console.log('Error checking columns:', err.message);
  }

  // Check what tables exist
  try {
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tables) {
      console.log('Existing tables:', tables.map(t => t.table_name).sort());
    }
  } catch (err) {
    console.log('Error checking tables:', err.message);
  }

  // Try to access events table directly
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, category, privacy_type')
      .limit(1);
    
    console.log('Events table query result:', { success: !error, error: error?.message });
  } catch (err) {
    console.log('Direct events query error:', err.message);
  }
}

checkDatabaseState();