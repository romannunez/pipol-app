import React, { useEffect } from 'react';

interface MediaDebugProps {
  event: any;
}

export const MediaDebug: React.FC<MediaDebugProps> = ({ event }) => {
  useEffect(() => {
    // Solo ejecutar en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.group('🔍 DEBUG MULTIMEDIA - Evento #' + event.id);
      console.log('🎥 mainMediaUrl:', event.mainMediaUrl);
      console.log('📊 mainMediaType:', event.mainMediaType);
      
      try {
        let mediaItems = [];
        if (typeof event.mediaItems === 'string') {
          try {
            mediaItems = JSON.parse(event.mediaItems);
            console.log('📋 mediaItems parseados:', mediaItems);
          } catch (e) {
            console.error('❌ Error parseando mediaItems:', e);
          }
        } else if (Array.isArray(event.mediaItems)) {
          mediaItems = event.mediaItems;
          console.log('📋 mediaItems (ya es array):', mediaItems);
        } else {
          console.log('❓ mediaItems formato desconocido:', typeof event.mediaItems, event.mediaItems);
        }
        
        // Verificar la validez de cada elemento
        if (Array.isArray(mediaItems) && mediaItems.length > 0) {
          mediaItems.forEach((item, index) => {
            console.log(`Item #${index}:`, item);
            console.log(`  - ¿Tiene URL? ${!!item.url}`);
            console.log(`  - ¿Tipo válido? ${item.type === 'photo' || item.type === 'video'}`);
            console.log(`  - ¿Es principal? ${!!item.isMain}`);
          });
          
          const validItems = mediaItems.filter(item => 
            item && 
            typeof item === 'object' && 
            typeof item.url === 'string' && 
            (item.type === 'photo' || item.type === 'video')
          );
          
          console.log(`✅ Items válidos: ${validItems.length} de ${mediaItems.length}`);
          validItems.forEach((item, index) => {
            console.log(`Item válido #${index}:`, item);
          });
        } else {
          console.log('⚠️ No hay elementos multimedia');
        }
      } catch (error) {
        console.error('❌ Error general:', error);
      }
      
      console.groupEnd();
    }
  }, [event]);
  
  // No renderiza nada visualmente
  return null;
};

export default MediaDebug;