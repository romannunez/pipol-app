import React, { useState, useEffect, useRef, useCallback } from "react";
import { useForm, FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapIcon, Compass, Search, Camera, Video, Clock, Calendar, MapPin, Tag, Users, DollarSign, Lock, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { GoogleMap, Marker, useLoadScript, Libraries } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, reverseGeocode, defaultMapConfig } from "@/lib/google-maps";
import { MediaManager, MediaItem } from "./media-manager-v2";

// Definición centralizada de categorías para reutilización
const EVENT_CATEGORIES = [
  { value: 'social', label: 'Social' },
  { value: 'music', label: 'Música' },
  { value: 'spiritual', label: 'Espiritual' },
  { value: 'education', label: 'Educación' },
  { value: 'sports', label: 'Deportes' },
  { value: 'food', label: 'Comida' },
  { value: 'art', label: 'Arte' },
  { value: 'technology', label: 'Tecnología' },
  { value: 'games', label: 'Juegos' },
  { value: 'outdoor', label: 'Aire Libre' },
  { value: 'networking', label: 'Networking' },
  { value: 'workshop', label: 'Talleres' },
  { value: 'conference', label: 'Conferencias' },
  { value: 'party', label: 'Fiestas' },
  { value: 'fair', label: 'Ferias' },
  { value: 'exhibition', label: 'Exposiciones' }
];

// Form schema para validación de eventos (modo edición más flexible - sin campos obligatorios estrictos)
const createEventSchema = z.object({
  title: z.string().optional().default(""),
  description: z.string().optional().default(""),
  category: z.string().optional().default(""),
  date: z.string().optional().default(""),
  time: z.string().optional().default(""),
  endTime: z.string().optional().default(""),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  locationName: z.string().optional().default(""),
  locationAddress: z.string().optional().default(""),
  paymentType: z.string().optional().default("free"),
  price: z.string().optional().default(""),
  maxCapacity: z.string().optional().default(""),
  privacyType: z.string().optional().default("public"),
  privateAccessType: z.enum(['solicitud', 'postulacion', 'paga']).optional(),
  applicationQuestions: z.string().optional().default(""),

  // Campo para gestión multimedia unificada - Para edición, permitir array vacío (archivos existentes se conservan)
  mediaItems: z.array(
    z.object({
      id: z.string().optional(),
      type: z.enum(['photo', 'video']),
      url: z.string().optional(),
      file: z.instanceof(File).optional(),
      isMain: z.boolean().optional(),
      isNew: z.boolean().optional(),
      deleted: z.boolean().optional(),
      toDelete: z.boolean().optional(),
      order: z.number().optional(),
    })
  ).default([]),
  
  // Campos para carga directa de archivos (mantener por compatibilidad)
  eventPhotos: z.array(z.instanceof(File)).optional().default([]),
  eventVideos: z.array(z.instanceof(File)).optional().default([]),
  eventPhoto: z.instanceof(File).optional().nullable(),
  eventVideo: z.instanceof(File).optional().nullable(),
  mainMediaFile: z.instanceof(File).optional().nullable(),
  mainMediaType: z.string().optional(),
});

// Tipos para props y datos
type LocationData = {
  latitude: number;
  longitude: number;
  locationName: string;
  locationAddress: string;
};

type EditEventFormProps = {
  onClose: () => void;
  visible: boolean;
  eventId: number;
  event: any; // Datos del evento a editar
  onEventUpdated?: () => void; // Callback para cuando se actualiza el evento con éxito
};

// Define el tipo extendido para compatibilidad con todo el formulario
type FormValues = z.infer<typeof createEventSchema> & {
  mediaItems: MediaItem[];
  eventPhoto?: File;
  eventVideo?: File;
  eventPhotos?: File[];
  eventVideos?: File[];
  mainMediaFile?: File;
  mainMediaType?: string;
};

// Librerias de Google Maps
const libraries: Libraries = ["places"];

/**
 * Componente EditEventFormGoogle - Formulario para editar eventos existentes
 */
/**
 * EditEventFormGoogle con manejo mejorado de ciclo de vida para evitar problemas
 * al cerrar el formulario. El componente se destruye completamente al cerrarse.
 */
const EditEventFormGoogle = ({ onClose, visible, eventId, event, onEventUpdated }: EditEventFormProps) => {
  console.log("Creando instancia de EditEventFormGoogle para evento ID:", eventId);
  // Estados principales
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Cuando el componente va a ser desmontado, limpiar cualquier estado o efecto pendiente
  useEffect(() => {
    return () => {
      console.log("Desmontando CreateEventFormGoogle - limpiando recursos");
      // La función onClose ya habrá sido llamada desde el botón o desde otro lugar
      // Este es solo un lugar adicional para asegurar la limpieza completa
    };
  }, []);
  
  // Inicializar ubicación con los datos del evento
  const defaultLocation = {
    lat: 19.4326, // Ciudad de México por defecto
    lng: -99.1332
  };
  
  // Usar la ubicación del evento
  const [center, setCenter] = useState(() => {
    if (event && event.latitude && event.longitude) {
      const lat = typeof event.latitude === 'string' ? parseFloat(event.latitude) : event.latitude;
      const lng = typeof event.longitude === 'string' ? parseFloat(event.longitude) : event.longitude;
      return { lat, lng };
    }
    return defaultLocation;
  });
  
  // Configurar el marcador con la misma ubicación del evento
  const [markerPosition, setMarkerPosition] = useState(() => {
    if (event && event.latitude && event.longitude) {
      const lat = typeof event.latitude === 'string' ? parseFloat(event.latitude) : event.latitude;
      const lng = typeof event.longitude === 'string' ? parseFloat(event.longitude) : event.longitude;
      return { lat, lng };
    }
    return defaultLocation;
  });
  
  // Establecer el paso inicial - Para edición, ir directamente al paso 2 ya que el evento tiene ubicación
  const [step, setStep] = useState<1 | 2>(2);
  const [stepAnimation, setStepAnimation] = useState<'none' | 'fade-out' | 'fade-in'>('none');
  
  // Cargar Google Maps
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });
  
  // Hooks y referencias
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [_, navigate] = useLocation();
  const queryClient = useQueryClient();
  const mapRef = useRef<google.maps.Map | null>(null);
  
  // Extraer fecha y hora del evento
  const extractDateAndTime = (dateString: string): { date: string, time: string } => {
    try {
      if (!dateString) return { date: "", time: "" };
      
      const eventDate = new Date(dateString);
      
      // Formatear fecha como YYYY-MM-DD para el input type="date"
      const date = eventDate.toISOString().split('T')[0];
      
      // Formatear hora como HH:MM para el input type="time"
      const hours = eventDate.getHours().toString().padStart(2, '0');
      const minutes = eventDate.getMinutes().toString().padStart(2, '0');
      const time = `${hours}:${minutes}`;
      
      return { date, time };
    } catch (error) {
      console.error("Error al procesar fecha:", error);
      return { date: "", time: "" };
    }
  };
  
  // Procesar elementos multimedia del evento
  const processMediaItems = (event: any): MediaItem[] => {
    console.log("Procesando multimedia para evento:", event?.id, "mediaItems:", event?.mediaItems, "media_items:", event?.media_items);
    console.log("Tipo de mediaItems:", typeof event?.mediaItems, "Contenido:", event?.mediaItems);
    console.log("Tipo de media_items:", typeof event?.media_items, "Contenido:", event?.media_items);
    
    try {
      if (!event) {
        console.log("No hay evento para procesar multimedia");
        return [];
      }
      
      let mediaItemsArray: any[] = [];
      
      // Check both camelCase and snake_case field names
      const mediaItemsField = event.mediaItems || event.media_items;
      console.log("Campo de media items a usar:", typeof mediaItemsField, mediaItemsField);
      
      // Si mediaItems ya es un array, usarlo directamente
      if (Array.isArray(mediaItemsField) && mediaItemsField.length > 0) {
        mediaItemsArray = mediaItemsField;
        console.log("MediaItems ya es array válido:", mediaItemsArray);
      }
      // Si mediaItems es una string JSON, parsearlo
      else if (typeof mediaItemsField === 'string' && mediaItemsField.trim()) {
        try {
          mediaItemsArray = JSON.parse(mediaItemsField);
          console.log("MediaItems parseados desde JSON string:", mediaItemsArray);
        } catch (e) {
          console.error("Error al parsear JSON de mediaItems:", e);
          console.log("String original:", mediaItemsField);
          return [];
        }
      } 
      // Si no hay mediaItems pero hay URLs individuales (compatibilidad)
      else if (event.mainMediaUrl || event.main_media_url) {
        const mainUrl = event.mainMediaUrl || event.main_media_url;
        const mainType = event.mainMediaType || event.main_media_type || 'photo';
        console.log("Usando mainMediaUrl como fallback:", mainUrl);
        mediaItemsArray = [{
          type: mainType,
          url: mainUrl,
          order: 0,
          isMain: true
        }];
      }
      else {
        console.log("No se encontraron elementos multimedia válidos en evento");
        console.log("Datos del evento disponibles:", Object.keys(event || {}));
        return [];
      }
      
      // Validar y mapear los elementos para el formulario
      const validItems = mediaItemsArray
        .filter((item: any) => {
          const isValid = item && 
            typeof item === 'object' && 
            item.type && 
            item.url &&
            (item.type === 'photo' || item.type === 'video');
          
          if (!isValid) {
            console.warn("Item multimedia inválido filtrado:", item);
          }
          
          return isValid;
        })
        .map((item: any, index: number) => ({
          ...item,
          id: item.id || `existing-${index}`,
          order: item.order !== undefined ? item.order : index,
          isMain: item.isMain || index === 0
        }));
      
      console.log("Elementos multimedia procesados y validados:", validItems.length, validItems);
      
      return validItems;
    } catch (error) {
      console.error("Error al procesar elementos multimedia:", error);
      return [];
    }
  };
  
  // Extraer fecha y hora del evento
  const { date, time } = extractDateAndTime(event?.date || "");
  
  // Extraer hora de fin del evento si existe
  const extractEndTime = (endTimeString: string): string => {
    try {
      if (!endTimeString) return "";
      
      const endDate = new Date(endTimeString);
      const hours = endDate.getHours().toString().padStart(2, '0');
      const minutes = endDate.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (error) {
      console.error("Error al procesar hora de fin:", error);
      return "";
    }
  };
  
  const endTime = extractEndTime(event?.endTime || "");
  
  // Extraer elementos multimedia
  const mediaItems = processMediaItems(event);
  console.log("Resultado final de processMediaItems:", mediaItems.length, mediaItems);
  console.log("🔍 FORM DEBUG - Event data received:", event?.id);
console.log("🔍 FORM DEBUG - event.mediaItems:", typeof event?.mediaItems, event?.mediaItems);
console.log("🔍 FORM DEBUG - event.media_items:", typeof event?.media_items, event?.media_items);
console.log("🔍 FORM DEBUG - event.mainMediaUrl:", typeof event?.mainMediaUrl, event?.mainMediaUrl);
console.log("🔍 FORM DEBUG - event.main_media_url:", typeof event?.main_media_url, event?.main_media_url);
  
  // Inicializar formulario con valores del evento
  const form = useForm<FormValues, any, FormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: event?.title || "",
      description: event?.description || "",
      category: event?.category || "",
      date: date,
      time: time,
      endTime: endTime,
      // Asegurarnos de que las coordenadas se traten como números
      latitude: event?.latitude ? parseFloat(String(event.latitude)) : "",
      longitude: event?.longitude ? parseFloat(String(event.longitude)) : "",
      locationName: event?.locationName || "",
      locationAddress: event?.locationAddress || "",
      paymentType: event?.paymentType || "free",
      price: event?.price?.toString() || "",
      maxCapacity: event?.maxCapacity?.toString() || "",
      privacyType: event?.privacyType || "public",
      privateAccessType: event?.privateAccessType || "solicitud", // Valor predeterminado cuando privacyType es "private"
      applicationQuestions: event?.applicationQuestions || "",

      mediaItems: mediaItems,
      eventPhotos: [],
      eventVideos: [],
      eventPhoto: undefined,
      eventVideo: undefined,
      mainMediaFile: undefined,
      mainMediaType: undefined,
    },
  });

  // Verificar autenticación
  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Autenticación Requerida",
        description: "Por favor, inicia sesión para crear eventos",
        variant: "destructive",
      });
      navigate("/login");
    }
  }, [user, isLoading, toast, navigate]);
  
  // Para edit mode, no necesitamos efecto de ubicación inicial ya que tenemos los datos del evento
  // Este useEffect se mantiene por compatibilidad pero en modo edición no se usa
  useEffect(() => {
    // En modo edición, los datos del evento ya están configurados en defaultValues
    // Este efecto se mantiene por compatibilidad con el componente original
    console.log("EditEventFormGoogle: Componente inicializado en modo edición");
  }, []);

  // Callback para guardar la referencia del mapa
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Manejar click en el mapa
  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      
      setMarkerPosition({ lat, lng });
      
      // Guardar como números, no strings
      form.setValue("latitude", lat);
      form.setValue("longitude", lng);
      
      // Obtener dirección y detalles del lugar
      reverseGeocode(lng, lat).then(async address => {
        console.log("Dirección geocodificada inversamente:", address);
        
        // Intentar obtener el nombre del lugar usando Places API si está disponible
        try {
          // Crear el servicio de Places
          if (window.google && window.google.maps && window.google.maps.places) {
            const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
            
            // Buscar lugares cercanos a las coordenadas donde se hizo clic
            const request = {
              location: new window.google.maps.LatLng(lat, lng),
              radius: 100, // Buscar en un radio de 100 metros
              type: 'establishment' // Priorizar establecimientos - debe ser un string, no un array
            };
            
            // Promisificar la llamada a nearbySearch
            const nearbyPlaces = await new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
              placesService.nearbySearch(request, (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                  resolve(results);
                } else {
                  reject(new Error(`Places API error: ${status}`));
                }
              });
            });
            
            // Si encontramos establecimientos cercanos, usar el nombre del primero
            if (nearbyPlaces && nearbyPlaces.length > 0) {
              console.log("Lugares encontrados cerca:", nearbyPlaces);
              const placeResult = nearbyPlaces[0];
              const placeName = placeResult.name || address.split(',')[0];
              
              form.setValue("locationAddress", address);
              form.setValue("locationName", placeName);
              
              toast({
                title: "Ubicación seleccionada",
                description: placeName,
              });
              return;
            }
          }
        } catch (placesError) {
          console.error("Error al buscar lugares cercanos:", placesError);
          // Continuar con el enfoque predeterminado si falla
        }
        
        // Método predeterminado: usar la primera parte de la dirección
        const locationName = address.split(',')[0] || "Lugar del evento";
        form.setValue("locationAddress", address);
        form.setValue("locationName", locationName);
        
        toast({
          title: "Ubicación seleccionada",
          description: "Ubicación guardada correctamente",
        });
      }).catch(error => {
        console.error("Error obteniendo dirección:", error);
        form.setValue("locationAddress", "Dirección no disponible");
        form.setValue("locationName", "Lugar del evento");
      });
    }
  }, [form, toast]);

  // Función para cambiar de paso con animación (necesaria para compatibilidad)
  const changeStep = useCallback((newStep: 1 | 2) => {
    setStepAnimation('fade-out');
    
    setTimeout(() => {
      setStep(newStep);
      setStepAnimation('fade-in');
      
      setTimeout(() => {
        setStepAnimation('none');
      }, 300);
    }, 300);
  }, []);

  // Validar ubicación antes de continuar al paso 2
  const validateAndContinue = async () => {
    // Log para depuración
    console.log("Validando ubicación:", {
      latitude: form.getValues("latitude"),
      longitude: form.getValues("longitude"),
      tipo_lat: typeof form.getValues("latitude"),
      tipo_lng: typeof form.getValues("longitude")
    });
    
    if (!form.getValues("latitude") || !form.getValues("longitude")) {
      toast({
        title: "Selecciona una ubicación",
        description: "Haz clic en el mapa para seleccionar dónde se realizará el evento",
        variant: "destructive"
      });
      return;
    }
    
    // Si falta nombre o dirección, intentar obtenerlos
    if (!form.getValues("locationName") || !form.getValues("locationAddress")) {
      try {
        // Siempre convertimos explícitamente a string y luego a número para evitar problemas de tipo
        const lngValue = form.getValues("longitude");
        const latValue = form.getValues("latitude");
        const lng = typeof lngValue === 'string' ? parseFloat(lngValue) : lngValue;
        const lat = typeof latValue === 'string' ? parseFloat(latValue) : latValue;
        
        const address = await reverseGeocode(lng || 0, lat || 0);
        
        const locationName = address.split(',')[0] || "Lugar del evento";
        form.setValue("locationAddress", address);
        form.setValue("locationName", locationName);
      } catch (error) {
        // Si falla, usar valores por defecto
        form.setValue("locationAddress", "Dirección no disponible");
        form.setValue("locationName", "Lugar del evento");
      }
    }
    
    // Avanzar al siguiente paso con animación
    changeStep(2);
  };

  // Función para eliminar el evento
  const handleDeleteEvent = async () => {
    if (!eventId) return;
    
    // Confirmar eliminación
    const confirmDelete = window.confirm(
      "¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer."
    );
    
    if (!confirmDelete) return;
    
    setIsDeleting(true);
    
    try {
      console.log(`🗑️ Starting deletion process for event ${eventId}`);
      
      // NO hacer optimistic update - esperar confirmación del servidor
      console.log("⏳ Waiting for server confirmation before updating UI");
      
      // Hacer la petición de eliminación primero
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete event');
      }
      
      console.log(`✅ Server confirmed deletion for event ${eventId}`);
      
      // Ahora actualizar el cache después de confirmación del servidor
      queryClient.setQueryData(['/api/events'], (oldData: any[]) => {
        if (!oldData) return oldData;
        return oldData.filter((event: any) => event.id !== eventId);
      });
      
      // Invalidar queries para asegurar consistencia
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['user-events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/events/created'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/events/attending'] });
      
      console.log("🗑️ Cache updated, waiting for map refresh");
      
      // Esperar a que el mapa se actualice completamente
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verificar que el evento ya no esté en el cache
      const eventsData = queryClient.getQueryData(["/api/events"]) as any[];
      const eventStillExists = eventsData?.some((e: any) => e.id === eventId);
      
      if (eventStillExists) {
        console.log("🔄 Event still in cache, waiting longer");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log("🗑️ Deletion process complete, closing panels");
      
      toast({
        title: "Evento eliminado",
        description: "El evento ha sido eliminado exitosamente",
      });
      
      // AHORA cerrar los paneles después de que todo esté completo
      onClose();
      
      if (onEventUpdated) {
        onEventUpdated();
      }
      
      // Navegar al mapa principal
      navigate('/');
    } catch (error) {
      console.error("Error eliminando evento:", error);
      
      // ROLLBACK: Invalidar cache para restaurar el evento
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar el evento. Se restauró en el mapa.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Enviar formulario al servidor
  const onSubmit = async (data: FormValues) => {
    console.log("🚀 onSubmit called with data:", data);
    console.log("🔍 onSubmit - data type:", typeof data);
    console.log("🔍 onSubmit - data keys:", Object.keys(data || {}));
    
    // SOLUCIÓN AL ERROR UNDEFINED:
    // El problema ocurre porque los datos no están definidos correctamente
    // Vamos a asegurarnos que todos los valores críticos estén definidos
    
    if (!data || typeof data !== 'object') {
      console.error("❌ Datos del formulario inválidos:", data);
      toast({
        title: "Error en formulario",
        description: "Los datos del formulario no son válidos. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
      return;
    }
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Verificación adicional para mediaItems - Esto es crucial para evitar undefined
      if (!data.mediaItems || !Array.isArray(data.mediaItems)) {
        console.warn("data.mediaItems no es un array válido. Inicializando como array vacío.");
        data.mediaItems = [];
      }
      
      // Preparar datos para la API
      const dateTime = new Date(`${data.date}T${data.time}`);
      
      // Crear FormData para enviar archivos
      const formData = new FormData();
      
      // Añadir campos básicos
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('category', data.category);
      formData.append('date', dateTime.toISOString());
      formData.append('latitude', String(data.latitude));
      formData.append('longitude', String(data.longitude));
      formData.append('locationName', data.locationName);
      formData.append('locationAddress', data.locationAddress);
      formData.append('paymentType', data.paymentType);
      formData.append('privacyType', data.privacyType);
      
      // Añadir campos condicionales
      if (data.paymentType === 'paid' && data.price) {
        formData.append('price', data.price);
      }
      
      if (data.privacyType === 'private' && data.privateAccessType) {
        formData.append('privateAccessType', data.privateAccessType);
        
        // Añadir preguntas de aplicación si es relevante
        if (data.privateAccessType === 'postulacion' && data.applicationQuestions) {
          formData.append('applicationQuestions', data.applicationQuestions);
        }
      }
      
      // ===== CORRECCIÓN DEL BUG "UNDEFINED" =====
      // Este es el parche directo para solucionar el problema con los archivos multimedia
      // 1. Asegurar que formData tenga un valor por defecto para mainMediaType
      formData.append('mainMediaType', 'photo'); // Valor seguro por defecto
      
      // 2. Filtrar y procesar mediaItems
      const validMediaItems = data.mediaItems.filter(item => 
        item && 
        typeof item === 'object' && 
        !item.deleted && 
        !item.toDelete
      );
      
      // 3. Buscar un elemento principal o usar el primero disponible
      const mainMediaItem = validMediaItems.find(item => item.isMain) || 
                           (validMediaItems.length > 0 ? validMediaItems[0] : null);
      
      // 4. Procesar el elemento principal si existe
      if (mainMediaItem) {
        if (mainMediaItem.file instanceof File) {
          formData.append('mainMediaFile', mainMediaItem.file);
          formData.append('mainMediaType', mainMediaItem.type || 'photo');
          console.log("Archivo principal agregado:", mainMediaItem.file.name);
        } else if (mainMediaItem.url) {
          formData.append('mainMediaUrl', mainMediaItem.url);
          formData.append('mainMediaType', mainMediaItem.type || 'photo');
          console.log("URL principal agregada:", mainMediaItem.url);
        }
      }
      
      // 5. Procesar archivos multimedia nuevos (solo los que tienen File object)
      let fileIndex = 0;
      const filesForUpload: any[] = [];
      
      validMediaItems.forEach((item, index) => {
        console.log(`📎 Processing media item ${index}:`, { 
          hasFile: !!item.file, 
          isNew: !!item.isNew, 
          type: item.type,
          isFileInstance: item.file instanceof File,
          fileName: item.file?.name || 'N/A',
          hasUrl: !!item.url
        });
        
        // Solo procesar archivos nuevos (que tienen File object)
        if (item.file instanceof File && item.isNew) {
          const fieldName = `mediaFile_${fileIndex}`;
          formData.append(fieldName, item.file);
          console.log(`✅ Added NEW file to FormData: ${fieldName} - ${item.file.name}`);
          
          // Guardar info del archivo para metadata
          filesForUpload.push({
            fieldName,
            type: item.type,
            isMain: item === mainMediaItem,
            order: item.order || index,
            id: item.id
          });
          
          fileIndex++;
        }
      });
      
      // 6. Preparar metadata completa incluyendo archivos existentes y nuevos
      const mediaItemsMetadata = validMediaItems.map((item, index) => {
        // Si es un archivo nuevo, encontrar su info de upload
        const uploadInfo = filesForUpload.find(upload => upload.id === item.id);
        
        return {
          type: item.type || 'photo',
          isMain: item === mainMediaItem,
          order: item.order !== undefined ? item.order : index,
          id: item.id,
          url: item.url || null, // Preservar URL existente
          isNew: !!item.isNew, // Marcar si es nuevo
          hasFile: !!item.file // Marcar si tiene archivo
        };
      });
      
      // Agregar metadata como JSON
      formData.append('mediaItems', JSON.stringify(mediaItemsMetadata));
      
      // Añadir capacidad máxima si existe
      if (data.maxCapacity) {
        formData.append('maxCapacity', String(Number(data.maxCapacity)));
      }
      
      // Usar fetch directamente para FormData - UPDATE para editar evento existente
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        body: formData,
        credentials: 'include' // Para enviar cookies de sesión
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error del servidor:", errorData);
        
        // Verificar si es un error de autenticación
        if (response.status === 401) {
          toast({
            title: "Necesitas iniciar sesión",
            description: "Debes iniciar sesión antes de poder crear eventos.",
            variant: "destructive",
          });
          navigate("/login");
          return;
        }
        
        // Sanitizar mensaje de error para mostrar al usuario
        let safeErrorMessage = "Ocurrió un error al crear el evento. Por favor, inténtalo de nuevo.";
        
        try {
          if (errorData.message) {
            if (typeof errorData.message === 'string') {
              // Detectar error específico de "undefined"
              if (errorData.message.includes('undefined')) {
                console.warn("Detectado mensaje 'undefined' del servidor:", errorData.message);
                safeErrorMessage = "Error en la subida de archivos. Por favor, verifica los archivos e inténtalo nuevamente.";
              } else {
                safeErrorMessage = errorData.message;
              }
            } else if (typeof errorData.message === 'object') {
              // Intentar convertir a string si es posible
              safeErrorMessage = "Error del servidor: " + JSON.stringify(errorData.message);
            }
          }
        } catch (sanitizeError) {
          console.error("Error al sanitizar mensaje de error:", sanitizeError);
          // Mantener el mensaje seguro por defecto
        }
        
        toast({
          title: "Error al actualizar evento",
          description: safeErrorMessage,
          variant: "destructive",
        });
        
        setIsSubmitting(false);
        return;
      }
      
      const eventData = await response.json();
      console.log("Evento actualizado:", eventData);
      
      toast({
        title: "¡Evento actualizado!",
        description: "Los cambios se han guardado correctamente",
      });
      
      // Invalidar queries para refrescar datos
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      
      // Llamar al callback para actualizar los eventos si existe
      if (onEventUpdated) {
        console.log("Llamando a onEventUpdated para actualizar eventos...");
        onEventUpdated();
      }

      // Cerrar formulario (esto llamará al método en Home.tsx que limpia el estado)
      onClose();
      
      // No realizamos ninguna navegación adicional, ya que queremos permanecer en el mapa
      // y ver el evento recién creado en el contexto del mapa
      
      // Emitir notificación de éxito adicional para confirmar al usuario
      setTimeout(() => {
        toast({
          title: "¡Cambios guardados!",
          description: "El evento actualizado ya aparece en el mapa",
          variant: "default",
        });
      }, 500);
    } catch (error) {
      console.error("Error al actualizar evento:", error);
      
      toast({
        title: "Error al actualizar evento",
        description: "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función duplicada eliminada - ya está definida arriba
  
  // Función para volver al paso anterior o cerrar formulario
  const handleBackButtonClick = useCallback(() => {
    try {
      console.log("Botón de retroceso pulsado, paso actual:", step);
      
      // Cerrar el formulario directamente
      console.log("Cerrando formulario de evento - llamando a onClose directamente");
      onClose();
    } catch (error) {
      console.error("Error al manejar retroceso:", error);
      // Si hay un error, intentar cerrar directamente
      onClose();
    }
  }, [step, onClose]);
  
  // Renderizado condicional basado en el paso
  const renderStepContent = () => {
    if (step === 1) {
      return (
        <div className={`step-content ${stepAnimation}`}>
          <div className="space-y-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold mb-1">Ubicación del Evento</h2>
              <p className="text-sm text-gray-500">Selecciona dónde se realizará tu evento</p>
            </div>
            
            <div className="map-container" style={{ height: '400px', width: '100%', position: 'relative' }}>
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ height: '100%', width: '100%' }}
                  zoom={14}
                  center={center}
                  options={defaultMapConfig}
                  onClick={handleMapClick}
                  onLoad={onMapLoad}
                >
                  <Marker position={markerPosition} />
                </GoogleMap>
              ) : loadError ? (
                <div className="error-message p-4 bg-red-50 text-red-700 rounded-md">
                  No se pudo cargar el mapa: {loadError.message}
                </div>
              ) : (
                <div className="loading-spinner flex justify-center items-center h-full">
                  Cargando mapa...
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="locationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del lugar</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Centro Cultural, Parque, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="locationAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl>
                      <Input placeholder="Dirección completa" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-between mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleBackButtonClick}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Cancelar
              </Button>
              
              <Button 
                type="button"
                onClick={validateAndContinue}
              >
                Continuar
              </Button>
            </div>
          </div>
        </div>
      );
    } else {
      // Paso 2 - Detalles del evento
      return (
        <div className={`step-content ${stepAnimation}`}>
          <div className="space-y-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold mb-1">Detalles del Evento</h2>
              <p className="text-sm text-gray-500">Completa la información de tu evento</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span>Título del evento</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Concierto de Jazz, Taller de cerámica..." 
                        className="bg-card"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span>Categoría</span>
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-card">
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EVENT_CATEGORIES.map(category => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 flex items-center justify-center text-primary text-xs font-bold border border-primary rounded">i</span>
                      <span>Descripción</span>
                    </div>
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe de qué trata el evento, qué pueden esperar los asistentes..." 
                      className="min-h-[150px] bg-card resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Una buena descripción incluye: qué actividades se realizarán, qué deben traer los asistentes, 
                    y cualquier información importante sobre el lugar o los organizadores.
                  </p>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="maxCapacity"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Capacidad máxima (opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="number" 
                        placeholder="Deja en blanco si no hay límite"
                        className="pl-10 bg-card"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Establece un límite de asistentes para tu evento. 
                    Cuando se alcance este número, no se permitirán más registros.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 mb-4">
              <h3 className="text-md font-medium mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Fecha y hora
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <div className="flex items-center">
                        <FormLabel className="text-sm text-muted-foreground flex-grow">Fecha</FormLabel>
                        <Calendar 
                          className="h-4 w-4 text-primary mr-1" 
                        />
                      </div>
                      <FormControl>
                        <Input 
                          type="date" 
                          className="bg-card" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <div className="flex items-center">
                        <FormLabel className="text-sm text-muted-foreground flex-grow">Hora</FormLabel>
                        <Clock 
                          className="h-4 w-4 text-primary mr-1" 
                        />
                      </div>
                      <FormControl>
                        <Input 
                          type="time" 
                          className="bg-card" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 mb-4">
              <h3 className="text-md font-medium mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Tipo de acceso
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="paymentType"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm text-muted-foreground">Acceso</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-card">
                            <SelectValue placeholder="Selecciona tipo de acceso" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="free">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-green-500"></span>
                              Gratuito
                            </div>
                          </SelectItem>
                          <SelectItem value="paid">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                              De pago
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {form.watch("paymentType") === "paid" && (
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-sm text-muted-foreground">Precio (MXN)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="number" 
                              placeholder="Ej: 150"
                              className="pl-10 bg-card"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>
            
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 mb-4">
              <h3 className="text-md font-medium mb-3 flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Privacidad del evento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="privacyType"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm text-muted-foreground">Tipo de evento</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-card">
                            <SelectValue placeholder="Selecciona tipo de privacidad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="public">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-green-500"></span>
                              Público (visible para todos)
                            </div>
                          </SelectItem>
                          <SelectItem value="private">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                              Privado (acceso restringido)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {form.watch("privacyType") === "private" && (
                  <FormField
                    control={form.control}
                    name="privateAccessType"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-sm text-muted-foreground">Método de acceso</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-card">
                              <SelectValue placeholder="Tipo de acceso" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="solicitud">
                              <div className="flex items-center gap-2">
                                <Lock className="h-3 w-3 text-blue-500" />
                                Por solicitud (tú apruebas)
                              </div>
                            </SelectItem>
                            <SelectItem value="postulacion">
                              <div className="flex items-center gap-2">
                                <Users className="h-3 w-3 text-purple-500" />
                                Por postulación (formulario)
                              </div>
                            </SelectItem>
                            <SelectItem value="paga">
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-3 w-3 text-yellow-500" />
                                Solo de pago
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>
            
            {form.watch("privacyType") === "private" && 
             form.watch("privateAccessType") === "postulacion" && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">?</span>
                  <h3 className="text-md font-medium text-blue-700">Preguntas para postulantes</h3>
                </div>
                <p className="text-sm text-blue-600 mb-3">
                  Estas preguntas deberán ser respondidas por las personas que quieran asistir a tu evento privado.
                </p>
                <FormField
                  control={form.control}
                  name="applicationQuestions"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormControl>
                        <Textarea 
                          placeholder="Escribe las preguntas que quieres que respondan los interesados, separadas por líneas.
Ejemplo:
¿Por qué quieres participar en este evento?
¿Cuál es tu experiencia previa en este tema?
¿Qué esperas obtener de esta actividad?" 
                          className="min-h-[150px] bg-white"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-blue-600">
                        Escribe cada pregunta en una línea separada. Los postulantes deberán responder a todas ellas.
                      </p>
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            <div className="media-section border rounded-lg p-4 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-medium">Fotos y videos del evento</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Agrega fotos y videos para mostrar lo que los asistentes pueden esperar. 
                El primer elemento será la imagen destacada.
              </p>
              <MediaManager 
                existingMedia={(() => {
                  console.log("🔍 DEBUG - Event data en MediaManager:", event?.id, event?.title);
                  console.log("🔍 DEBUG - Event.mediaItems tipo:", typeof event?.mediaItems, "valor:", event?.mediaItems);
                  console.log("🔍 DEBUG - Event.mediaItems length:", Array.isArray(event?.mediaItems) ? event?.mediaItems.length : 'not array');
                  console.log("🔍 DEBUG - Processed mediaItems:", mediaItems.length, mediaItems);
                  return mediaItems; // Use the processed mediaItems instead of raw event.mediaItems
                })()}
                onChange={(newMediaItems) => {
                  console.log("MediaManager onChange en edit:", newMediaItems.length, "items");
                  form.setValue("mediaItems", newMediaItems);
                }} 
                maxPhotos={6}
                maxVideos={3}
                key={`media-manager-${eventId}-${mediaItems.length}`}
              />
            </div>
            
            <div className="flex justify-between items-center mt-8 pt-4 border-t">
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="destructive"
                  onClick={handleDeleteEvent}
                  disabled={isDeleting || isSubmitting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? (
                    <div className="flex items-center gap-2">
                      <LoadingSpinner size={16} />
                      <span>Eliminando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      <span>Eliminar Evento</span>
                    </div>
                  )}
                </Button>
              </div>
              
              <Button 
                type="button"
                disabled={isSubmitting || isDeleting}
                onClick={(e) => {
                  e.preventDefault();
                  console.log("🔲 Guardar Cambios button clicked");
                  console.log("🔍 Form state:", form.formState);
                  console.log("🔍 Form values:", form.getValues());
                  console.log("🔍 Form errors:", form.formState.errors);
                  console.log("🔍 Is form valid?:", form.formState.isValid);
                  console.log("🔍 Form isDirty?:", form.formState.isDirty);
                  console.log("🔍 Form isSubmitting?:", form.formState.isSubmitting);
                  console.log("🔍 Media items:", form.getValues().mediaItems);
                  
                  // Trigger form submission with enhanced error logging
                  const submitResult = form.handleSubmit(
                    (data) => {
                      console.log("✅ Form validation passed, calling onSubmit with data:", data);
                      return onSubmit(data);
                    }, 
                    (errors) => {
                      console.error("❌ Form validation failed with errors:", errors);
                      toast({
                        title: "Error de validación",
                        description: "Por favor revisa los campos marcados en rojo",
                        variant: "destructive",
                      });
                    }
                  );
                  
                  console.log("🔍 Submit result:", submitResult);
                  
                  // Execute the submission
                  submitResult();
                }}
                className="bg-primary hover:bg-primary/90 text-white px-8"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Guardando...</span>
                  </div>
                ) : (
                  <span>Guardar Cambios</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      );
    }
  };
  
  // Ocultar completamente el componente cuando no es visible
  if (!visible) return null;
  
  return (
    <div className="w-full">
      <Form {...form}>
        <form className="px-4 space-y-6">
          {renderStepContent()}
        </form>
      </Form>
    </div>
  );
};

export default EditEventFormGoogle;