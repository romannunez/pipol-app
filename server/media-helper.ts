/**
 * Media helper functions for processing uploaded files in events
 */
import { Request } from 'express';
import multer from 'multer';

interface MediaItem {
  type: string;
  url: string;
  order: number;
  isMain?: boolean;
  id?: string;
}

interface MediaItemInfo {
  id?: string;
  type: string;
  url?: string;
  isMain?: boolean;
  isNew?: boolean;
  fileIndex?: number;
  order?: number;
  deleted?: boolean;
  toDelete?: boolean;
}

interface MediaProcessingResult {
  mediaItems: MediaItem[];
  mainMediaUrl: string | null;
  mainMediaType: string | null;
}

/**
 * Processes newly uploaded media files and assigns them to the correct media items
 */
export function processUploadedMedia(
  files: { [fieldname: string]: Express.Multer.File[] },
  mediaItems: MediaItem[] = [], 
  newMediaItemsInfo: MediaItemInfo[] = []
): MediaProcessingResult {
  if (!files || Object.keys(files).length === 0) {
    console.log("No files uploaded");
    return { 
      mediaItems, 
      mainMediaUrl: null, 
      mainMediaType: null 
    };
  }

  console.log("Processing uploaded files:", Object.keys(files));
  let mainMediaUrl: string | null = null;
  let mainMediaType: string | null = null;
  
  // Go through all uploaded files
  for (const fieldName in files) {
    if (files[fieldName] && files[fieldName].length > 0) {
      const file = files[fieldName][0];
      if (!file) continue;
      
      const filePath = file.path.replace('public', '');
      const fileType = file.mimetype.startsWith('video/') ? 'video' : 'photo';
      
      console.log(`Found file ${fieldName}: ${filePath} (${fileType})`);
      
      // Find if there's a corresponding new media item
      const fieldIndex = fieldName.startsWith('mediaFile_') ? 
        parseInt(fieldName.split('_')[1]) : -1;
        
      let matchingItem = newMediaItemsInfo.find(item => 
        item.id && item.id.startsWith('new-') && 
        // Either this is a mainMediaFile or the item has a fileIndex matching the field name suffix
        (fieldName === 'mainMediaFile' || 
         (fieldName.startsWith('mediaFile_') && 
          item.fileIndex === fieldIndex))
      );
      
      if (matchingItem) {
        // Update the matching item with the real file path
        console.log(`Assigning URL ${filePath} to item ${matchingItem.id}`);
        matchingItem.url = filePath;
        matchingItem.type = fileType;
        
        // If this is the main media or marked as main, update main media reference
        if (matchingItem.isMain || fieldName === 'mainMediaFile') {
          mainMediaUrl = filePath;
          mainMediaType = fileType;
          matchingItem.isMain = true;
        }
        
        // Add this item to mediaItems if it's not already there
        if (!mediaItems.some(item => item.url === filePath)) {
          mediaItems.push({
            type: fileType,
            url: filePath,
            order: mediaItems.length,
            isMain: matchingItem.isMain || false
          });
        }
      } else {
        // If no matching item was found, add as a new item
        console.log(`Adding new media item for ${filePath}`);
        const isMain = fieldName === 'mainMediaFile';
        
        mediaItems.push({
          type: fileType,
          url: filePath,
          order: mediaItems.length,
          isMain
        });
        
        if (isMain) {
          mainMediaUrl = filePath;
          mainMediaType = fileType;
        }
      }
    }
  }
  
  // If there's an item marked as main but no main URL yet, use that item
  if (!mainMediaUrl && mediaItems.length > 0) {
    const mainItem = mediaItems.find(item => item.isMain);
    if (mainItem) {
      mainMediaUrl = mainItem.url;
      mainMediaType = mainItem.type;
    } else {
      // Default to the first item if nothing is marked as main
      mainMediaUrl = mediaItems[0].url;
      mainMediaType = mediaItems[0].type;
      mediaItems[0].isMain = true;
    }
  }
  
  // Sort media items so main item appears first
  const sortedMediaItems = mediaItems.sort((a, b) => {
    // If one is main and the other is not, main goes first
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    // If both are main or neither is main, sort by order
    return (a.order || 0) - (b.order || 0);
  });

  return { mediaItems: sortedMediaItems, mainMediaUrl, mainMediaType };
}

/**
 * Preserves existing media when client sends incomplete media data
 */
export function preserveExistingMedia(
  event: any, 
  clientMediaItems: MediaItem[], 
  updateData: any
): boolean {
  // Check if the event already has media items but client sent none or empty array
  if (event.mediaItems && 
     (!clientMediaItems || clientMediaItems.length === 0)) {
    console.log("PRESERVING EXISTING MEDIA - Client sent empty media items");
    try {
      // Parse existing media items from event
      let existingMediaItems: MediaItem[] = [];
      
      if (typeof event.mediaItems === 'string') {
        existingMediaItems = JSON.parse(event.mediaItems);
      } else if (Array.isArray(event.mediaItems)) {
        existingMediaItems = event.mediaItems;
      }
      
      if (existingMediaItems && existingMediaItems.length > 0) {
        console.log(`Preserving ${existingMediaItems.length} existing media items`);
        updateData.mediaItems = JSON.stringify(existingMediaItems);
        
        // Also preserve main media reference
        if (event.mainMediaUrl) {
          updateData.mainMediaUrl = event.mainMediaUrl;
          updateData.mainMediaType = event.mainMediaType || 'photo';
        }
        
        return true;
      }
    } catch (e) {
      console.warn("Error preserving media:", e);
    }
  }
  return false;
}