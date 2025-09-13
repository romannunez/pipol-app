import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugEventData() {
  try {
    // Get event 2 data directly from database
    const { data: event2, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', 2)
      .single();
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Event 2 raw database data:');
    console.log('ID:', event2.id);
    console.log('Title:', event2.title);
    console.log('media_items:', event2.media_items);
    console.log('main_media_url:', event2.main_media_url);
    console.log('main_media_type:', event2.main_media_type);
    
    // Parse media items if it exists
    if (event2.media_items) {
      try {
        const mediaItems = JSON.parse(event2.media_items);
        console.log('Parsed media_items:', mediaItems);
      } catch (e) {
        console.log('Failed to parse media_items:', e.message);
      }
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugEventData();