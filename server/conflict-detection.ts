import { supabase } from './supabase-client';

export interface ConflictCheckParams {
  userId: number;
  startTime: Date;
  endTime: Date;
  paymentType: 'free' | 'paid';
  excludeEventId?: number; // For editing events
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictingEvents: Array<{
    id: number;
    title: string;
    startTime: Date;
    endTime: Date;
    paymentType: string;
    role: 'creator' | 'attendee';
  }>;
  message?: string;
}

/**
 * Check for scheduling conflicts for a user
 * Rules:
 * 1. Users cannot create or attend events that overlap in time
 * 2. Paid event creators cannot create overlapping events  
 * 3. Free event creators cannot create overlapping events
 */
export async function checkEventConflicts(params: ConflictCheckParams): Promise<ConflictResult> {
  const { userId, startTime, endTime, paymentType, excludeEventId } = params;

  try {
    console.log(`🕐 Checking conflicts for user ${userId} from ${startTime.toISOString()} to ${endTime.toISOString()}`);

    // Get events the user created
    let createdEventsQuery = supabase
      .from('events')
      .select('id, title, date, end_time, payment_type')
      .eq('organizer_id', userId);

    if (excludeEventId) {
      createdEventsQuery = createdEventsQuery.neq('id', excludeEventId);
    }

    const { data: createdEvents, error: createdError } = await createdEventsQuery;

    if (createdError) {
      console.error('Error fetching created events:', createdError);
      throw createdError;
    }

    // Get events the user is attending
    let attendingEventsQuery = supabase
      .from('event_attendees')
      .select(`
        events!inner(id, title, date, end_time, payment_type)
      `)
      .eq('user_id', userId)
      .eq('status', 'approved');

    const { data: attendingEvents, error: attendingError } = await attendingEventsQuery;

    if (attendingError) {
      console.error('Error fetching attending events:', attendingError);
      throw attendingError;
    }

    const conflictingEvents: ConflictResult['conflictingEvents'] = [];

    // Check conflicts with created events
    if (createdEvents) {
      for (const event of createdEvents) {
        if (!event.end_time) continue; // Skip events without end time
        
        const eventStart = new Date(event.date);
        const eventEnd = new Date(event.end_time);

        // Check for overlap: events conflict if they overlap in any way
        const hasOverlap = (
          (startTime >= eventStart && startTime < eventEnd) ||
          (endTime > eventStart && endTime <= eventEnd) ||
          (startTime <= eventStart && endTime >= eventEnd)
        );

        if (hasOverlap) {
          conflictingEvents.push({
            id: event.id,
            title: event.title,
            startTime: eventStart,
            endTime: eventEnd,
            paymentType: event.payment_type,
            role: 'creator'
          });
        }
      }
    }

    // Check conflicts with attending events
    if (attendingEvents) {
      for (const attendeeRecord of attendingEvents) {
        const event = attendeeRecord.events;
        if (!event || !event.end_time) continue;

        const eventStart = new Date(event.date);
        const eventEnd = new Date(event.end_time);

        const hasOverlap = (
          (startTime >= eventStart && startTime < eventEnd) ||
          (endTime > eventStart && endTime <= eventEnd) ||
          (startTime <= eventStart && endTime >= eventEnd)
        );

        if (hasOverlap) {
          conflictingEvents.push({
            id: event.id,
            title: event.title,
            startTime: eventStart,
            endTime: eventEnd,
            paymentType: event.payment_type,
            role: 'attendee'
          });
        }
      }
    }

    const hasConflict = conflictingEvents.length > 0;
    let message = '';

    if (hasConflict) {
      const creatorConflicts = conflictingEvents.filter(e => e.role === 'creator');
      const attendeeConflicts = conflictingEvents.filter(e => e.role === 'attendee');

      if (creatorConflicts.length > 0) {
        message += `Tienes conflictos con eventos que has creado: ${creatorConflicts.map(e => e.title).join(', ')}. `;
      }
      
      if (attendeeConflicts.length > 0) {
        message += `Tienes conflictos con eventos a los que asistes: ${attendeeConflicts.map(e => e.title).join(', ')}.`;
      }
    }

    console.log(`🕐 Conflict check result: ${hasConflict ? 'CONFLICTS FOUND' : 'NO CONFLICTS'}`);
    
    return {
      hasConflict,
      conflictingEvents,
      message: message.trim()
    };

  } catch (error) {
    console.error('Error in conflict detection:', error);
    return {
      hasConflict: false,
      conflictingEvents: [],
      message: 'Error checking conflicts'
    };
  }
}

/**
 * Check if a user can attend an event (no scheduling conflicts)
 */
export async function canUserAttendEvent(userId: number, eventId: number): Promise<ConflictResult> {
  try {
    // Get the event details
    const { data: event, error } = await supabase
      .from('events')
      .select('date, end_time, payment_type')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return {
        hasConflict: true,
        conflictingEvents: [],
        message: 'Event not found'
      };
    }

    if (!event.end_time) {
      return {
        hasConflict: true,
        conflictingEvents: [],
        message: 'Event does not have end time set'
      };
    }

    const startTime = new Date(event.date);
    const endTime = new Date(event.end_time);

    return await checkEventConflicts({
      userId,
      startTime,
      endTime,
      paymentType: event.payment_type as 'free' | 'paid'
    });

  } catch (error) {
    console.error('Error checking if user can attend event:', error);
    return {
      hasConflict: true,
      conflictingEvents: [],
      message: 'Error checking attendance eligibility'
    };
  }
}

/**
 * Remove finished events from the map based on end time
 */
export async function removeFinishedEvents(): Promise<void> {
  try {
    const now = new Date();
    
    console.log(`🕐 Removing events that ended before ${now.toISOString()}`);

    // For now, we'll mark events as "ended" instead of deleting them
    // This can be used by the frontend to filter out ended events
    const { error } = await supabase
      .from('events')
      .update({ 
        // We could add an "ended" status field, but for now just log
      })
      .lt('end_time', now.toISOString());

    if (error) {
      console.error('Error removing finished events:', error);
    } else {
      console.log('🕐 Finished events processing completed');
    }

  } catch (error) {
    console.error('Error in removeFinishedEvents:', error);
  }
}