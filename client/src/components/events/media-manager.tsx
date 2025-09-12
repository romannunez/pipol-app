import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash, Video, Image, Star, StarOff, GripVertical, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import MediaPreview from './media-preview';

export type MediaItem = {
  id?: string;
  type: 'photo' | 'video';
  url?: string; // URL para medios existentes
  file?: File; // File para nuevos medios
  previewUrl?: string; // URL temporal para vista previa (solo para UI)
  isMain?: boolean;
  isNew?: boolean;
  deleted?: boolean; // Marca para vista (ocultar de la UI)
  toDelete?: boolean; // Marca para enviar al servidor (eliminación permanente)
  order?: number; // Para ordenamiento
  uploading?: boolean; // Estado de carga
  uploadProgress?: number; // Progreso de carga (0-100)
  errorMessage?: string; // Mensaje de error si falla la carga
  fileIndex?: number; // Índice del archivo para seguimiento en el servidor
};

type MediaManagerProps = {
  existingMedia?: MediaItem[] | string; // Puede ser string para JSON o MediaItem[]
  onChange: (media: MediaItem[]) => void;
  maxPhotos?: number;
  maxVideos?: number;
  disabled?: boolean;
};

export const MediaManager: React.FC<MediaManagerProps> = ({
  existingMedia = [],
  onChange,
  maxPhotos = 6,
  maxVideos = 3,
  disabled = false,
}) => {
  const { toast } = useToast();
  // Inicialización segura de mediaItems
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => {
    // Manejar caso donde existingMedia es undefined o null
    if (existingMedia === undefined || existingMedia === null) {
      console.log("existingMedia es undefined/null, inicializando como array vacío");
      return [];
    }
    
    // Manejar caso donde existingMedia es string
    if (typeof existingMedia === 'string') {
      try {
        // Si es string vacío, devolver array vacío
        if (!existingMedia.trim()) {
          return [];
        }
        
        const parsed = JSON.parse(existingMedia);
        
        // Verificar que el resultado sea un array
        if (!Array.isArray(parsed)) {
          console.warn("existingMedia parseado no es un array:", parsed);
          return [];
        }
        
        // Filtrar elementos inválidos
        return parsed.filter(item => item !== null && item !== undefined);
      } catch (e) {
        console.error('Error parsing media JSON:', e);
        return [];
      }
    }
    
    // Si es array, asegurarse de que todos los elementos son válidos
    if (Array.isArray(existingMedia)) {
      return existingMedia.filter(item => item !== null && item !== undefined);
    }
    
    // Caso por defecto
    console.warn("existingMedia no es un tipo reconocido:", typeof existingMedia);
    return [];
  });
  
  const [photoCount, setPhotoCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Actualizar los contadores cuando cambia la lista de medios
  useEffect(() => {
    if (!Array.isArray(mediaItems)) {
      console.error("mediaItems no es un array en useEffect");
      return;
    }
    
    // Contar fotos y videos válidos (no eliminados o marcados para eliminar)
    const photos = mediaItems.filter(
      item => item && item.type === 'photo' && !item.deleted && !item.toDelete
    );
    const videos = mediaItems.filter(
      item => item && item.type === 'video' && !item.deleted && !item.toDelete
    );
    
    setPhotoCount(photos.length);
    setVideoCount(videos.length);
  }, [mediaItems]);
  
  // Abrir el selector de archivos
  const handleAddMedia = (isPhoto: boolean) => {
    if (disabled) return;
    
    // Verificar si hay espacio disponible
    if (isPhoto && photoCount >= maxPhotos) {
      toast({
        title: "Límite alcanzado",
        description: `No puedes agregar más de ${maxPhotos} fotos`,
        variant: "destructive"
      });
      return;
    }
    
    if (!isPhoto && videoCount >= maxVideos) {
      toast({
        title: "Límite alcanzado",
        description: `No puedes agregar más de ${maxVideos} videos`,
        variant: "destructive"
      });
      return;
    }
    
    // Verificar y crear el input de archivos si es necesario
    if (!fileInputRef.current) {
      console.error("Input de archivos no encontrado");
      return;
    }
    
    // Establecer los tipos de archivos aceptados
    fileInputRef.current.accept = isPhoto ? 'image/*' : 'video/*';
    fileInputRef.current.dataset.type = isPhoto ? 'photo' : 'video';
    
    // Abrir el selector de archivos
    fileInputRef.current.click();
  };
  
  // Manejar la selección de archivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const isPhoto = e.target.dataset.type === 'photo';
    console.log(`Agregando ${files.length} ${isPhoto ? 'fotos' : 'videos'}`);
    
    // Calcular espacio disponible
    const currentCount = isPhoto ? photoCount : videoCount;
    const maxAllowed = isPhoto ? maxPhotos : maxVideos;
    const availableSlots = Math.max(0, maxAllowed - currentCount);
    
    if (availableSlots === 0) {
      toast({
        title: "Límite alcanzado",
        description: `No puedes agregar más ${isPhoto ? 'fotos' : 'videos'}`,
        variant: "destructive"
      });
      return;
    }
    
    if (files.length > availableSlots) {
      toast({
        title: "Demasiados archivos",
        description: `Solo se agregarán los primeros ${availableSlots} archivos`,
      });
    }
    
    // Limitar la cantidad de archivos que se pueden agregar
    const filesToAdd = files.slice(0, availableSlots);
    
    // Asegurarnos de que mediaItems es un array válido
    const safeMediaItems = Array.isArray(mediaItems) ? mediaItems : [];
    
    // Verificar si hay algún elemento principal existente (con protección adicional contra null/undefined)
    const hasMainItem = safeMediaItems.some(item => 
      item && item.isMain === true && item.deleted !== true && item.toDelete !== true
    );
    
    // Crear nuevos elementos de medios
    const newMediaItems = filesToAdd.map((file, idx): MediaItem => {
      // Para evitar archivos no soportados
      const isValidType = isPhoto 
        ? file.type.startsWith('image/') 
        : file.type.startsWith('video/');
      
      // Verificar el tamaño (límite de 5MB para imágenes, 10MB para videos)
      const maxSize = isPhoto ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
      const isSizeValid = file.size <= maxSize;
      
      // Determinar si este elemento debe ser principal
      // Prioridad para fotos como elemento principal
      const shouldBeMain = !hasMainItem && 
                          ((isPhoto && idx === 0) || 
                           (safeMediaItems.length === 0 && idx === 0));
      
      let errorMsg;
      if (!isValidType) {
        errorMsg = `Formato no soportado: ${file.type}`;
      } else if (!isSizeValid) {
        errorMsg = `Archivo demasiado grande: ${(file.size / (1024 * 1024)).toFixed(1)}MB (máx. ${isPhoto ? '5MB' : '10MB'})`;
      }
        
      // Generar un ID único para este elemento
      const uniqueId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Crear una URL de vista previa para el archivo (con manejo seguro)
      let previewUrl = '';
      try {
        previewUrl = URL.createObjectURL(file);
      } catch (error) {
        console.error("Error creando URL para vista previa:", error);
        errorMsg = errorMsg || "Error procesando archivo";
      }
      
      console.log(`Agregando nuevo elemento: ${uniqueId}, tipo: ${isPhoto ? 'photo' : 'video'}, archivo: ${file.name}`);
      
      // Crear objeto MediaItem con valores seguros
      return {
        id: uniqueId,
        type: isPhoto ? 'photo' : 'video',
        file,
        previewUrl, // URL temporal para vista previa
        isNew: true,
        order: safeMediaItems.length + idx,
        fileIndex: idx, // Agregar índice para seguimiento
        errorMessage: errorMsg,
        isMain: shouldBeMain && isValidType && isSizeValid
      };
    });
    
    // Filtrar archivos con errores que no se van a usar
    const validMediaItems = newMediaItems.filter(item => !item.errorMessage);
    const invalidMediaItems = newMediaItems.filter(item => !!item.errorMessage);
    
    // No mostramos alerta para archivos inválidos
    // Simplemente los incluimos en la lista con su mensaje de error
    // para que el usuario pueda eliminarlos manualmente
    
    // Actualizar el estado con los archivos nuevos
    // IMPORTANTE: Usar la versión segura de mediaItems (safeMediaItems)
    const updatedMedia = [...safeMediaItems, ...newMediaItems];
    console.log("Media antes de ordenar:", updatedMedia.length, "elementos");
    
    // Asegurarse de que no haya null/undefined en el array
    const cleanMedia = updatedMedia.filter(item => item !== null && item !== undefined);
    
    // Asegurarse de que no haya duplicados (basados en el ID único)
    // Manejo adicional para casos donde los atributos puedan ser undefined
    const uniqueMedia = Array.from(new Map(
      cleanMedia.map(item => {
        const key = item.id || `${item.url || (item.file ? item.file.name : '') || Date.now()}`;
        return [key, item];
      })
    ).values());
    
    console.log("Media después de eliminar duplicados:", uniqueMedia);
    
    // Ordenar los elementos asegurando que cada uno tiene un orden válido
    const sortedMedia = [...uniqueMedia].sort((a, b) => 
      (a.order || 0) - (b.order || 0)
    );
    
    // Asegurarse de que haya exactamente un elemento principal
    const mainItems = sortedMedia.filter(item => 
      item && item.isMain && !item.deleted && !item.toDelete && !item.errorMessage
    );
    
    let finalMedia = sortedMedia;
    
    // Si hay más de un elemento principal, dejar solo uno (priorizar fotos)
    if (mainItems.length > 1) {
      console.log("Hay más de un elemento principal, corrigiendo...");
      const mainPhoto = mainItems.find(item => item.type === 'photo');
      const itemToSetMain = mainPhoto || mainItems[0];
      console.log("Elemento principal seleccionado:", 
                 itemToSetMain.type, 
                 itemToSetMain.id || "sin ID");
      
      // Marcar solo uno como principal
      finalMedia = sortedMedia.map(item => ({
        ...item,
        isMain: item === itemToSetMain
      }));
    }
    // Si no hay ningún elemento principal y hay elementos válidos, marcar el primero como principal
    else if (mainItems.length === 0 && validMediaItems.length > 0) {
      console.log("No hay elemento principal, estableciendo uno automáticamente");
      // Buscar primero una foto para establecer como principal
      const firstPhoto = sortedMedia.find(
        item => item.type === 'photo' && !item.deleted && !item.toDelete && !item.errorMessage
      );
      const firstValid = firstPhoto || sortedMedia.find(
        item => !item.deleted && !item.toDelete && !item.errorMessage
      );
      
      if (firstValid) {
        finalMedia = sortedMedia.map(item => ({
          ...item,
          isMain: item === firstValid
        }));
        console.log("Elemento principal establecido automáticamente:", 
                   firstValid.type, 
                   firstValid.id || "sin ID");
      }
    }
    
    // Verificar cuántos elementos principales tenemos ahora
    const finalMainItems = finalMedia.filter(item => 
      item.isMain && !item.deleted && !item.toDelete
    );
    console.log("Elementos principales después de procesar:", finalMainItems.length);
    
    // Actualizar el estado con los elementos procesados
    setMediaItems(finalMedia);
    
    // Actualizar los contadores
    if (isPhoto) {
      setPhotoCount(prev => prev + validMediaItems.length);
    } else {
      setVideoCount(prev => prev + validMediaItems.length);
    }
    
    // Notificar al componente padre
    onChange(finalMedia);
    
    // Limpiar el input de archivos para permitir seleccionar el mismo archivo nuevamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Manejar arrastrar y soltar (drag & drop)
  const handleDragStart = (index: number) => {
    if (disabled) return;
    setDraggedItem(index);
  };
  
  const handleDragOver = (index: number) => {
    if (disabled) return;
    setDragOverItem(index);
  };
  
  const handleDragEnd = () => {
    if (disabled || draggedItem === null || dragOverItem === null) return;
    
    // Los índices deben ser distintos y válidos
    if (draggedItem === dragOverItem || 
        draggedItem < 0 || dragOverItem < 0 || 
        draggedItem >= mediaItems.length || dragOverItem >= mediaItems.length) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }
    
    // Crear una copia del array para no mutar el estado directamente
    const items = [...mediaItems];
    const draggedItemContent = items[draggedItem];
    
    // Protección contra elementos null/undefined
    if (!draggedItemContent) {
      console.error("El elemento arrastrado es null o undefined");
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }
    
    // Eliminar elemento arrastrado
    items.splice(draggedItem, 1);
    
    // Insertar en nueva posición
    items.splice(dragOverItem, 0, draggedItemContent);
    
    // Actualizar índices/orden
    const reorderedItems = items.map((item, idx) => ({
      ...item,
      order: idx
    }));
    
    // Actualizar estado local
    setMediaItems(reorderedItems);
    
    // Notificar al componente padre
    onChange(reorderedItems);
    
    // Limpiar estados de arrastre
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Eliminar un medio
  const handleRemoveMedia = (indexToRemove: number) => {
    if (disabled) return;
    
    // Verificar que el índice es válido y mediaItems existe
    if (!mediaItems || indexToRemove < 0 || indexToRemove >= mediaItems.length) {
      console.error("Índice de eliminación inválido o no hay elementos multimedia");
      return;
    }
    
    const itemToRemove = mediaItems[indexToRemove];
    
    // Verificar que itemToRemove existe
    if (!itemToRemove) {
      console.error("No se pudo encontrar el elemento a eliminar");
      return;
    }
    
    console.log("Eliminando elemento multimedia:", itemToRemove);
    
    // Si es un elemento nuevo, simplemente lo eliminamos del array
    if (itemToRemove.isNew) {
      console.log("Eliminando elemento nuevo:", itemToRemove);
      
      // Filtrar el elemento a eliminar
      const updatedMedia = mediaItems.filter((item, index) => index !== indexToRemove);
      
      // Verificar si necesitamos asignar un nuevo elemento principal
      if (itemToRemove.isMain && updatedMedia.length > 0) {
        console.log("El elemento eliminado era principal, buscando nuevo elemento principal");
        
        // Buscar primero una foto para establecer como principal
        const firstPhoto = updatedMedia.find(
          item => item.type === 'photo' && !item.deleted && !item.toDelete
        );
        
        const firstValid = firstPhoto || updatedMedia.find(
          item => !item.deleted && !item.toDelete
        );
        
        if (firstValid) {
          console.log("Nuevo elemento principal:", firstValid);
          
          // Marcar el nuevo elemento como principal
          const finalMedia = updatedMedia.map(item => ({
            ...item,
            isMain: item === firstValid
          }));
          
          // Actualizar estado
          setMediaItems(finalMedia);
          
          // Actualizar contadores
          const newPhotoCount = finalMedia.filter(
            item => item.type === 'photo' && !item.deleted && !item.toDelete
          ).length;
          
          const newVideoCount = finalMedia.filter(
            item => item.type === 'video' && !item.deleted && !item.toDelete
          ).length;
          
          setPhotoCount(newPhotoCount);
          setVideoCount(newVideoCount);
          
          // Notificar al componente padre
          onChange(finalMedia);
          return;
        }
      }
      
      // Actualizar estado
      setMediaItems(updatedMedia);
      
      // Actualizar contadores
      const newPhotoCount = updatedMedia.filter(
        item => item.type === 'photo' && !item.deleted && !item.toDelete
      ).length;
      
      const newVideoCount = updatedMedia.filter(
        item => item.type === 'video' && !item.deleted && !item.toDelete
      ).length;
      
      setPhotoCount(newPhotoCount);
      setVideoCount(newVideoCount);
      
      // Notificar al componente padre
      onChange(updatedMedia);
    } 
    // Si es un elemento existente, lo marcamos para eliminación
    else {
      console.log("Marcando elemento existente para eliminación:", itemToRemove);
      
      // Crear una copia para no mutar el estado directamente
      const updatedMedia = mediaItems.map((item, index) => {
        if (index === indexToRemove) {
          return {
            ...item,
            deleted: true, // Para la UI (ocultar)
            toDelete: true, // Para el backend (eliminar de la DB)
            isMain: false // Nunca mostrar como principal un elemento eliminado
          };
        }
        return item;
      });
      
      // Verificar si necesitamos asignar un nuevo elemento principal
      if (itemToRemove.isMain) {
        console.log("El elemento marcado para eliminación era principal, buscando reemplazo");
        
        // Elementos no eliminados
        const visibleItems = updatedMedia.filter(
          item => !item.deleted && !item.toDelete
        );
        
        if (visibleItems.length > 0) {
          // Buscar primero una foto para establecer como principal
          const firstPhoto = visibleItems.find(item => item.type === 'photo');
          const firstValid = firstPhoto || visibleItems[0];
          
          if (firstValid) {
            console.log("Nuevo elemento principal después de eliminación:", firstValid);
            
            // Crear array final con el nuevo elemento principal
            const finalMedia = updatedMedia.map(item => {
              if (item === firstValid) {
                return {
                  ...item,
                  isMain: true
                };
              }
              return item;
            });
            
            // Actualizar estado
            setMediaItems(finalMedia);
            
            // Notificar al componente padre
            onChange(finalMedia);
            
            // Actualizar contadores
            const newPhotoCount = finalMedia.filter(
              item => item.type === 'photo' && !item.deleted && !item.toDelete
            ).length;
            
            const newVideoCount = finalMedia.filter(
              item => item.type === 'video' && !item.deleted && !item.toDelete
            ).length;
            
            setPhotoCount(newPhotoCount);
            setVideoCount(newVideoCount);
            
            return;
          }
        }
      }
      
      // Actualizar estado
      setMediaItems(updatedMedia);
      
      // Notificar al componente padre
      onChange(updatedMedia);
      
      // Actualizar contadores
      const newPhotoCount = updatedMedia.filter(
        item => item.type === 'photo' && !item.deleted && !item.toDelete
      ).length;
      
      const newVideoCount = updatedMedia.filter(
        item => item.type === 'video' && !item.deleted && !item.toDelete
      ).length;
      
      setPhotoCount(newPhotoCount);
      setVideoCount(newVideoCount);
      
      // Buscar elementos marcados para eliminación para debugging
      const itemsToDelete = updatedMedia.filter(item => item.toDelete === true);
      if (itemsToDelete.length > 0) {
        console.log("Elementos marcados para eliminación:", 
          itemsToDelete.map(item => ({ url: item.url, type: item.type })));
      }
      
      // Mostrar mensaje de confirmación
      toast({
        title: "Elemento marcado para eliminación",
        description: "El cambio se aplicará al guardar el formulario",
      });
    }
  };
  
  // Establecer un medio como principal
  const handleSetMainMedia = (indexToSetMain: number) => {
    // CONTROL 1: Si está deshabilitado, no hacer nada
    if (disabled) return;
    
    console.log("===== MARCANDO COMO PRINCIPAL =====");
    console.log("Índice seleccionado:", indexToSetMain);
    
    // CONTROL 2: Verificar que mediaItems es un array válido
    if (!Array.isArray(mediaItems)) {
      console.error("Error crítico: mediaItems no es un array");
      toast({
        title: "Error interno",
        description: "Ocurrió un problema con la gestión de medios",
        variant: "destructive"
      });
      return;
    }
    
    // CONTROL 3: Verificar que el índice es válido
    if (indexToSetMain < 0 || indexToSetMain >= mediaItems.length) {
      console.error("Índice para establecer como principal fuera de rango:", indexToSetMain);
      return;
    }
    
    try {
      // PASO 1: Crear una copia shallow de los elementos preservando IDs originales
      const clonedItems: MediaItem[] = mediaItems.map(item => {
        if (!item) {
          console.warn("Elemento null/undefined detectado en mediaItems");
          return null as unknown as MediaItem;
        }
        
        // Preservar el objeto completo sin crear nuevos IDs
        return {
          ...item,
          isMain: false // Por defecto, ninguno es principal (se establecerá después)
        };
      }).filter(Boolean) as MediaItem[]; // Eliminar posibles null/undefined
      
      // PASO 2: Obtener una referencia segura al elemento a marcar como principal
      const itemToSetMain = clonedItems[indexToSetMain];
      
      // Verificación adicional
      if (!itemToSetMain) {
        throw new Error("El elemento seleccionado no existe después de la clonación");
      }
      
      // PASO 3: Verificar que el elemento cumple criterios para ser principal
      if (itemToSetMain.errorMessage) {
        console.warn("No se puede establecer como principal un elemento con errores");
        return;
      }
      
      if (itemToSetMain.deleted || itemToSetMain.toDelete) {
        console.warn("No se puede establecer como principal un elemento marcado para eliminación");
        return;
      }
      
      // PASO 4: Marcar solo el elemento seleccionado como principal
      clonedItems.forEach((item, idx) => {
        item.isMain = (idx === indexToSetMain);
      });
      
      console.log("Estado actualizado - Elemento principal:", clonedItems[indexToSetMain].id);
      
      // Verificar elemento principal para debugging
      const mainItems = clonedItems.filter(item => item.isMain === true);
      console.log("¿Hay elemento principal explícito?", mainItems.length > 0);
      
      if (mainItems.length > 0) {
        console.log("ELEMENTO PRINCIPAL FINAL:", {
          tipo: mainItems[0].type || "desconocido",
          id: mainItems[0].id || "sin-id"
        });
      } else {
        console.error("¡No se encontró un elemento principal después de la actualización!");
      }
      
      // PASO 5: Actualizar el estado y notificar al formulario padre de forma inmediata
      setMediaItems(clonedItems);
      
      // IMPORTANTE: Usar una copia fresca para evitar mutaciones accidentales
      onChange([...clonedItems]);
      
      // PASO 6: Aplicar la actualización de forma inmediata (envío instantáneo)
      // Construimos un objeto FormData y enviamos automáticamente la actualización
      if (typeof window !== 'undefined' && itemToSetMain && itemToSetMain.url) {
        // Disparar un evento personalizado para notificar el cambio de elemento principal
        const customEvent = new CustomEvent('media-main-changed', {
          detail: {
            mediaItems: clonedItems,
            mainItem: itemToSetMain
          }
        });
        window.dispatchEvent(customEvent);
        
        console.log('Enviado evento de actualización principal:', customEvent);
      }
      
      // PASO 7: Notificación visual al usuario
      const mainItem = clonedItems[indexToSetMain];
      const itemName = mainItem && mainItem.file ? mainItem.file.name : 
                     (mainItem && mainItem.url ? 'Archivo destacado' : 'Elemento');
      
      toast({
        title: "✓ Elemento principal actualizado",
        description: `${itemName} ahora es la imagen destacada. Los cambios se guardan automáticamente.`,
        duration: 2000
      });
      console.log("ELEMENTO PRINCIPAL FINAL:", {tipo: mainItems.length > 0 ? mainItems[0].type : 'ninguno'});
      console.log("=== FIN PROCESAMIENTO onChange ===");
      
    } catch (error) {
      // MANEJO DE ERRORES
      console.error("Error crítico al establecer elemento principal:", error);
      
      toast({
        title: "Error al establecer elemento principal",
        description: "Ha ocurrido un problema técnico. Por favor, inténtalo de nuevo.",
        variant: "destructive",
        duration: 5000
      });
    }
  };
  
  // Renderizar miniatura para medio (foto o video)
  const renderMediaItem = (item: MediaItem, index: number) => {
    // Verificar si el item es válido
    if (!item) {
      console.error(`Intentando renderizar un item undefined o null en el índice ${index}`);
      return null;
    }
    
    // No mostrar elementos eliminados
    if (item.deleted || item.toDelete) {
      return null;
    }
    
    return (
      <div 
        key={item.id || index}
        className={cn(
          "relative group border rounded-md overflow-hidden hover:shadow-md transition-all",
          "flex flex-col items-center justify-center",
          "min-w-[120px] w-[120px] h-[120px]",
          "bg-background",
          draggedItem === index ? "opacity-50 border-dashed" : "",
          dragOverItem === index ? "bg-accent" : "",
          item.errorMessage ? "border-destructive" : (item.isMain ? "border-primary border-2" : "border-border")
        )}
        draggable={!disabled}
        onDragStart={() => handleDragStart(index)}
        onDragOver={() => handleDragOver(index)}
        onDragEnd={handleDragEnd}
      >
        {/* Previsualizacion del medio */}
        <MediaPreview 
          file={item.file}
          url={item.url}
          previewUrl={item.previewUrl}
          type={item.type}
          className="w-full h-full object-cover"
        />
        
        {/* Acciones */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-opacity">
          {/* Botón para establecer como principal */}
          <Button
            type="button"
            onClick={() => handleSetMainMedia(index)}
            disabled={item.isMain || disabled}
            className={cn(
              "absolute top-1 left-1 h-7 w-7 p-0 rounded-full",
              item.isMain ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-black/50 hover:bg-black/70"
            )}
            title="Establecer como principal"
          >
            {item.isMain ? <Star size={14} /> : <StarOff size={14} />}
          </Button>
          
          {/* Botón para eliminar */}
          <Button
            type="button"
            onClick={() => handleRemoveMedia(index)}
            disabled={disabled}
            className="absolute top-1 right-1 h-7 w-7 p-0 rounded-full bg-black/50 hover:bg-destructive/90"
            title="Eliminar"
          >
            <Trash size={14} />
          </Button>
        </div>
        
        {/* Icono de tipo */}
        <div className="absolute bottom-1 left-1 bg-black/50 text-white p-1 rounded-sm text-xs">
          {item.type === 'photo' ? <Image size={14} /> : <Video size={14} />}
        </div>
        
        {/* Indicador de elemento principal */}
        {item.isMain && (
          <Badge className="absolute bottom-1 right-1 text-xs bg-primary" variant="default">
            Principal
          </Badge>
        )}
        
        {/* Mensaje de error si lo hay */}
        {item.errorMessage && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white p-2 text-xs text-center">
            <div className="flex flex-col items-center space-y-1">
              <AlertCircle size={16} className="text-destructive" />
              <span>{item.errorMessage}</span>
            </div>
          </div>
        )}
        
        {/* Indicador de carga */}
        {item.uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
            <Loader2 size={24} className="animate-spin mb-2" />
            <div className="text-xs">{item.uploadProgress || 0}%</div>
          </div>
        )}
      </div>
    );
  };
  
  // Conteo de elementos válidos (no eliminados)
  const visibleItems = mediaItems.filter(item => !item.deleted && !item.toDelete);
  
  return (
    <div className="space-y-4">
      {/* Input oculto para seleccionar archivos */}
      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        multiple
      />
      
      {/* Área de visualización de medios */}
      <div className="flex flex-wrap gap-3 min-h-[120px] border border-dashed rounded-md p-3">
        {visibleItems.length > 0 ? (
          visibleItems.map((item, index) => renderMediaItem(item, index))
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm py-8">
            No hay medios añadidos
          </div>
        )}
      </div>
      
      {/* Botones para agregar medios */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => handleAddMedia(true)}
          disabled={disabled || photoCount >= maxPhotos}
          variant="outline"
          className="text-xs"
        >
          <Image className="mr-2" size={14} />
          Añadir Foto ({photoCount}/{maxPhotos})
        </Button>
        
        <Button
          type="button"
          onClick={() => handleAddMedia(false)}
          disabled={disabled || videoCount >= maxVideos}
          variant="outline"
          className="text-xs"
        >
          <Video className="mr-2" size={14} />
          Añadir Video ({videoCount}/{maxVideos})
        </Button>
      </div>
    </div>
  );
};

export default MediaManager;