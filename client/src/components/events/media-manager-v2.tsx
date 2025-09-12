import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Image, Video, Trash, Star, StarOff, X } from 'lucide-react';

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

export const MediaManager = ({
  existingMedia = [],
  onChange,
  maxPhotos = 6,
  maxVideos = 3,
  disabled = false,
}: MediaManagerProps) => {
  console.log("🎬 MediaManager RENDER START - Component is rendering");
  console.log("🎬 MediaManager props:", { existingMedia: Array.isArray(existingMedia) ? existingMedia.length : typeof existingMedia, disabled, maxPhotos, maxVideos });
  
  const { toast } = useToast();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Al inicializar, procesar existingMedia
  useEffect(() => {
    console.log("🔄 MediaManager useEffect TRIGGERED - existingMedia changed");
    console.log("🔄 Current mediaItems.length before update:", mediaItems.length);
    console.log("🔄 New existingMedia:", typeof existingMedia, existingMedia);
    
    // CRITICAL: Don't reset mediaItems if we already have new items that haven't been saved
    const hasUnsavedItems = mediaItems.some(item => item.isNew && item.file);
    if (hasUnsavedItems) {
      console.log("⚠️ PREVENTING RESET: MediaManager has unsaved new items, skipping existingMedia update");
      console.log("⚠️ Unsaved items:", mediaItems.filter(item => item.isNew && item.file).map(item => ({ id: item.id, fileName: item.file?.name })));
      return;
    }
    
    let initialItems: MediaItem[] = [];
    
    // Si es un array y tiene elementos, usarlo directamente
    if (Array.isArray(existingMedia) && existingMedia.length > 0) {
      initialItems = existingMedia.map(item => ({ ...item }));
      console.log("MediaManager: Media recibido como array:", initialItems.length, initialItems);
    }
    // Si es un string, intentar parsearlo como JSON
    else if (typeof existingMedia === 'string' && existingMedia.trim()) {
      try {
        initialItems = JSON.parse(existingMedia);
        console.log("MediaManager: Media parseado de JSON string:", initialItems.length, initialItems);
      } catch (e) {
        console.error('MediaManager: Error al parsear JSON:', e);
        console.log('MediaManager: String original:', existingMedia);
        setMediaItems([]);
        onChange([]);
        return;
      }
    }
    // Si no hay datos válidos
    else {
      console.log("MediaManager: No hay media existente válido");
      setMediaItems([]);
      onChange([]);
      return;
    }
    
    // Filtrar elementos nulos y undefined para evitar errores
    initialItems = initialItems.filter(item => item !== null && item !== undefined);
    
    // Asegurarse de que cada elemento tenga un orden
    const itemsWithOrder = initialItems.map((item, index) => ({
      ...item,
      order: item.order !== undefined ? item.order : index
    }));
    
    // Ordenar: primero el elemento principal, luego por order
    const sortedItems = [...itemsWithOrder].sort((a, b) => {
      // Si uno es principal y el otro no, el principal va primero
      if (a.isMain && !b.isMain) return -1;
      if (!a.isMain && b.isMain) return 1;
      // Si ambos son principales o ninguno es principal, ordenar por order
      return (a.order || 0) - (b.order || 0);
    });
    
    console.log("Media inicial ordenado:", sortedItems);
    
    // Asegurarse de que solo hay un elemento principal
    let hasMain = false;
    const finalItems = sortedItems.map(item => {
      if (item.isMain && !hasMain) {
        hasMain = true;
        return { ...item, isMain: true };
      }
      return { ...item, isMain: false };
    });
    
    // Si no hay un elemento principal, establecer el primero como principal
    if (!hasMain && finalItems.length > 0) {
      finalItems[0].isMain = true;
      console.log("Estableciendo el primer elemento como principal por defecto");
    }
    
    console.log("🔄 SETTING INITIAL MEDIA from existingMedia:", finalItems.length);
    console.log("🔄 EXISTING MEDIA DETAILS:", finalItems.map(item => ({ 
      id: item.id, 
      type: item.type, 
      isNew: !!item.isNew,
      hasUrl: !!item.url,
      hasFile: !!item.file
    })));
    
    setMediaItems(finalItems);
    
    // Importante: Asegurarnos de que el componente padre tenga el estado inicial correcto
    // Esta línea soluciona el problema del "undefined" al enviar el formulario
    onChange(finalItems);
  }, [existingMedia]);
  
  // Contar elementos visibles actuales
  const validItems = mediaItems.filter(item => item && typeof item === 'object');
  const visibleItems = validItems.filter(item => !item.deleted && !item.toDelete);
  const photoCount = visibleItems.filter(item => item.type === 'photo').length;
  const videoCount = visibleItems.filter(item => item.type === 'video').length;
  
  // Verificar si se pueden agregar más elementos
  const canAddMorePhotos = photoCount < maxPhotos;
  const canAddMoreVideos = videoCount < maxVideos;
  
  console.log("MediaManager render counts:", {
    totalItems: mediaItems.length,
    validItems: validItems.length,
    visibleItems: visibleItems.length,
    photoCount,
    videoCount,
    canAddMorePhotos,
    canAddMoreVideos,
    disabled
  });
  
  // Función para seleccionar archivos
  const handleSelectFiles = (acceptType: 'image/*' | 'video/*') => {
    console.log("=== FILE SELECTION STARTED ===");
    console.log("Accept type:", acceptType);
    console.log("Current media items before selection:", mediaItems.length);
    console.log("Disabled state:", disabled);
    
    if (disabled) {
      console.log("File selection disabled, returning");
      return;
    }
    
    if (fileInputRef.current) {
      console.log("File input ref found, setting accept and clicking");
      fileInputRef.current.accept = acceptType;
      fileInputRef.current.click();
    } else {
      console.error("File input ref not found!");
    }
  };

  // Procesar archivos seleccionados con validación mejorada
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    try {
      const files = Array.from(e.target.files);
      const isImage = e.target.accept === 'image/*';
      const mediaType = isImage ? 'photo' : 'video';
      
      // Verificar si hay espacio para más archivos
      const currentCount = mediaType === 'photo' ? photoCount : videoCount;
      const maxCount = mediaType === 'photo' ? maxPhotos : maxVideos;
      
      if (currentCount + files.length > maxCount) {
        toast({
          title: `Demasiados ${mediaType === 'photo' ? 'fotos' : 'videos'}`,
          description: `Solo puedes agregar hasta ${maxCount} ${mediaType === 'photo' ? 'fotos' : 'videos'}`,
          variant: "destructive"
        });
        
        // Limpiar input para que pueda seleccionar los mismos archivos de nuevo
        e.target.value = '';
        return;
      }
      
      // Procesar cada archivo
      const newItems: MediaItem[] = [];
      
      files.forEach(file => {
        // Validar tamaño (10MB máximo)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "Archivo demasiado grande",
            description: `${file.name} excede el límite de 10MB`,
            variant: "destructive"
          });
          return;
        }
        
        // Crear URL temporal para vista previa
        const previewUrl = URL.createObjectURL(file);
        
        // Crear nuevo item con verificación de tipo
        const newItem: MediaItem = {
          id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: mediaType,
          file,
          previewUrl,
          isNew: true,
          isMain: false, // Por defecto no es principal
          order: mediaItems.length + newItems.length
        };
        
        newItems.push(newItem);
      });
      
      // Si no hay elementos nuevos, no hacemos nada
      if (newItems.length === 0) {
        console.log("No se agregaron nuevos elementos");
        // Limpiar input para que pueda seleccionar los mismos archivos de nuevo
        e.target.value = '';
        return;
      }
      
      // Asegurarse de que mediaItems existe y es un array
      const currentItems = Array.isArray(mediaItems) ? [...mediaItems] : [];
      
      // Si no hay elementos en mediaItems o no hay ningún elemento principal marcado, hacer el primero principal
      const hasMainItem = currentItems.some(item => item && item.isMain === true && !item.deleted && !item.toDelete);
      
      if (!hasMainItem && newItems.length > 0) {
        newItems[0].isMain = true;
        console.log("Marcando el primer elemento nuevo como principal");
      }
      
      // Combinar elementos actuales y nuevos con validación adicional
      const updatedItems = [...currentItems, ...newItems].filter(item => item !== null && item !== undefined);
      
      console.log("=== MEDIA PROCESSING DEBUG ===");
      console.log("Current items count:", currentItems.length);
      console.log("New items count:", newItems.length);
      console.log("Updated items count:", updatedItems.length);
      console.log("New items details:", newItems.map(item => ({
        id: item.id,
        type: item.type,
        fileName: item.file?.name,
        isNew: item.isNew,
        hasPreviewUrl: !!item.previewUrl
      })));
      console.log("Updated items details:", updatedItems.map(item => ({
        id: item.id,
        type: item.type,
        isNew: item.isNew,
        hasUrl: !!item.url,
        hasPreviewUrl: !!item.previewUrl
      })));
      
      // Si el array está vacío después de los filtros, proporcionar un array vacío válido
      const safeItems = updatedItems.length > 0 ? updatedItems : [];
      
      console.log("🔥 ADDING NEW FILES - Setting media items to:", safeItems.length);
      console.log("🔥 ADDING NEW FILES - Details:", safeItems.map(item => ({ 
        id: item.id, 
        type: item.type, 
        isNew: item.isNew, 
        fileName: item.file?.name || 'no file',
        hasUrl: !!item.url 
      })));
      
      setMediaItems(safeItems);
      // Garantizar que siempre se pase un array válido al llamar a onChange
      onChange(safeItems);
      
      console.log("🔥 ADDING NEW FILES - onChange called with", safeItems.length, "items");
      
      // Limpiar input para que pueda seleccionar los mismos archivos de nuevo
      e.target.value = '';
      
      // Mostrar mensaje de éxito
      toast({
        title: "Archivos agregados",
        description: `Se han agregado ${newItems.length} ${mediaType === 'photo' ? 'fotos' : 'videos'}`,
      });
    } catch (error) {
      console.error("Error al procesar archivos:", error);
      toast({
        title: "Error al procesar archivos",
        description: "No se pudieron procesar algunos archivos. Intenta nuevamente.",
        variant: "destructive"
      });
      
      // Limpiar input para que pueda seleccionar los mismos archivos de nuevo
      if (e.target) e.target.value = '';
      
      // En caso de error, asegurémonos de que onChange reciba un array válido (el estado actual)
      onChange(Array.isArray(mediaItems) ? mediaItems : []);
    }
  };
  
  // Función mejorada para establecer un elemento como principal
  const handleSetMain = (index: number) => {
    console.log("===== MARCANDO COMO PRINCIPAL =====");
    console.log("Índice seleccionado:", index);
    
    if (disabled) return;
    
    // Validación inicial robusta
    if (!Array.isArray(mediaItems)) {
      console.error("mediaItems no es un array válido");
      onChange([]);
      return;
    }
    
    if (index < 0 || index >= mediaItems.length) {
      console.error("Índice inválido:", index);
      onChange([...mediaItems]);
      return;
    }
    
    const targetItem = mediaItems[index];
    
    // Verificaciones de validez del elemento objetivo
    if (!targetItem || typeof targetItem !== 'object') {
      console.error("Elemento no válido en el índice:", index);
      onChange([...mediaItems]);
      return;
    }
    
    // No se puede marcar como principal un elemento eliminado
    if (targetItem.deleted || targetItem.toDelete) {
      toast({
        title: "Elemento no válido",
        description: "No se puede establecer como principal un elemento eliminado",
        variant: "destructive"
      });
      return;
    }
    
    // No se puede marcar como principal un elemento con errores
    if (targetItem.errorMessage) {
      toast({
        title: "Elemento con errores",
        description: "No se puede establecer como principal un elemento que tiene errores",
        variant: "destructive"
      });
      return;
    }
    
    // Debe tener contenido válido (URL, file o previewUrl)
    if (!targetItem.url && !targetItem.file && !targetItem.previewUrl) {
      toast({
        title: "Elemento sin contenido",
        description: "Este elemento no tiene imagen o video válido",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Filtrar elementos válidos y actualizar estado
      const validItems = mediaItems.filter(item => 
        item !== null && 
        item !== undefined && 
        typeof item === 'object'
      );
      
      // Asegurar que solo el elemento target sea principal
      const updatedItems = validItems.map((item, i) => ({
        ...item,
        isMain: i === index
      }));
      
      // Reorganizar: mover el elemento principal al inicio
      const reorderedItems = [...updatedItems].sort((a, b) => {
        // Si uno es principal y el otro no, el principal va primero
        if (a.isMain && !b.isMain) return -1;
        if (!a.isMain && b.isMain) return 1;
        // Si ambos son principales o ninguno es principal, mantener orden actual
        return 0;
      });
      
      console.log("Estado actualizado - Elemento principal:", 
        reorderedItems.find(item => item.isMain)?.id || "ninguno");
      console.log("Elemento principal movido a posición 0");
      
      // Actualizar estado y notificar cambios
      setMediaItems(reorderedItems);
      onChange(reorderedItems);
      
      // Mostrar confirmación al usuario
      toast({
        title: "Elemento principal actualizado",
        description: "Este elemento será la imagen destacada del evento",
      });
      
    } catch (error) {
      console.error("Error al establecer elemento principal:", error);
      toast({
        title: "Error al actualizar",
        description: "No se pudo establecer el elemento principal",
        variant: "destructive"
      });
      
      // Mantener estado actual en caso de error
      onChange(Array.isArray(mediaItems) ? [...mediaItems] : []);
    }
  };
  
  // Función para eliminar un elemento
  const handleRemove = (index: number) => {
    if (disabled) return;
    
    // Verificar que mediaItems es un array válido
    if (!Array.isArray(mediaItems)) {
      console.error("mediaItems no es un array válido al intentar eliminar");
      onChange([]);
      return;
    }
    
    // Verificar que el índice es válido
    if (index < 0 || index >= mediaItems.length) {
      console.error("Índice inválido para eliminar:", index);
      onChange([...mediaItems]);
      return;
    }
    
    try {
      const itemToRemove = mediaItems[index];
      
      // Verificar que el elemento existe
      if (!itemToRemove) {
        console.error("Elemento no encontrado para eliminar");
        onChange([...mediaItems]);
        return;
      }
      
      // Si es un elemento nuevo, eliminarlo completamente
      if (itemToRemove.isNew) {
        // Liberar URL de vista previa
        if (itemToRemove.previewUrl) {
          try {
            URL.revokeObjectURL(itemToRemove.previewUrl);
          } catch (e) {
            console.error("Error al liberar URL de vista previa:", e);
          }
        }
        
        // Filtrar el elemento con validación adicional
        const updatedItems = mediaItems.filter((item, i) => i !== index && item !== null && item !== undefined);
        
        // Si el elemento eliminado era el principal, establecer otro como principal
        if (itemToRemove.isMain && updatedItems.length > 0) {
          updatedItems[0].isMain = true;
        }
        
        // Actualizar estado
        setMediaItems(updatedItems);
        onChange(updatedItems);
      } 
      // Si es un elemento existente, marcarlo para eliminación
      else {
        const updatedItems = mediaItems.map((item, i) => {
          if (item === null || item === undefined) {
            return null; // Será filtrado después
          }
          
          if (i === index) {
            return {
              ...item,
              deleted: true,
              toDelete: true,
              isMain: false // Ya no puede ser principal
            };
          }
          return item;
        }).filter(item => item !== null && item !== undefined); // Filtrar elementos inválidos
        
        // Si el elemento eliminado era el principal, establecer otro como principal
        if (itemToRemove.isMain) {
          const visibleItems = updatedItems.filter(item => !item.deleted && !item.toDelete);
          if (visibleItems.length > 0) {
            // Buscar el primer elemento visible y establecerlo como principal
            const firstVisibleIndex = updatedItems.findIndex(
              item => !item.deleted && !item.toDelete
            );
            
            if (firstVisibleIndex >= 0) {
              updatedItems[firstVisibleIndex].isMain = true;
            }
          }
        }
        
        // Actualizar estado
        setMediaItems(updatedItems);
        onChange(updatedItems);
      }
      
      // Mostrar notificación
      toast({
        title: "Elemento eliminado",
        description: "El archivo ha sido eliminado"
      });
    } catch (error) {
      console.error("Error al eliminar elemento:", error);
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar el elemento",
        variant: "destructive"
      });
      
      // En caso de error, asegurar que devolvemos un array válido
      onChange(Array.isArray(mediaItems) ? [...mediaItems] : []);
    }
  };

  // Verificación mejorada: asegurar que siempre hay un elemento principal válido
  useEffect(() => {
    if (!Array.isArray(mediaItems) || mediaItems.length === 0) return;
    
    const visibleItems = mediaItems.filter(item => 
      item && !item.deleted && !item.toDelete && (item.url || item.file || item.previewUrl)
    );
    
    if (visibleItems.length === 0) return;
    
    const hasValidMainItem = visibleItems.some(item => item.isMain === true);
    
    // Solo intervenir si NO hay elemento principal válido
    if (!hasValidMainItem) {
      console.log("Auto-asignando elemento principal - no hay uno válido");
      
      const firstValidIndex = mediaItems.findIndex(item => 
        item && !item.deleted && !item.toDelete && (item.url || item.file || item.previewUrl)
      );
      
      if (firstValidIndex >= 0) {
        const updatedItems = mediaItems.map((item, i) => ({
          ...item,
          isMain: i === firstValidIndex
        }));
        
        setMediaItems(updatedItems);
        onChange(updatedItems);
        
        console.log("Elemento principal auto-asignado:", {
          índice: firstValidIndex,
          tipo: updatedItems[firstValidIndex].type
        });
      }
    }
  }, [mediaItems, onChange]);

  return (
    <div className="w-full">
      {/* Contador de archivos */}
      <div className="flex justify-between mb-2 text-sm text-gray-600">
        <div>Fotos: {photoCount}/{maxPhotos}</div>
        <div>Videos: {videoCount}/{maxVideos}</div>
      </div>
      
      {/* Contenedor de miniaturas */}
      <div className="grid grid-cols-2 gap-2 mb-4 max-w-full">
        {mediaItems.map((item, index) => {
          // Validar elemento antes de procesarlo
          if (!item || typeof item !== 'object') {
            console.warn(`Invalid item at index ${index}:`, item);
            return null;
          }
          
          // No mostrar elementos eliminados
          if (item.deleted || item.toDelete) return null;
          
          console.log(`Rendering media item ${index}:`, {
            id: item.id,
            type: item.type,
            hasUrl: !!item.url,
            hasPreviewUrl: !!item.previewUrl,
            isMain: item.isMain,
            isNew: item.isNew
          });
          
          return (
            <div 
              key={item.id || index}
              className={cn(
                "relative group aspect-square rounded-md overflow-hidden shadow-sm",
                item.isMain ? "ring-2 ring-yellow-500" : "",
                disabled ? "opacity-70 pointer-events-none" : ""
              )}
            >
              {/* Contenido del medio */}
              {item && item.type ? (
                item.type === 'photo' ? (
                  // Foto
                  <img 
                    src={item.previewUrl || item.url}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
                    }}
                  />
                ) : (
                  // Video
                  <video 
                    src={item.previewUrl || item.url}
                    className="w-full h-full object-cover"
                    muted
                  />
                )
              ) : (
                // Fallback por si item o item.type no existe
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <span className="text-gray-500 text-xs">Archivo no disponible</span>
                </div>
              )}
              
              {/* Indicador de tipo */}
              {item && item.type && (
                <div className="absolute bottom-1 right-1 bg-black/50 rounded-full p-1">
                  {item.type === 'photo' ? (
                    <Image size={14} className="text-white" />
                  ) : (
                    <Video size={14} className="text-white" />
                  )}
                </div>
              )}
              
              {/* Controles superpuestos */}
              {item && (
                <div className="absolute top-0 left-0 right-0 flex justify-between p-1">
                  {/* Botón para eliminar */}
                  <button
                    type="button"
                    className="bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemove(index)}
                  >
                    <Trash size={14} />
                  </button>
                  
                  {/* Botón para establecer como principal */}
                  <button
                    type="button"
                    className={cn(
                      "rounded-full p-1 transition-opacity",
                      item.isMain 
                        ? "bg-yellow-500 text-white opacity-100" 
                        : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
                    )}
                    onClick={() => handleSetMain(index)}
                  >
                    {item.isMain ? <Star size={14} /> : <StarOff size={14} />}
                  </button>
                </div>
              )}
              
              {/* Etiqueta de principal */}
              {item && item.isMain && (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-yellow-500 text-white px-2 py-0.5 rounded text-xs font-medium shadow">
                  Imagen principal
                </div>
              )}
              
              {/* Estado de carga */}
              {item && item.uploading && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                  <div className="text-white text-xs mb-2">Subiendo...</div>
                  <Progress value={item.uploadProgress || 0} className="w-4/5 h-1" />
                </div>
              )}
              
              {/* Mensaje de error */}
              {item && item.errorMessage && (
                <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center p-2">
                  <div className="text-white text-xs text-center">{item.errorMessage}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Botones para agregar - Uno debajo del otro */}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={(e) => {
            console.log("=== BUTTON CLICK EVENT ===");
            console.log("Button clicked, event:", e.type);
            console.log("Can add more photos:", canAddMorePhotos);
            console.log("Disabled state:", disabled);
            console.log("Photo count:", photoCount, "max:", maxPhotos);

            e.preventDefault();
            e.stopPropagation();
            handleSelectFiles('image/*');
          }}
          disabled={!canAddMorePhotos || disabled}
          className="w-full"
        >
          <Image className="mr-2 h-4 w-4" />
          Agregar fotos
          <span className="ml-1 opacity-60">{photoCount}/{maxPhotos}</span>
        </Button>
        
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSelectFiles('video/*')}
          disabled={!canAddMoreVideos || disabled}
          className="w-full"
        >
          <Video className="mr-2 h-4 w-4" />
          Agregar videos
          <span className="ml-1 opacity-60">{videoCount}/{maxVideos}</span>
        </Button>
      </div>
      
      {/* Límites y consejos */}
      <div className="mt-2 text-xs text-gray-500">
        <ul className="list-disc list-inside space-y-1">
          <li>Límites: hasta {maxPhotos} fotos (máx. 10MB c/u) y {maxVideos} videos (máx. 10MB c/u)</li>
          <li>Para destacar una imagen como principal, haz clic en el botón de estrella</li>
        </ul>
      </div>
      
      {/* Input oculto para seleccionar archivos */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          console.log("=== FILE INPUT CHANGE EVENT ===");
          console.log("Files selected:", e.target.files?.length || 0);
          if (e.target.files) {
            const files = Array.from(e.target.files);
            console.log("Files details:", files.map(f => ({ name: f.name, type: f.type, size: f.size })));
          }
          handleFileChange(e);
        }}
        multiple
      />
    </div>
  );
};

// Exportación predeterminada para compatibilidad con las importaciones existentes
export default MediaManager;
