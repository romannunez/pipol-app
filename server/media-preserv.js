
// This is a quick fix for storing event media
const checkAndPreserveMedia = (event, mediaItems, mainMediaUrl, mainMediaType, updateData) => {
  // Verificar si mediaItems está vacío pero el evento tenía mediaItems antes
  if (mediaItems.length === 0 && event.mediaItems && event.mediaItems !== "[]") {
    try {
      const originalMediaItems = JSON.parse(event.mediaItems);
      if (Array.isArray(originalMediaItems) && originalMediaItems.length > 0) {
        console.log("🔒 PRESERVANDO MEDIOS ORIGINALES: Detectada posible pérdida de datos multimedia");
        console.log("Evento tenía " + originalMediaItems.length + " elementos multimedia antes de la actualización");
        mediaItems = originalMediaItems;
        
        // También restaurar el elemento principal si existe
        const mainItem = originalMediaItems.find(item => item.isMain);
        if (mainItem) {
          mainMediaUrl = mainItem.url;
          mainMediaType = mainItem.type;
        }
      }
    } catch (e) {
      console.error("Error al intentar recuperar mediaItems originales:", e);
    }
  }
  
  updateData.mediaItems = JSON.stringify(mediaItems);
  updateData.mainMediaUrl = mainMediaUrl;
  updateData.mainMediaType = mainMediaType;
  
  return { mediaItems, mainMediaUrl, mainMediaType };
};

module.exports = { checkAndPreserveMedia };