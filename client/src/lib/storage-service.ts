import { supabase } from './supabase-client';
import { v4 as uuidv4 } from 'uuid';

// Storage bucket name (must match the one created in Supabase)
const MEDIA_BUCKET = 'event-media';

// File types
type FileType = 'photo' | 'video';

// Media item interface
interface MediaItem {
  type: string;
  url: string;
  order: number;
  isMain?: boolean;
  id?: string;
}

// Service for handling file storage with Supabase
class StorageService {
  // Upload a file to Supabase Storage
  async uploadFile(file: File, type: FileType): Promise<MediaItem | null> {
    try {
      const fileExt = file.name.split('.').pop() || '';
      const fileName = `${type}-${uuidv4()}.${fileExt}`;
      const filePath = `${type}s/${fileName}`;

      // Upload the file
      const { data, error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Error uploading file to Supabase storage:', error);
        return null;
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from(MEDIA_BUCKET)
        .getPublicUrl(filePath);

      // Return media item
      return {
        type,
        url: urlData.publicUrl,
        order: 0, // Default order, can be updated later
      };
    } catch (error) {
      console.error('Error in uploadFile:', error);
      return null;
    }
  }

  // Upload multiple files
  async uploadFiles(files: File[], types: FileType[]): Promise<MediaItem[]> {
    const results: MediaItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = types[i] || (file.type.startsWith('image/') ? 'photo' : 'video');
      const result = await this.uploadFile(file, type);

      if (result) {
        // Assign order based on position
        result.order = i;
        results.push(result);
      }
    }

    return results;
  }

  // Delete a file from Supabase Storage
  async deleteFile(url: string): Promise<boolean> {
    try {
      // Extract file path from URL
      // Format: https://[supabase-project].supabase.co/storage/v1/object/public/[bucket]/[filepath]
      const urlParts = url.split('/storage/v1/object/public/');
      if (urlParts.length < 2) {
        console.error('Invalid Supabase Storage URL format');
        return false;
      }

      const pathParts = urlParts[1].split('/');
      if (pathParts.length < 2) {
        console.error('Invalid Supabase Storage path');
        return false;
      }

      // Remove bucket name from path
      pathParts.shift();
      const filePath = pathParts.join('/');

      // Delete the file
      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting file from Supabase storage:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteFile:', error);
      return false;
    }
  }

  // Process media items (upload new, handle existing)
  async processMediaItems(
    existingItems: MediaItem[] = [], 
    newFiles: File[] = [],
    newTypes: FileType[] = [],
    itemsToDelete: string[] = []
  ): Promise<{
    mediaItems: MediaItem[],
    mainMediaUrl: string | null,
    mainMediaType: FileType | null
  }> {
    // Delete items marked for deletion
    for (const url of itemsToDelete) {
      await this.deleteFile(url);
    }

    // Upload new files
    const newItems = await this.uploadFiles(newFiles, newTypes);

    // Combine existing and new items
    // Filter out items marked for deletion
    const combinedItems = [
      ...existingItems.filter(item => !itemsToDelete.includes(item.url)),
      ...newItems
    ];

    // Set the first item as main if there's no main item
    let mainItem = combinedItems.find(item => item.isMain);
    if (!mainItem && combinedItems.length > 0) {
      combinedItems[0].isMain = true;
      mainItem = combinedItems[0];
    }

    return {
      mediaItems: combinedItems,
      mainMediaUrl: mainItem?.url || null,
      mainMediaType: mainItem?.type as FileType || null
    };
  }
}

// Create and export singleton instance
export const storageService = new StorageService();

export default storageService;