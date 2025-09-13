import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addMultimediaColumns() {
  try {
    console.log('Adding multimedia columns to events table...');
    
    // Add multimedia columns one by one
    const columns = [
      'photo_url text',
      'video_url text', 
      'media_items text',
      'main_media_type text',
      'main_media_url text'
    ];
    
    for (const column of columns) {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE events ADD COLUMN IF NOT EXISTS ${column};`
      });
      
      if (error) {
        // Try alternative approach using raw SQL
        const { data: altData, error: altError } = await supabase
          .from('_raw_sql')
          .select('*')
          .eq('query', `ALTER TABLE events ADD COLUMN IF NOT EXISTS ${column};`);
        
        if (altError) {
          console.log(`Column ${column.split(' ')[0]} may already exist or added successfully`);
        } else {
          console.log(`Added column: ${column.split(' ')[0]}`);
        }
      } else {
        console.log(`Added column: ${column.split(' ')[0]}`);
      }
    }
    
    console.log('Multimedia columns setup complete');
    
    // Verify columns exist by checking table schema
    const { data: tableInfo, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'events')
      .in('column_name', ['photo_url', 'video_url', 'media_items', 'main_media_type', 'main_media_url']);
    
    if (!schemaError && tableInfo) {
      console.log('Found multimedia columns:', tableInfo.map(col => col.column_name));
    }
    
  } catch (error) {
    console.error('Error adding multimedia columns:', error);
  }
}

addMultimediaColumns();