import { storage } from '../storage';
import { deleteFile } from '../supabase-storage';

/**
 * Preserves existing media when a client sends incomplete media data
 * This function is used to keep existing media files when the client
 * submits an update form without all media information
 * 
 * @param eventId The ID of the event
 * @param mediaItemsFromClient Media items sent by the client
 * @returns Array of complete media items
 */
export async function preserveExistingMedia(eventId: number, mediaItemsFromClient: any[] = []) {
  try {
    // Get the event with its media items
    const event = await storage.getEventById(eventId);
    
    if (!event || !Array.isArray(event.mediaItems)) {
      console.log('No event found or no media items to preserve');
      return mediaItemsFromClient;
    }
    
    // Track which items should be preserved
    const clientMediaUrls = new Set(
      mediaItemsFromClient
        .filter(item => !item.deleted && !item.toDelete)
        .map(item => item.url)
    );
    
    // Items to delete
    const itemsToDelete = mediaItemsFromClient
      .filter(item => item.deleted || item.toDelete)
      .map(item => item.url)
      .filter(Boolean);
    
    // Delete items that are marked for deletion
    if (itemsToDelete.length > 0) {
      console.log(`Will delete ${itemsToDelete.length} media items`);
      
      for (const url of itemsToDelete) {
        try {
          await deleteFile(url);
          console.log(`Deleted file: ${url}`);
        } catch (error) {
          console.error(`Error deleting file ${url}:`, error);
        }
      }
    }
    
    // Preserve existing media not explicitly deleted
    const preservedItems = event.mediaItems
      .filter(item => {
        // Keep if not marked for deletion on client side
        return !itemsToDelete.includes(item.url);
      })
      .map(item => ({
        id: item.id,
        type: item.type,
        url: item.url,
        order: item.order || 0,
        isMain: !!item.isMain
      }));
    
    // New items from the client (excluding those marked for deletion)
    const newItems = mediaItemsFromClient
      .filter(item => {
        return !item.deleted && 
               !item.toDelete && 
               !preservedItems.some(p => p.url === item.url);
      })
      .map(item => ({
        type: item.type,
        url: item.url,
        order: item.order || 0,
        isMain: !!item.isMain
      }));
    
    // Combine preserved and new items
    const combinedItems = [...preservedItems, ...newItems];
    
    // Sort by order
    combinedItems.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    console.log(`Media preservation result: ${preservedItems.length} preserved, ${newItems.length} new`);
    
    return combinedItems;
  } catch (error) {
    console.error('Error in preserveExistingMedia:', error);
    return mediaItemsFromClient;
  }
}