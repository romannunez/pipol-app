/**
 * Fix for media processing in event updates
 * 
 * This module provides functions to handle media uploads and properly assign them to events
 */

const fs = require('fs');
const path = require('path');

/**
 * Processes uploaded media files and assigns them to event media items
 * @param {Object} files - Files object from multer
 * @param {Array} mediaItems - Existing media items array
 * @param {Array} mediaItemsInfo - Info about media items including new items
 * @param {Object} event - The event being updated
 * @returns {Object} Object with updated mediaItems, mainMediaType and mainMediaUrl
 */
function processEventMediaUploads(files, mediaItems, mediaItemsInfo, event) {
  if (!files || Object.keys(files).length === 0) {
    console.log("No hay archivos para procesar");
    return { mediaItems, mainMediaType: null, mainMediaUrl: null };
  }

  console.log("Procesando archivos subidos:", Object.keys(files));
  let mainMediaUrl = null;
  let mainMediaType = 'photo'; // Default to photo
  let updatedMediaItems = [...mediaItems]; // Clone existing media items
  
  // Filter to find new media items (ones with IDs starting with "new-")
  const newMediaItems = mediaItemsInfo.filter(item => 
    item.id && item.id.startsWith('new-')
  );
  
  console.log(`Nuevos elementos multimedia detectados: ${newMediaItems.length}`);
  
  // Process each uploaded file
  Object.keys(files).forEach(fieldName => {
    if (files[fieldName] && files[fieldName].length > 0) {
      const file = files[fieldName][0];
      if (!file) return;
      
      const filePath = file.path.replace('public', '');
      const fileType = file.mimetype.startsWith('video/') ? 'video' : 'photo';
      
      console.log(`Archivo subido en campo ${fieldName}: ${filePath}`);
      
      // Find the corresponding new media item based on field name
      let mediaItemIndex = -1;
      
      if (fieldName === 'mainMediaFile') {
        // This is the main media file
        mainMediaUrl = filePath;
        mainMediaType = fileType;
        
        // Check if there's a media item marked as main
        const mainItemInfo = newMediaItems.find(item => item.isMain);
        if (mainItemInfo) {
          console.log(`Asignando URL al elemento principal: ${mainItemInfo.id}`);
          mainItemInfo.url = filePath;
        } else {
          // Add a new media item for this main file
          updatedMediaItems.push({
            type: fileType,
            url: filePath,
            order: updatedMediaItems.length,
            isMain: true
          });
        }
      } 
      else if (fieldName.startsWith('mediaFile_')) {
        // Regular media file - assign to the appropriate new media item
        const fieldIndex = parseInt(fieldName.split('_')[1], 10);
        const mediaItemInfo = newMediaItems.find(item => 
          item.fileIndex === fieldIndex || 
          parseInt(item.fileIndex, 10) === fieldIndex
        );
        
        if (mediaItemInfo) {
          console.log(`Asignando URL al elemento ${mediaItemInfo.id} (índice ${fieldIndex}): ${filePath}`);
          mediaItemInfo.url = filePath;
          
          // If this is marked as main, update main media references
          if (mediaItemInfo.isMain) {
            mainMediaUrl = filePath;
            mainMediaType = fileType;
          }
        }
        
        // Add this file to the media items array if not already there
        if (!updatedMediaItems.some(item => item.url === filePath)) {
          updatedMediaItems.push({
            type: fileType,
            url: filePath,
            order: updatedMediaItems.length,
            isMain: mediaItemInfo?.isMain || false
          });
        }
      }
    }
  });
  
  // Now update all media items with proper URLs and metadata
  updatedMediaItems = updatedMediaItems.map((item, index) => {
    // Find if there's a corresponding item in mediaItemsInfo
    const itemInfo = mediaItemsInfo.find(info => 
      info.url === item.url || 
      (info.id && item.id && info.id === item.id)
    );
    
    // If we found a matching item info, update from there
    if (itemInfo && itemInfo.url) {
      return {
        ...item,
        url: itemInfo.url,
        type: itemInfo.type || item.type,
        order: index,
        isMain: itemInfo.isMain || item.isMain || false
      };
    }
    
    // Otherwise just ensure order is correct
    return {
      ...item,
      order: index
    };
  });
  
  // If no main media was set but we have media items, use the first one
  if ((!mainMediaUrl || mainMediaUrl === '') && updatedMediaItems.length > 0) {
    const mainItem = updatedMediaItems.find(item => item.isMain) || updatedMediaItems[0];
    mainMediaUrl = mainItem.url;
    mainMediaType = mainItem.type;
    console.log(`Usando primer elemento como media principal: ${mainMediaType} - ${mainMediaUrl}`);
  }
  
  return {
    mediaItems: updatedMediaItems,
    mainMediaType,
    mainMediaUrl
  };
}

/**
 * Verifies that a media URL points to an existing file
 * @param {string} mediaUrl - URL to verify
 * @returns {boolean} - True if file exists, false otherwise
 */
function verifyMediaFile(mediaUrl) {
  if (!mediaUrl || mediaUrl.trim() === '') return false;
  
  try {
    const publicPath = path.join(process.cwd(), 'public', mediaUrl);
    return fs.existsSync(publicPath);
  } catch (err) {
    console.error(`Error verificando archivo: ${mediaUrl}`, err);
    return false;
  }
}

module.exports = {
  processEventMediaUploads,
  verifyMediaFile
};