import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixChatAccess() {
  try {
    console.log('🔍 Checking event 26 details...');
    
    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, organizer_id')
      .eq('id', 26)
      .single();
    
    if (eventError) {
      console.error('Error fetching event:', eventError);
      return;
    }
    
    console.log('Event details:', event);
    
    // Check if organizer is already an attendee
    const { data: attendee, error: attendeeError } = await supabase
      .from('event_attendees')
      .select('*')
      .eq('event_id', 26)
      .eq('user_id', event.organizer_id)
      .single();
    
    if (attendeeError && attendeeError.code !== 'PGRST116') {
      console.error('Error checking attendee:', attendeeError);
      return;
    }
    
    if (attendee) {
      console.log('✅ Organizer is already an attendee');
      return;
    }
    
    // Add organizer as attendee
    console.log('➕ Adding organizer as attendee...');
    const { data: newAttendee, error: insertError } = await supabase
      .from('event_attendees')
      .insert({
        event_id: 26,
        user_id: event.organizer_id,
        status: 'confirmed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error inserting attendee:', insertError);
      return;
    }
    
    console.log('✅ Successfully added organizer as attendee:', newAttendee);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixChatAccess();