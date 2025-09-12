import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { AlertCircle, Image as ImageIcon, Video, Star, StarOff, Trash, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Definición del tipo de elemento multimedia
export type MediaItem = {
  id?: string;
  type: 'photo' | 'video';
  url?: string;     // URL para medios existentes
  file?: File;      // File para nuevos medios
  previewUrl?: string; // URL temporal para vista previa
  isMain?: boolean;
  isNew?: boolean;
  order?: number;
  toDelete?: boolean;
};

// Props para el componente
interface SimpleMediaManagerProps {
  existingMedia?: MediaItem[];
  onChange: (media: MediaItem[]) => void;
  maxItems?: number;
  disabled?: boolean;
}

const SimpleMediaManager: React.FC<SimpleMediaManagerProps> = ({
  existingMedia = [],
  onChange,
  maxItems = 10,
  disabled = false
}) => {
  const { toast } = useToast();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(existingMedia);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicializar con medios existentes
  useEffect(() => {
    if (existingMedia && existingMedia.length > 0) {
      setMediaItems(existingMedia);
    }
  }, [existingMedia]);

  // Función para cargar un nuevo archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newItems: MediaItem[] = [];
      
      // Comprobar si estamos excediendo el límite
      if (mediaItems.length + files.length > maxItems) {
        toast({
          title: "Demasiados archivos",
          description: `Solo puedes subir hasta ${maxItems} archivos en total.`,
          variant: "destructive",
        });
        return;
      }
      
      // Procesar cada archivo
      Array.from(files).forEach(file => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        if (!isImage && !isVideo) {
          toast({
            title: "Tipo de archivo no soportado",
            description: "Solo se permiten imágenes y videos.",
            variant: "destructive",
          });
          return;
        }
        
        // Comprobar tamaño máximo (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "Archivo demasiado grande",
            description: "El tamaño máximo permitido es 10MB.",
            variant: "destructive",
          });
          return;
        }
        
        // Crear la URL de vista previa
        const previewUrl = URL.createObjectURL(file);
        
        newItems.push({
          id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: isImage ? 'photo' : 'video',
          file: file,
          previewUrl: previewUrl,
          isNew: true,
          isMain: mediaItems.length === 0 && newItems.length === 0, // El primer elemento es el principal por defecto
          order: mediaItems.length + newItems.length
        });
      });
      
      // Actualizar estado y notificar cambio
      const updatedItems = [...mediaItems, ...newItems];
      setMediaItems(updatedItems);
      onChange(updatedItems);
      
      // Limpiar input para permitir seleccionar el mismo archivo nuevamente
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Error al procesar archivos:", error);
      toast({
        title: "Error al procesar archivos",
        description: "No se pudieron procesar los archivos seleccionados.",
        variant: "destructive",
      });
    }
  };

  // Función para eliminar un elemento
  const handleRemoveMedia = (index: number) => {
    try {
      const updatedItems = [...mediaItems];
      
      // Si el elemento a eliminar es el principal, debemos establecer otro como principal
      const isRemovingMain = updatedItems[index]?.isMain === true;
      
      // Marcar para eliminar si es un elemento existente, o eliminarlo si es nuevo
      if (updatedItems[index]?.id && !updatedItems[index]?.isNew) {
        updatedItems[index] = { 
          ...updatedItems[index], 
          toDelete: true 
        };
      } else {
        // Liberar URL de objeto si existe
        if (updatedItems[index]?.previewUrl) {
          URL.revokeObjectURL(updatedItems[index].previewUrl!);
        }
        updatedItems.splice(index, 1);
      }
      
      // Si eliminamos el elemento principal, establecer el primer elemento visible como principal
      if (isRemovingMain) {
        const firstVisibleIndex = updatedItems.findIndex(item => !item.toDelete);
        if (firstVisibleIndex >= 0) {
          updatedItems[firstVisibleIndex] = { 
            ...updatedItems[firstVisibleIndex], 
            isMain: true 
          };
        }
      }
      
      // Actualizar estado
      setMediaItems(updatedItems);
      onChange(updatedItems);
    } catch (error) {
      console.error("Error al eliminar medio:", error);
    }
  };

  // Función para establecer un elemento como principal
  const handleSetMainMedia = (index: number) => {
    try {
      if (index < 0 || index >= mediaItems.length) {
        console.error("Índice fuera de rango:", index, "de", mediaItems.length);
        return;
      }
      
      console.log("Marcando el elemento", index, "como principal");
      
      // Crear una copia profunda del array para evitar problemas de referencia
      const updatedItems = mediaItems.map((item, i) => ({
        ...item,
        isMain: i === index // Solo el índice seleccionado será principal
      }));
      
      console.log("Items actualizados:", updatedItems.length);
      setMediaItems(updatedItems);
      onChange(updatedItems);
    } catch (error) {
      console.error("Error al establecer medio principal:", error);
    }
  };

  // Filtrar elementos que no están marcados para eliminar
  const visibleMediaItems = mediaItems.filter(item => !item.toDelete);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {visibleMediaItems.map((item, index) => (
          <div 
            key={item.id || `media-${index}`}
            className="relative border rounded-lg overflow-hidden w-[150px] h-[150px]"
          >
            {/* Vista previa del medio */}
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              {item.type === 'photo' ? (
                <img 
                  src={item.previewUrl || item.url} 
                  alt="Media preview" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/150x150?text=Error';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <Video className="w-12 h-12 text-white" />
                </div>
              )}
            </div>
            
            {/* Botones de acción */}
            <div className="absolute top-2 right-2 flex flex-col gap-2">
              {/* Botón eliminar */}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="w-8 h-8 rounded-full"
                onClick={() => handleRemoveMedia(index)}
                disabled={disabled}
              >
                <Trash className="w-4 h-4" />
              </Button>
              
              {/* Botón marcar como principal */}
              <Button
                type="button"
                variant={item.isMain ? "default" : "outline"}
                size="icon"
                className="w-8 h-8 rounded-full"
                onClick={() => handleSetMainMedia(index)}
                disabled={disabled || item.isMain}
              >
                {item.isMain ? (
                  <Star className="w-4 h-4" />
                ) : (
                  <StarOff className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            {/* Indicador de elemento principal */}
            {item.isMain && (
              <div className="absolute bottom-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                Principal
              </div>
            )}
          </div>
        ))}
        
        {/* Botón para añadir más medios */}
        {visibleMediaItems.length < maxItems && (
          <div 
            className="border-2 border-dashed rounded-lg overflow-hidden w-[150px] h-[150px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-gray-500 mt-2">Añadir</p>
          </div>
        )}
      </div>
      
      {/* Input oculto para seleccionar archivos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      
      {/* Mensaje informativo */}
      <p className="text-sm text-gray-500">
        {visibleMediaItems.length === 0 
          ? "Añade fotos o videos para tu evento" 
          : `${visibleMediaItems.length} de ${maxItems} elementos seleccionados. Marca uno como principal.`}
      </p>
    </div>
  );
};

export default SimpleMediaManager;