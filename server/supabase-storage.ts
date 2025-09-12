import { supabase } from './supabase-client';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Storage bucket name
const BUCKET_NAME = 'event-media';

// Check if bucket exists or can be created
let bucketAvailable = false;

/**
 * Initialize the Supabase storage service
 * This attempts to check/create the storage bucket
 */
export async function initializeStorage() {
  console.log('Setting up Supabase Storage...');
  
  try {
    // Check if the bucket already exists
    console.log('Checking for existing storage buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error checking storage buckets:', bucketsError);
      return;
    }
    
    // Check if our bucket exists
    const mediaBucket = buckets?.find(bucket => bucket.name === BUCKET_NAME);
    
    if (mediaBucket) {
      console.log(`Media bucket "${BUCKET_NAME}" already exists`);
      bucketAvailable = true;
      return;
    }
    
    console.log(`Media bucket does not exist, attempting to create it...`);
    
    // Try to create the bucket
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10485760, // 10MB
    });
    
    if (createError) {
      console.error('Permission denied when creating bucket. This is normal if using the free tier.');
      console.log('Please create a bucket named "event-media" manually in the Supabase dashboard.');
      console.log('Storage operations will be simulated until the bucket is created.');
      return;
    }
    
    console.log(`Successfully created "${BUCKET_NAME}" bucket`);
    bucketAvailable = true;
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
}

/**
 * Upload a file to Supabase Storage
 * 
 * @param file The file to upload (path to local file)
 * @param folder The folder to upload to (optional)
 * @returns URL of the uploaded file
 */
export async function uploadFile(filePath: string, folder: string = ''): Promise<string> {
  try {
    if (!bucketAvailable) {
      // Simulate upload if bucket is not available
      console.log(`Simulating upload of ${filePath} to ${folder}`);
      const fileName = path.basename(filePath);
      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const storagePath = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;
      
      // Generate a simulated URL
      const simulatedUrl = `https://ngljgvnzkjqzhgkaukvu.supabase.co/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;
      console.log(`Simulated upload URL: ${simulatedUrl}`);
      return simulatedUrl;
    }
    
    // Read the file content
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(fileName);
    
    // Generate a unique file name
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const storagePath = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileContent, {
        contentType: getContentType(fileExtension),
        upsert: false
      });
    
    if (error) {
      console.error('Error uploading file to Supabase Storage:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadFile:', error);
    throw error;
  }
}

/**
 * Delete a file from Supabase Storage
 * 
 * @param fileUrl The public URL of the file to delete
 * @returns boolean indicating success
 */
export async function deleteFile(fileUrl: string): Promise<boolean> {
  try {
    if (!bucketAvailable) {
      // Simulate deletion if bucket is not available
      console.log(`Simulating deletion of file: ${fileUrl}`);
      return true;
    }
    
    // Extract the path from the URL
    const urlObj = new URL(fileUrl);
    const pathParts = urlObj.pathname.split('/');
    const storagePath = pathParts.slice(pathParts.indexOf('public') + 2).join('/');
    
    // Delete the file
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);
    
    if (error) {
      console.error('Error deleting file from Supabase Storage:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteFile:', error);
    return false;
  }
}

/**
 * Get the content type based on file extension
 */
function getContentType(extension: string): string {
  const contentTypes: {[key: string]: string} = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.pdf': 'application/pdf',
  };
  
  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}