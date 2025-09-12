import { db } from "./db";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import {
  users,
  events,
  eventAttendees,
  userInterests,
  notifications,
  type User,
  type Event,
  type EventAttendee,
  type InsertUser,
  type InsertEvent,
  type InsertEventAttendee
} from "@shared/schema";

// User related storage functions using Supabase client directly
import { supabase } from './supabase-client';
import { memoryUserStore } from './memory-storage';
import { createClient } from '@supabase/supabase-js';

export const getUserById = async (id: number) => {
  try {
    // Try memory store first
    const memoryUser = await memoryUserStore.getUserById(id);
    if (memoryUser) {
      return memoryUser;
    }

    // Fallback to Supabase
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      console.log('getUserById error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.log('getUserById exception:', err);
    return null;
  }
};

export const getUserByEmail = async (email: string) => {
  try {
    // Try memory store first
    const memoryUser = await memoryUserStore.getUserByEmail(email);
    if (memoryUser) {
      return memoryUser;
    }

    // Fallback to Supabase
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    
    if (error) {
      console.log('getUserByEmail error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.log('getUserByEmail exception:', err);
    return null;
  }
};

export const getUserByUsername = async (username: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error) {
      console.log('getUserByUsername error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.log('getUserByUsername exception:', err);
    return null;
  }
};

export const getUserBySupabaseId = async (supabaseId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_id', supabaseId)
      .single();
    
    if (error) {
      console.log('getUserBySupabaseId error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.log('getUserBySupabaseId exception:', err);
    return null;
  }
};

export const insertUser = async (user: InsertUser) => {
  try {
    // Try Supabase first
    const dbUser = {
      email: user.email,
      username: user.username,
      name: user.name,
      password: user.password,
      bio: user.bio || null,
      avatar: user.avatar || null,
      supabase_id: user.supabaseId || null,
      stripe_customer_id: user.stripeCustomerId || null,
      stripe_subscription_id: user.stripeSubscriptionId || null
    };
    
    const { data, error } = await supabase
      .from('users')
      .insert([dbUser])
      .select()
      .single();
    
    if (!error && data) {
      console.log('insertUser successful in Supabase:', data.id);
      return data;
    }
    
    console.log('insertUser Supabase error:', error?.message, '- falling back to memory store');
    
    // Fallback to memory store for development
    const memoryUser = await memoryUserStore.insertUser(user);
    if (memoryUser) {
      console.log('insertUser successful in memory store:', memoryUser.id);
      return memoryUser;
    }
    
    console.log('insertUser failed in both Supabase and memory store');
    return null;
  } catch (err) {
    console.log('insertUser exception:', err);
    
    // Try memory store as final fallback
    try {
      const memoryUser = await memoryUserStore.insertUser(user);
      if (memoryUser) {
        console.log('insertUser successful in memory store (exception fallback):', memoryUser.id);
        return memoryUser;
      }
    } catch (memErr) {
      console.log('insertUser memory store exception:', memErr);
    }
    
    return null;
  }
};

export const updateUser = async (id: number, userData: Partial<User>) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ ...userData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.log('updateUser error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.log('updateUser exception:', err);
    return null;
  }
};

export const updateStripeCustomerId = async (userId: number, stripeCustomerId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ 
        stripe_customer_id: stripeCustomerId, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      console.log('updateStripeCustomerId error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.log('updateStripeCustomerId exception:', err);
    return null;
  }
};

export const updateUserStripeInfo = async (userId: number, stripeInfo: { stripeCustomerId: string, stripeSubscriptionId: string }) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ 
        stripe_customer_id: stripeInfo.stripeCustomerId,
        stripe_subscription_id: stripeInfo.stripeSubscriptionId,
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      console.log('updateUserStripeInfo error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.log('updateUserStripeInfo exception:', err);
    return null;
  }
};

// Cache for processed media items to avoid repetitive processing
const mediaProcessingCache = new Map<string, any>();

// Utility function to sort media items in events so main item appears first
const sortEventMediaItems = (event: any) => {
  if (!event) return event;
  
  // Generate cache key based on event ID and media items content
  const mediaItemsField = event?.media_items || event?.mediaItems;
  const cacheKey = `${event.id}-${JSON.stringify(mediaItemsField || '')}`;
  
  // Check cache first to avoid repeated processing
  if (mediaProcessingCache.has(cacheKey)) {
    const cachedResult = mediaProcessingCache.get(cacheKey);
    return { ...event, ...cachedResult };
  }
  
  if (!mediaItemsField) {
    // Cache empty result
    mediaProcessingCache.set(cacheKey, { 
      media_items: null, 
      mediaItems: null,
      mainMediaUrl: event.main_media_url || event.mainMediaUrl,
      mainMediaType: event.main_media_type || event.mainMediaType
    });
    return event;
  }
  
  try {
    let mediaItems = [];
    
    // Parse media items
    if (typeof mediaItemsField === 'string') {
      try {
        mediaItems = JSON.parse(mediaItemsField);
      } catch (parseError) {
        console.warn(`Error parsing media items for event ${event.id}:`, parseError);
        return event;
      }
    } else if (Array.isArray(mediaItemsField)) {
      mediaItems = mediaItemsField;
    }
    
    if (Array.isArray(mediaItems) && mediaItems.length > 0) {
      // Validate and clean media items
      const validMediaItems = mediaItems.filter(item => 
        item && 
        typeof item === 'object' && 
        item.url && 
        (item.type === 'photo' || item.type === 'video')
      );
      
      if (validMediaItems.length === 0) {
        console.warn(`No valid media items found for event ${event.id}`);
        return event;
      }
      
      // Sort so main item appears first
      const sortedItems = validMediaItems.sort((a, b) => {
        // If one is main and the other is not, main goes first
        if (a.isMain && !b.isMain) return -1;
        if (!a.isMain && b.isMain) return 1;
        // If both are main or neither is main, sort by order
        return (a.order || 0) - (b.order || 0);
      });
      
      // Ensure at least one item is marked as main
      if (!sortedItems.some(item => item.isMain)) {
        sortedItems[0].isMain = true;
      }
      
      // Find main media info
      const mainItem = sortedItems.find(item => item.isMain);
      const mainMediaUrl = mainItem?.url || null;
      const mainMediaType = mainItem?.type || null;
      
      // Prepare result for caching
      const result = {
        media_items: JSON.stringify(sortedItems),
        mediaItems: JSON.stringify(sortedItems),
        mainMediaUrl: mainMediaUrl,
        mainMediaType: mainMediaType,
        main_media_url: mainMediaUrl,
        main_media_type: mainMediaType
      };
      
      // Cache the result
      mediaProcessingCache.set(cacheKey, result);
      
      return { ...event, ...result };
    }
  } catch (error) {
    console.warn(`Error processing media items for event ${event.id}:`, error);
  }
  
  return event;
};

// Clear cache periodically to prevent memory leaks
setInterval(() => {
  if (mediaProcessingCache.size > 1000) {
    mediaProcessingCache.clear();
    console.log('🧹 Cleared media processing cache');
  }
}, 300000); // Clear every 5 minutes if cache is too large

// Event related storage functions
export const getEventById = async (id: number) => {
  try {
    console.log(`🔍 getEventById: Fetching event with ID ${id}`);
    
    // Use Supabase client to get event with organizer data
    const { data: event, error } = await supabase
      .from('events')
      .select(`
        *,
        organizer:users!events_organizer_id_fkey(*),
        attendees:event_attendees(
          *,
          user:users(*)
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      console.log(`🚨 getEventById error for ID ${id}:`, error.message);
      return null;
    }
    
    if (!event) {
      console.log(`🔍 No event found for ID ${id}`);
      return null;
    }
    
    console.log(`🔍 Found event: ${event.title} by organizer ${event.organizer?.name}`);
    console.log(`🔍 Attendees data:`, event.attendees ? `${event.attendees.length} attendees` : 'null/undefined');
    return sortEventMediaItems(event);
  } catch (err) {
    console.error(`🚨 getEventById exception for ID ${id}:`, err);
    return null;
  }
};

export const getEvents = async (filters?: {
  category?: string[];
  paymentType?: string[];
  minDate?: Date;
  maxDate?: Date;
  searchTerm?: string;
  lat?: number;
  lng?: number;
  radius?: number; // in kilometers
}) => {
  try {
    console.log("📍 getEvents: Using configured Supabase client...");
    
    const now = new Date().toISOString();
    
    const { data: allEvents, error } = await supabase
      .from('events')
      .select(`
        *,
        organizer:users!events_organizer_id_fkey(*),
        attendees:event_attendees(
          *,
          user:users(*)
        )
      `)
      .or(`end_time.gte.${now},end_time.is.null`)
      .order('date', { ascending: false });

    if (error) {
      console.error("getEvents Supabase error:", error);
      return [];
    }

    let filteredEvents = allEvents || [];

    // Apply search filter if provided
    if (filters?.searchTerm && filters.searchTerm.trim().length > 0) {
      const searchTerm = filters.searchTerm.toLowerCase().trim();
      console.log(`📍 Filtering events by search term: "${searchTerm}"`);
      
      filteredEvents = filteredEvents.filter(event => {
        const titleMatch = event.title?.toLowerCase().includes(searchTerm);
        const descriptionMatch = event.description?.toLowerCase().includes(searchTerm);
        const locationMatch = event.locationName?.toLowerCase().includes(searchTerm) || 
                             event.locationAddress?.toLowerCase().includes(searchTerm);
        const categoryMatch = event.category?.toLowerCase().includes(searchTerm);
        
        return titleMatch || descriptionMatch || locationMatch || categoryMatch;
      });
      
      console.log(`📍 Found ${filteredEvents.length} events matching search term`);
    }

    // Apply category filter if provided
    if (filters?.category && filters.category.length > 0) {
      filteredEvents = filteredEvents.filter(event => 
        filters.category!.includes(event.category)
      );
    }

    // Apply payment type filter if provided
    if (filters?.paymentType && filters.paymentType.length > 0) {
      filteredEvents = filteredEvents.filter(event => 
        filters.paymentType!.includes(event.paymentType)
      );
    }

    console.log(`📍 Found ${filteredEvents.length} events (filtered for non-ended events)`);
    return filteredEvents.map(sortEventMediaItems);
  } catch (error: any) {
    console.error("getEvents exception:", error);
    return [];
  }
};

export const getNearbyEvents = async (lat: number, lng: number, radius: number = 10) => {
  try {
    console.log("📍 getNearbyEvents: Using configured Supabase client...");
    
    // Use the already configured Supabase client
    
    console.log("📍 getNearbyEvents: Querying events table...");
    const now = new Date().toISOString();
    
    const { data: allEvents, error } = await supabase
      .from('events')
      .select(`
        *,
        organizer:users!events_organizer_id_fkey(*)
      `)
      .or(`end_time.gte.${now},end_time.is.null`)
      .order('date', { ascending: false });

    if (error) {
      console.error("getNearbyEvents Supabase error:", error);
      return [];
    }

    if (!allEvents) {
      return [];
    }

    // Simplified distance calculation using the Haversine formula
    // In a real app, this would be done at the database level
    const filteredEvents = allEvents.filter(event => {
      const eventLat = parseFloat(event.latitude.toString());
      const eventLng = parseFloat(event.longitude.toString());
      
      // Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = (lat - eventLat) * Math.PI / 180;
      const dLng = (lng - eventLng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(eventLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      return distance <= radius;
    });

    console.log(`📍 Found ${filteredEvents.length} nearby events (filtered for non-ended events)`);
    // Sort media items for each event
    return filteredEvents.map(sortEventMediaItems);
  } catch (error: any) {
    console.error("getNearbyEvents exception:", error);
    return [];
  }
};

export const insertEvent = async (event: InsertEvent) => {
  try {
    console.log("🔥 insertEvent: Using configured Supabase client...");
    
    // Use the already configured Supabase client instead of creating admin client
    
    console.log("Insertando evento en DB:", JSON.stringify(event));
    
    // Convert to database-compatible format
    const eventData = {
      title: event.title,
      description: event.description,
      category: event.category,
      date: event.date instanceof Date ? event.date.toISOString() : new Date(event.date).toISOString(),
      // Temporarily commenting out end_time until column is added to database
      // end_time: event.endTime ? (event.endTime instanceof Date ? event.endTime.toISOString() : new Date(event.endTime).toISOString()) : null,
      latitude: event.latitude.toString(),
      longitude: event.longitude.toString(),
      location_name: event.locationName,
      location_address: event.locationAddress,
      payment_type: event.paymentType || 'free',
      price: event.price ? event.price.toString() : null,
      max_capacity: event.maxCapacity,
      privacy_type: event.privacyType || 'public',
      gender_preference: event.genderPreference || 'all_people',
      media_items: event.mediaItems,
      main_media_type: event.mainMediaType,
      main_media_url: event.mainMediaUrl,
      organizer_id: parseInt(event.organizerId.toString())
    };
    
    console.log("Datos formateados para DB:", JSON.stringify(eventData));
    
    const { data: newEvent, error } = await supabase
      .from('events')
      .insert([eventData])
      .select()
      .single();
    
    if (error) {
      console.error("Error al insertar evento en Supabase:", error);
      throw error;
    }
    
    console.log("Evento creado exitosamente:", JSON.stringify(newEvent));
    return newEvent;
  } catch (error) {
    console.error("Error al insertar evento en la base de datos:", error);
    throw error;
  }
};

export const updateEvent = async (id: number, eventData: Partial<Event>) => {
  console.log("Actualizando evento en la base de datos. ID:", id);
  console.log("Datos de multimedia a guardar:");
  console.log("- mediaItems:", eventData.mediaItems);
  console.log("- mainMediaType:", eventData.mainMediaType);
  console.log("- mainMediaUrl:", eventData.mainMediaUrl);
  
  // CRITICAL FIX: Convert camelCase field names to snake_case to match database schema
  const dbData: any = { ...eventData };
  
  // Convert field names from camelCase to snake_case to match database schema
  if (dbData.locationName !== undefined) {
    dbData.location_name = dbData.locationName;
    delete dbData.locationName;
  }
  if (dbData.locationAddress !== undefined) {
    dbData.location_address = dbData.locationAddress;
    delete dbData.locationAddress;
  }
  if (dbData.paymentType !== undefined) {
    dbData.payment_type = dbData.paymentType;
    delete dbData.paymentType;
  }
  if (dbData.maxCapacity !== undefined) {
    dbData.max_capacity = dbData.maxCapacity;
    delete dbData.maxCapacity;
  }
  if (dbData.privacyType !== undefined) {
    dbData.privacy_type = dbData.privacyType;
    delete dbData.privacyType;
  }
  if (dbData.mainMediaType !== undefined) {
    dbData.main_media_type = dbData.mainMediaType;
    delete dbData.mainMediaType;
  }
  if (dbData.mainMediaUrl !== undefined) {
    dbData.main_media_url = dbData.mainMediaUrl;
    delete dbData.mainMediaUrl;
  }
  if (dbData.mediaItems !== undefined) {
    dbData.media_items = dbData.mediaItems;
    delete dbData.mediaItems;
  }
  if (dbData.organizerId !== undefined) {
    dbData.organizer_id = dbData.organizerId;
    delete dbData.organizerId;
  }
  if (dbData.createdAt !== undefined) {
    dbData.created_at = dbData.createdAt;
    delete dbData.createdAt;
  }
  if (dbData.updatedAt !== undefined) {
    dbData.updated_at = dbData.updatedAt;
    delete dbData.updatedAt;
  }
  
  // CORRECCIÓN CRÍTICA: Asegurar coherencia entre mainMediaType y mediaItems
  if (dbData.media_items || dbData.mediaItems) {
    const mediaItemsData = dbData.media_items || dbData.mediaItems;
    try {
      // Intentar parsear mediaItems
      const mediaItems = JSON.parse(mediaItemsData as string);
      
      // Buscar el elemento principal
      const mainItem = mediaItems.find((item: any) => item && item.isMain === true);
      
      if (mainItem) {
        console.log("Encontrado elemento principal en mediaItems:", {
          tipo: mainItem.type,
          url: mainItem.url
        });
        
        // Asegurar que mainMediaType y mainMediaUrl coincidan con el elemento principal
        if (mainItem.type && mainItem.url) {
          // Solo actualizar si hay diferencias
          if (dbData.main_media_type !== mainItem.type) {
            console.log(`Corrigiendo mainMediaType para que coincida con mediaItems: ${mainItem.type}`);
            dbData.main_media_type = mainItem.type;
          }
          
          if (dbData.main_media_url !== mainItem.url) {
            console.log(`Corrigiendo mainMediaUrl para que coincida con mediaItems: ${mainItem.url}`);
            dbData.main_media_url = mainItem.url;
          }
        }
      }
    } catch (error) {
      console.error("Error al parsear mediaItems para verificar coherencia:", error);
    }
  }
  
  // Asegurar que mainMediaType sea siempre un string, no un array
  if (dbData.main_media_type && Array.isArray(dbData.main_media_type)) {
    const firstType = dbData.main_media_type[0] || 'photo';
    console.log(`Corrigiendo mainMediaType de array a string: → ${firstType}`);
    dbData.main_media_type = firstType;
  }
  
  // Crear un timestamp de actualización
  const updateTimestamp = new Date();
  
  // Actualizar el evento con los nuevos datos convertidos
  console.log("Updating event with ID:", id, "(type:", typeof id, ") and data keys:", Object.keys(dbData));
  
  // Ensure ID is a valid number
  const eventId = parseInt(id.toString());
  if (isNaN(eventId)) {
    throw new Error(`Invalid event ID: ${id}`);
  }
  
  try {
    // Use Supabase client directly for update to avoid Drizzle issues
    console.log("Attempting direct Supabase update for event:", eventId);
    
    const { data, error } = await supabase
      .from('events')
      .update({
        ...dbData,
        updated_at: updateTimestamp.toISOString()
      })
      .eq('id', eventId)
      .select()
      .single();
      
    if (error) {
      console.error("Supabase update error:", error);
      throw new Error(`Database update failed: ${error.message}`);
    }
    
    if (!data) {
      throw new Error("No event was updated - event may not exist");
    }
    
    console.log("Event updated successfully via Supabase");
    return data;
  } catch (dbError: any) {
    console.error("Database update failed:", dbError);
    throw new Error(`Failed to update event: ${dbError.message}`);
  }
};

export const deleteEvent = async (id: number) => {
  try {
    console.log("Deleting event:", id);
    
    // First delete all attendees using Supabase
    const { error: attendeesError } = await supabase
      .from('event_attendees')
      .delete()
      .eq('event_id', id);
    
    if (attendeesError) {
      console.error("Error deleting attendees:", attendeesError);
      throw new Error(`Failed to delete attendees: ${attendeesError.message}`);
    }
    
    // Then delete the event using Supabase
    const { data, error: eventError } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .select()
      .single();
    
    if (eventError) {
      console.error("Error deleting event:", eventError);
      throw new Error(`Failed to delete event: ${eventError.message}`);
    }
    
    console.log("Event deleted successfully:", id);
    return { id, deleted: true, data };
  } catch (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
};

export const deleteAllEvents = async () => {
  try {
    // First delete all attendees
    await db.delete(eventAttendees);
    
    // Then delete all events
    await db.delete(events);
    
    console.log("All events and attendees deleted successfully");
    return { message: "All events and attendees deleted successfully" };
  } catch (error) {
    console.error("Error deleting all events:", error);
    throw error;
  }
};

// Event Attendees related storage functions
export const joinEvent = async (attendee: InsertEventAttendee) => {
  const [newAttendee] = await db.insert(eventAttendees).values(attendee).returning();
  return newAttendee;
};

export const leaveEvent = async (eventId: number, userId: number) => {
  try {
    console.log("🔄 leaveEvent: Starting removal process for:", { eventId, userId });
    
    // Use Supabase client directly to avoid field mapping issues
    const { error } = await supabase
      .from('event_attendees')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);
    
    if (error) {
      console.error("❌ Supabase delete error:", error);
      throw new Error(`Failed to remove attendee: ${error.message}`);
    }
    
    console.log("✅ User left event successfully:", { eventId, userId });
    
    return { eventId, userId, removed: true };
  } catch (error) {
    console.error("❌ Error removing attendee:", error);
    throw error;
  }
};

export const getEventAttendees = async (eventId: number) => {
  return db.query.eventAttendees.findMany({
    where: eq(eventAttendees.eventId, eventId),
    with: {
      user: true
    }
  });
};

export const getEventAttendee = async (eventId: number, userId: number) => {
  try {
    // Use Supabase client directly to ensure consistency with delete operation
    const { data, error } = await supabase
      .from('event_attendees')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error("❌ Error fetching attendee:", error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("❌ Exception in getEventAttendee:", error);
    return null;
  }
};

export const updateEventAttendee = async (id: number, attendeeData: Partial<EventAttendee>) => {
  const [updatedAttendee] = await db
    .update(eventAttendees)
    .set(attendeeData)
    .where(eq(eventAttendees.id, id))
    .returning();
  return updatedAttendee;
};

export const insertEventAttendee = async (attendeeData: InsertEventAttendee) => {
  try {
    // Use Drizzle ORM instead of direct Supabase to avoid schema cache issues
    const [newAttendee] = await db.insert(eventAttendees).values({
      eventId: attendeeData.eventId,
      userId: attendeeData.userId,
      status: attendeeData.status || 'approved',
      paymentStatus: attendeeData.paymentStatus || 'pending',
      paymentIntentId: attendeeData.paymentIntentId || null,
      applicationAnswers: attendeeData.applicationAnswers || null,
    }).returning();
    
    return newAttendee;
  } catch (error) {
    console.error('Error in insertEventAttendee:', error);
    // Fallback to direct Supabase insert with minimal fields if Drizzle fails
    try {
      const dbData = {
        event_id: attendeeData.eventId,
        user_id: attendeeData.userId,
        status: attendeeData.status || 'approved',
        payment_status: attendeeData.paymentStatus || 'pending',
        payment_intent_id: attendeeData.paymentIntentId || null,
        created_at: new Date().toISOString()
      };

      console.log('Fallback: Insert operation using minimal fields:', Object.keys(dbData));
      
      const { data: newAttendee, error } = await supabase
        .from('event_attendees')
        .insert([dbData])
        .select()
        .single();
      
      if (error) {
        console.error('Fallback database insert error:', error);
        throw error;
      }
      
      return newAttendee;
    } catch (fallbackError) {
      console.error('Both Drizzle and Supabase insert failed:', fallbackError);
      throw fallbackError;
    }
  }
};

export const getEventAttendeeById = async (id: number) => {
  return db.query.eventAttendees.findFirst({
    where: eq(eventAttendees.id, id),
    with: {
      user: true,
      event: true
    }
  });
};

export const updatePaymentStatus = async (eventId: number, userId: number, paymentStatus: string, paymentIntentId: string) => {
  const [updatedAttendee] = await db
    .update(eventAttendees)
    .set({ 
      paymentStatus,
      paymentIntentId
    })
    .where(
      and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.userId, userId)
      )
    )
    .returning();
  return updatedAttendee;
};

// User Events
export const getUserCreatedEvents = async (userId: number) => {
  const { data, error } = await supabase
    .from('events')
    .select('*, attendees:event_attendees(*)')
    .eq('organizer_id', userId)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Error fetching user created events:', error);
    throw error;
  }
  
  return data || [];
};

export const getUserAttendingEvents = async (userId: number) => {
  const { data, error } = await supabase
    .from('event_attendees')
    .select('*, event:events(*, organizer:users(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching user attending events:', error);
    throw error;
  }
  
  return data || [];
};

// User interests related storage functions
export const getUserInterests = async (userId: number) => {
  return db.query.userInterests.findMany({
    where: eq(userInterests.userId, userId),
    orderBy: desc(userInterests.createdAt)
  });
};

export const addUserInterest = async (userId: number, category: string) => {
  // Use direct Supabase client instead of problematic Drizzle wrapper
  const { data, error } = await supabase
    .from('user_interests')
    .insert({
      user_id: userId,
      category: category,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
    
  if (error) {
    console.error('Error adding user interest:', error);
    throw error;
  }
  
  return data;
};

export const removeUserInterest = async (interestId: number) => {
  await db.delete(userInterests).where(eq(userInterests.id, interestId));
};

// Private event access control functions
export const getPendingEventRequests = async (eventId: number) => {
  try {
    console.log(`📋 Fetching pending requests for event ${eventId}`);
    
    const { data, error } = await supabase
      .from('event_attendees')
      .select(`
        *,
        user:users(id, name, username, email, avatar),
        event:events(id, title, date, privacy_type, private_access_type)
      `)
      .eq('event_id', eventId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching pending requests:", error);
      throw error;
    }
    
    console.log(`📋 Found ${data?.length || 0} pending requests for event ${eventId}`);
    return data || [];
  } catch (error) {
    console.error("Exception in getPendingEventRequests:", error);
    throw error;
  }
};

// Get all pending requests for events organized by the user
export const getAllPendingRequestsForUser = async (organizerId: number) => {
  try {
    console.log(`📋 Fetching all pending requests for organizer ${organizerId}`);
    
    // First get all events organized by this user
    const { data: userEvents, error: eventsError } = await supabase
      .from('events')
      .select('id, title, date')
      .eq('organizer_id', organizerId);
    
    if (eventsError) {
      console.error("Error fetching user events:", eventsError);
      throw eventsError;
    }
    
    if (!userEvents || userEvents.length === 0) {
      console.log(`📋 No events found for organizer ${organizerId}`);
      return [];
    }
    
    const eventIds = userEvents.map(event => event.id);
    console.log(`📋 Found ${eventIds.length} events for organizer: ${eventIds.join(', ')}`);
    
    // Get all pending attendees for these events
    const { data: attendees, error } = await supabase
      .from('event_attendees')
      .select('*')
      .in('event_id', eventIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching pending requests:", error);
      throw error;
    }
    
    if (!attendees || attendees.length === 0) {
      console.log(`📋 No pending requests found for organizer ${organizerId}`);
      return [];
    }
    
    // Get user details for each attendee
    const userIds = Array.from(new Set(attendees.map(a => a.user_id)));
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, avatar')
      .in('id', userIds);
    
    if (usersError) {
      console.error("Error fetching user details:", usersError);
      throw usersError;
    }
    
    // Combine the data
    const result = attendees.map(attendee => {
      const event = userEvents.find(e => e.id === attendee.event_id);
      const user = users?.find(u => u.id === attendee.user_id);
      
      return {
        ...attendee,
        event,
        user
      };
    });
    
    console.log(`📋 Found ${result.length} total pending requests for organizer ${organizerId}`);
    return result;
  } catch (error) {
    console.error("Exception in getAllPendingRequestsForUser:", error);
    throw error;
  }
};

export const approveEventAttendee = async (eventId: number, userId: number) => {
  try {
    console.log(`✅ Approving attendee ${userId} for event ${eventId}`);
    
    const { data, error } = await supabase
      .from('event_attendees')
      .update({ 
        status: 'approved',
        payment_status: 'completed'
      })
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      console.error("Error approving attendee:", error);
      throw error;
    }
    
    if (data) {
      console.log(`✅ Successfully approved attendee ${userId} for event ${eventId}`);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error("Exception in approveEventAttendee:", error);
    throw error;
  }
};

export const rejectEventAttendee = async (eventId: number, userId: number) => {
  try {
    console.log(`❌ Rejecting attendee ${userId} for event ${eventId}`);
    
    // For rejected requests, we remove the record entirely instead of setting status to 'rejected'
    const { error } = await supabase
      .from('event_attendees')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);
    
    if (error) {
      console.error("Error rejecting attendee:", error);
      throw error;
    }
    
    console.log(`❌ Successfully rejected attendee ${userId} for event ${eventId}`);
    return true;
  } catch (error) {
    console.error("Exception in rejectEventAttendee:", error);
    throw error;
  }
};

// Notification functions
export const createNotification = async (notificationData: {
  userId: number;
  type: 'request_approved' | 'request_rejected' | 'new_request';
  title: string;
  message: string;
  eventId?: number;
  requestId?: number;
}) => {
  try {
    const [newNotification] = await db.insert(notifications).values({
      userId: notificationData.userId,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      eventId: notificationData.eventId || null,
      requestId: notificationData.requestId || null,
    }).returning();
    
    return newNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export const storage = {
  getUserById,
  getUserByEmail,
  getUserByUsername,
  getUserBySupabaseId,
  insertUser,
  updateUser,
  updateStripeCustomerId,
  updateUserStripeInfo,
  getEventById,
  getEvents,
  getNearbyEvents,
  insertEvent,
  updateEvent,
  deleteEvent,
  deleteAllEvents,
  joinEvent,
  leaveEvent,
  getEventAttendees,
  getEventAttendee,
  insertEventAttendee,
  getEventAttendeeById,
  updateEventAttendee,
  updatePaymentStatus,
  getUserCreatedEvents,
  getUserAttendingEvents,
  getUserInterests,
  addUserInterest,
  removeUserInterest,
  getPendingEventRequests,
  approveEventAttendee,
  rejectEventAttendee,
  createNotification
};
