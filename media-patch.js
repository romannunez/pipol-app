// Este parche es para solucionar el problema de pérdida de archivos multimedia al editar eventos
// Buscar la sección donde se procesan los mediaItems antes de guardar en la base de datos
// Alrededor de las líneas 1985-1992 en server/routes.ts

// ANTES DE ACTUALIZAR:
console.log("Datos de multimedia a guardar:");
console.log("- mediaItems:", mediaItems);
console.log("- mainMediaType:", mainMediaType);
console.log("- mainMediaUrl:", mainMediaUrl);

// Si mediaItems está vacío pero el evento tenía mediaItems antes de esta actualización
// esto indica un error del cliente al enviar los datos
if (mediaItems.length === 0 && event.mediaItems && event.mediaItems !== "[]") {
  try {
    // Intentar recuperar los mediaItems originales
    const originalMediaItems = JSON.parse(event.mediaItems);
    if (Array.isArray(originalMediaItems) && originalMediaItems.length > 0) {
      console.log("🔒 PRESERVANDO MEDIOS ORIGINALES: Se detectó pérdida de datos multimedia");
      console.log(`Evento tenía ${originalMediaItems.length} elementos multimedia antes de la actualización`);
      console.log("Conservando los elementos multimedia originales del evento");
      
      // Restaurar los mediaItems originales
      mediaItems = originalMediaItems;
      
      // Restaurar también el elemento principal
      const mainItem = originalMediaItems.find(item => item.isMain);
      if (mainItem) {
        mainMediaUrl = mainItem.url;
        mainMediaType = mainItem.type;
        console.log(`Restaurando elemento principal: ${mainMediaType} - ${mainMediaUrl}`);
      } else if (originalMediaItems.length > 0) {
        // Si no hay un elemento principal marcado, usar el primero
        mainMediaUrl = originalMediaItems[0].url;
        mainMediaType = originalMediaItems[0].type;
        originalMediaItems[0].isMain = true;
        console.log(`Estableciendo primer elemento como principal: ${mainMediaType} - ${mainMediaUrl}`);
      }
      
      // Actualizar también el updateData con estos valores
      updateData.mediaItems = JSON.stringify(mediaItems);
      updateData.mainMediaUrl = mainMediaUrl;
      updateData.mainMediaType = mainMediaType;
      
      console.log("Datos de multimedia ACTUALIZADOS para guardar:");
      console.log("- mediaItems:", mediaItems);
      console.log("- mainMediaType:", mainMediaType);
      console.log("- mainMediaUrl:", mainMediaUrl);
    }
  } catch (e) {
    console.error("Error al intentar recuperar mediaItems originales:", e);
  }
}