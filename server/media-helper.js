/**
 * Media helper functions for processing uploaded files in events
 */

/**
 * Processes newly uploaded media files and assigns them to the correct media items
 * @param {Object} files - The files object from multer
 * @param {Array} mediaItems - The array of existing media items
 * @param {Array} newMediaItems - Array of newly added media items from client
 * @returns {Object} Updated media information
 */
function processUploadedMedia(files, mediaItems = [], newMediaItems = []) {
  if (!files || Object.keys(files).length === 0) {
    console.log("No files uploaded");
    return { mediaItems, mainMediaUrl: null, mainMediaType: null };
  }

  console.log("Processing uploaded files:", Object.keys(files));
  let mainMediaUrl = null;
  let mainMediaType = null;
  
  // Go through all uploaded files
  for (const fieldName in files) {
    if (files[fieldName] && files[fieldName].length > 0) {
      const file = files[fieldName][0];
      if (!file) continue;
      
      const filePath = file.path.replace('public', '');
      const fileType = file.mimetype.startsWith('video/') ? 'video' : 'photo';
      
      console.log(`Found file ${fieldName}: ${filePath} (${fileType})`);
      
      // Find if there's a corresponding new media item
      let matchingItem = newMediaItems.find(item => 
        item.id && item.id.startsWith('new-') && 
        // Either this is a mainMediaFile or the item has a fileIndex matching the field name suffix
        (fieldName === 'mainMediaFile' || 
         (fieldName.startsWith('mediaFile_') && 
          item.fileIndex == fieldName.split('_')[1]))
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
  
  return { mediaItems, mainMediaUrl, mainMediaType };
}

module.exports = {
  processUploadedMedia
};