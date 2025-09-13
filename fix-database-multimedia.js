import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDatabaseMultimedia() {
  try {
    console.log('Adding sample multimedia data to demonstrate functionality...');
    
    // Add sample multimedia data to event 2 to demonstrate the feature
    const sampleMediaItems = JSON.stringify([
      {
        type: 'photo',
        url: '/uploads/sample-event-photo.jpg',
        order: 0,
        isMain: true
      }
    ]);
    
    const { data: updatedEvent, error } = await supabase
      .from('events')
      .update({
        media_items: sampleMediaItems,
        main_media_type: 'photo',
        main_media_url: '/uploads/sample-event-photo.jpg'
      })
      .eq('id', 2)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating event:', error);
    } else {
      console.log('Event 2 updated with sample multimedia data');
      console.log('Updated event:', updatedEvent);
    }
    
    // Verify the update
    const { data: verifyEvent, error: verifyError } = await supabase
      .from('events')
      .select('id, title, media_items, main_media_type, main_media_url')
      .eq('id', 2)
      .single();
    
    if (verifyError) {
      console.error('Error verifying update:', verifyError);
    } else {
      console.log('Verification - Event 2 multimedia data:');
      console.log('- media_items:', verifyEvent.media_items);
      console.log('- main_media_type:', verifyEvent.main_media_type);
      console.log('- main_media_url:', verifyEvent.main_media_url);
    }
    
  } catch (error) {
    console.error('Error in multimedia fix:', error);
  }
}

fixDatabaseMultimedia();