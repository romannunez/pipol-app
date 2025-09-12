// Script para reparar los medios perdidos en el evento con ID 6
import { storage } from '../server/storage.js';
import { db } from '../server/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixEventMedia() {
  try {
    console.log("Iniciando reparación de medios para el evento #6...");
    
    // Obtener el evento actual
    const event = await storage.getEventById(6);
    if (!event) {
      console.error("No se encontró el evento con ID 6");
      return;
    }
    
    console.log("Estado actual del evento:", {
      id: event.id,
      title: event.title,
      mediaItems: event.mediaItems,
      mainMediaUrl: event.mainMediaUrl,
      mainMediaType: event.mainMediaType
    });
    
    // Obtener la lista de archivos de medios existentes para este evento
    const uploadDir = path.join(process.cwd(), 'public/uploads/events');
    const files = fs.readdirSync(uploadDir);
    
    // Buscar archivos de video relacionados (sabemos que había un video específico)
    const eventMediaFiles = files.filter(file => 
      file.includes('event-1747358019955-759994718.mp4')
    );
    
    if (eventMediaFiles.length === 0) {
      console.log("No se encontraron archivos de medios para este evento");
      return;
    }
    
    console.log("Archivos de medios encontrados:", eventMediaFiles);
    
    // Construir los objetos mediaItems
    const mediaItems = eventMediaFiles.map((file, index) => {
      const fileType = file.endsWith('.mp4') ? 'video' : 'photo';
      const url = `/uploads/events/${file}`;
      return {
        type: fileType,
        url: url,
        order: index,
        isMain: index === 0 // El primer elemento será el principal
      };
    });
    
    // Preparar datos de actualización
    const mainMedia = mediaItems.find(item => item.isMain);
    const updateData = {
      mediaItems: JSON.stringify(mediaItems),
      mainMediaUrl: mainMedia ? mainMedia.url : '',
      mainMediaType: mainMedia ? mainMedia.type : 'photo'
    };
    
    console.log("Datos de actualización preparados:", updateData);
    
    // Actualizar el evento en la base de datos
    await storage.updateEvent(6, updateData);
    
    // Verificar actualización
    const updatedEvent = await storage.getEventById(6);
    console.log("Estado actualizado del evento:", {
      id: updatedEvent.id,
      title: updatedEvent.title,
      mediaItems: updatedEvent.mediaItems,
      mainMediaUrl: updatedEvent.mainMediaUrl,
      mainMediaType: updatedEvent.mainMediaType
    });
    
    console.log("¡Reparación completada exitosamente!");
  } catch (error) {
    console.error("Error al reparar medios:", error);
  }
}

// Ejecutar la función principal
fixEventMedia().then(() => {
  console.log("Script finalizado");
  process.exit(0);
}).catch(error => {
  console.error("Error en script:", error);
  process.exit(1);
});