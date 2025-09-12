// Script de diagnóstico y solución para problemas de medios
import { storage } from '../server/storage.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analizeMediaItems() {
  try {
    console.log("=== COMENZANDO ANÁLISIS DE PROBLEMA DE MEDIOS ===");
    console.log("1. Verificando estructura de directorios de medios...");
    
    const uploadsDir = path.join(process.cwd(), 'public/uploads/events');
    if (!fs.existsSync(uploadsDir)) {
      console.error(`ERROR: El directorio ${uploadsDir} no existe!`);
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`✓ Directorio ${uploadsDir} creado.`);
    } else {
      console.log(`✓ Directorio ${uploadsDir} existe.`);
      const files = fs.readdirSync(uploadsDir);
      console.log(`  - Contiene ${files.length} archivos.`);
    }
    
    console.log("\n2. Analizando medios del evento #6...");
    const event = await storage.getEventById(6);
    
    if (!event) {
      console.error("ERROR: No se encontró el evento con ID 6");
      return;
    }
    
    console.log(`✓ Evento encontrado: "${event.title}"`);
    console.log(`  - Tipo de medio principal: ${event.mainMediaType || 'ninguno'}`);
    console.log(`  - URL de medio principal: ${event.mainMediaUrl || 'ninguna'}`);
    
    // Analizar mediaItems
    let mediaItems = [];
    try {
      if (event.mediaItems) {
        mediaItems = JSON.parse(event.mediaItems);
        console.log(`✓ Media items parseados: ${mediaItems.length} elementos`);
        mediaItems.forEach((item, index) => {
          console.log(`    [${index}] ${item.type}: ${item.url} (Principal: ${item.isMain ? 'Sí' : 'No'})`);
        });
      } else {
        console.log("❌ El evento no tiene mediaItems definidos");
      }
    } catch (error) {
      console.error("❌ Error al parsear mediaItems:", error);
    }
    
    // Verificar si los archivos existen físicamente
    console.log("\n3. Verificando existencia física de archivos...");
    for (const item of mediaItems) {
      if (item.url) {
        const filePath = path.join(process.cwd(), 'public', item.url);
        if (fs.existsSync(filePath)) {
          console.log(`✓ Archivo ${item.url} existe físicamente`);
        } else {
          console.log(`❌ Archivo ${item.url} NO existe físicamente`);
        }
      }
    }
    
    // Configurar evento con el video si está bien
    console.log("\n4. Verificando reparación anterior...");
    const videoFileName = 'event-1747358019955-759994718.mp4';
    const videoPath = path.join(uploadsDir, videoFileName);
    
    if (fs.existsSync(videoPath)) {
      console.log(`✓ El archivo de video principal existe: ${videoFileName}`);
      
      // Verificar si ya está configurado correctamente
      const videoUrl = `/uploads/events/${videoFileName}`;
      if (event.mainMediaUrl === videoUrl && event.mainMediaType === 'video') {
        console.log("✓ El evento ya tiene el video configurado correctamente como medio principal");
        
        // Verificar que esté en mediaItems
        const hasVideoInMediaItems = mediaItems.some(item => 
          item.url === videoUrl && item.type === 'video');
        
        if (hasVideoInMediaItems) {
          console.log("✓ El video también está incluido en el array mediaItems");
        } else {
          console.log("❌ El video NO está incluido en el array mediaItems");
          console.log("   Agregando video a mediaItems...");
          
          // Crear nuevo array con el video
          const updatedMediaItems = [
            { type: 'video', url: videoUrl, order: 0, isMain: true }
          ];
          
          // Actualizar el evento
          await storage.updateEvent(6, {
            mediaItems: JSON.stringify(updatedMediaItems)
          });
          
          console.log("✓ Video agregado a mediaItems");
        }
      } else {
        console.log("❌ El evento no tiene el video configurado correctamente");
        console.log("   Configurando video como medio principal...");
        
        // Configurar video como medio principal
        await storage.updateEvent(6, {
          mainMediaType: 'video',
          mainMediaUrl: videoUrl,
          mediaItems: JSON.stringify([
            { type: 'video', url: videoUrl, order: 0, isMain: true }
          ])
        });
        
        console.log("✓ Video configurado como medio principal");
      }
    } else {
      console.log(`❌ El archivo de video principal NO existe: ${videoFileName}`);
    }
    
    // Verificar estado final
    console.log("\n5. Verificando estado final del evento...");
    const updatedEvent = await storage.getEventById(6);
    console.log(`- Tipo de medio principal: ${updatedEvent.mainMediaType || 'ninguno'}`);
    console.log(`- URL de medio principal: ${updatedEvent.mainMediaUrl || 'ninguna'}`);
    
    let updatedMediaItems = [];
    try {
      if (updatedEvent.mediaItems) {
        updatedMediaItems = JSON.parse(updatedEvent.mediaItems);
        console.log(`- Media items: ${updatedMediaItems.length} elementos`);
        updatedMediaItems.forEach((item, index) => {
          console.log(`    [${index}] ${item.type}: ${item.url} (Principal: ${item.isMain ? 'Sí' : 'No'})`);
        });
      } else {
        console.log("- El evento no tiene mediaItems definidos");
      }
    } catch (error) {
      console.error("- Error al parsear mediaItems:", error);
    }
    
    console.log("\n=== ANÁLISIS COMPLETADO ===");
    
  } catch (error) {
    console.error("Error en el análisis:", error);
  }
}

// Ejecutar la función principal
analizeMediaItems().then(() => {
  console.log("\nDiagnóstico finalizado");
  process.exit(0);
}).catch(error => {
  console.error("Error en script:", error);
  process.exit(1);
});