import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixBothIssues() {
  try {
    console.log('Fixing organizer recognition and multimedia display issues...');
    
    // First, check current table schema
    const { data: currentColumns, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'events')
      .order('ordinal_position');
    
    if (schemaError) {
      console.error('Error checking schema:', schemaError);
    } else {
      console.log('Current events table columns:');
      currentColumns.forEach(col => console.log(`- ${col.column_name}: ${col.data_type}`));
    }
    
    // Check if multimedia columns exist
    const multimediaColumns = ['photo_url', 'video_url', 'media_items', 'main_media_type', 'main_media_url'];
    const existingMultimediaColumns = currentColumns ? currentColumns.filter(col => 
      multimediaColumns.includes(col.column_name)
    ) : [];
    
    console.log('\nExisting multimedia columns:', existingMultimediaColumns.map(col => col.column_name));
    
    // Test event retrieval to see current data structure
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .limit(5);
    
    if (eventsError) {
      console.error('Error fetching events:', eventsError);
    } else {
      console.log('\nSample event data structure:');
      if (events && events.length > 0) {
        console.log('Keys:', Object.keys(events[0]));
        console.log('Event 1 organizer_id:', events[0].organizer_id, typeof events[0].organizer_id);
      }
    }
    
    // Test organizer recognition by checking event 2
    const { data: event2, error: event2Error } = await supabase
      .from('events')
      .select('*')
      .eq('id', 2)
      .single();
    
    if (event2Error) {
      console.error('Error fetching event 2:', event2Error);
    } else {
      console.log('\nEvent 2 details:');
      console.log('organizer_id:', event2.organizer_id, typeof event2.organizer_id);
      console.log('Has multimedia fields:', {
        photo_url: event2.photo_url !== undefined,
        video_url: event2.video_url !== undefined,
        media_items: event2.media_items !== undefined,
        main_media_type: event2.main_media_type !== undefined,
        main_media_url: event2.main_media_url !== undefined
      });
    }
    
  } catch (error) {
    console.error('Error in diagnosis:', error);
  }
}

fixBothIssues();