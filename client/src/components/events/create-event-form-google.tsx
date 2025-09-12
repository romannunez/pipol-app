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
import { ArrowLeft, MapIcon, Compass, Search, Camera, Video, Clock, Calendar, MapPin, Tag, Users, DollarSign, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
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

// Form schema para validación de eventos
const createEventSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  category: z.string().min(1, "Por favor, selecciona una categoría"),
  date: z.string().min(1, "Por favor, selecciona una fecha"),
  time: z.string().min(1, "Por favor, selecciona una hora"),
  endTime: z.string().min(1, "Por favor, selecciona una hora de finalización"),
  latitude: z.string().or(z.number()),
  longitude: z.string().or(z.number()),
  locationName: z.string().min(3, "El nombre del lugar debe tener al menos 3 caracteres"),
  locationAddress: z.string().min(5, "La dirección debe tener al menos 5 caracteres"),
  paymentType: z.string().min(1, "Por favor, selecciona un tipo de pago"),
  price: z.string().optional(),
  maxCapacity: z.string().optional(),
  privacyType: z.string().min(1, "Por favor, selecciona un tipo de privacidad"),
  genderPreference: z.enum(['all_people', 'men', 'women']).default('all_people'),
  privateAccessType: z.enum(['solicitud', 'postulacion', 'paga']).optional(),
  applicationQuestions: z.string().optional(),

  // Campo para gestión multimedia unificada - OBLIGATORIO AL MENOS UN ARCHIVO
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
  ).min(1, "Debes subir al menos un archivo (foto o video) para crear el evento").default([]),
  
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

type CreateEventFormProps = {
  onClose: () => void;
  visible: boolean;
  initialLocation?: LocationData | null;
  onEventCreated?: () => void; // Callback para cuando se crea el evento con éxito
  isEditMode?: boolean;        // Indica si estamos en modo edición
  eventToEdit?: any;           // Datos del evento a editar
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
 * Componente CreateEventForm - Formulario para crear nuevos eventos
 */
/**
 * CreateEventFormGoogle con manejo mejorado de ciclo de vida para evitar problemas
 * al cerrar el formulario. El componente se destruye completamente al cerrarse.
 * También funciona en modo edición cuando isEditMode=true.
 */
const CreateEventFormGoogle = ({ onClose, visible, initialLocation, onEventCreated, isEditMode, eventToEdit }: CreateEventFormProps) => {
  console.log("Creando instancia de CreateEventFormGoogle", isEditMode ? "en modo EDICIÓN" : "en modo CREACIÓN");
  // Estados principales
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Cuando el componente va a ser desmontado, limpiar cualquier estado o efecto pendiente
  useEffect(() => {
    return () => {
      console.log("Desmontando CreateEventFormGoogle - limpiando recursos");
      // La función onClose ya habrá sido llamada desde el botón o desde otro lugar
      // Este es solo un lugar adicional para asegurar la limpieza completa
    };
  }, []);
  
  // Inicializar ubicación - Mostrar ubicación seleccionada o la ubicación predeterminada
  const defaultLocation = {
    lat: 19.4326, // Ciudad de México por defecto
    lng: -99.1332
  };
  
  // Usar ubicación inicial si existe, o la predeterminada
  const [center, setCenter] = useState(
    initialLocation 
      ? { lat: initialLocation.latitude, lng: initialLocation.longitude } 
      : defaultLocation
  );
  
  // Configurar el marcador con la misma ubicación inicial
  const [markerPosition, setMarkerPosition] = useState(
    initialLocation 
      ? { lat: initialLocation.latitude, lng: initialLocation.longitude } 
      : defaultLocation
  );
  
  // Establecer el paso inicial - Si hay ubicación inicial, ir al paso 2
  const [step, setStep] = useState<1 | 2>(1);
  
  // Cargar Google Maps
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });
  
  // Hooks y referencias
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [_, navigate] = useLocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  
  // Procesar datos del evento para edición, si existen
  const getDefaultValues = () => {
    if (isEditMode && eventToEdit) {
      console.log("Precargando evento para editar:", eventToEdit);
      
      // Convertir coordenadas a números si son strings
      const lat = typeof eventToEdit.latitude === 'string' ? parseFloat(eventToEdit.latitude) : eventToEdit.latitude;
      const lng = typeof eventToEdit.longitude === 'string' ? parseFloat(eventToEdit.longitude) : eventToEdit.longitude;
      
      // Obtener fecha y hora formateadas
      const eventDate = eventToEdit.date ? new Date(eventToEdit.date) : new Date();
      const formattedDate = eventDate.toISOString().split('T')[0];
      const hours = eventDate.getHours().toString().padStart(2, '0');
      const minutes = eventDate.getMinutes().toString().padStart(2, '0');
      const formattedTime = `${hours}:${minutes}`;
      
      // Extraer datos multimedia
      let mediaItems = [];
      if (eventToEdit.mediaItems) {
        try {
          mediaItems = JSON.parse(eventToEdit.mediaItems);
        } catch (e) {
          console.error("Error parsing mediaItems:", e);
        }
      }
      
      return {
        title: eventToEdit.title || "",
        description: eventToEdit.description || "",
        category: eventToEdit.category || "",
        date: formattedDate,
        time: formattedTime,
        latitude: lat,
        longitude: lng,
        locationName: eventToEdit.locationName || "",
        locationAddress: eventToEdit.locationAddress || "",
        paymentType: eventToEdit.paymentType || "free",
        price: eventToEdit.price ? eventToEdit.price.toString() : "",
        maxCapacity: eventToEdit.maxCapacity ? eventToEdit.maxCapacity.toString() : "",
        privacyType: eventToEdit.privacyType || "public",
        genderPreference: eventToEdit.genderPreference || "all_people",
        privateAccessType: eventToEdit.privateAccessType || "solicitud",
        applicationQuestions: eventToEdit.applicationQuestions || "",
        mediaItems: mediaItems,
        eventPhotos: [],
        eventVideos: [],
        eventPhoto: undefined,
        eventVideo: undefined,
        mainMediaFile: undefined,
      };
    } else {
      // Valores por defecto para creación
      return {
        title: "",
        description: "",
        category: "",
        date: "",
        time: "",
        // Asegurarnos de que las coordenadas se traten como números
        latitude: initialLocation ? parseFloat(String(initialLocation.latitude)) : "",
        longitude: initialLocation ? parseFloat(String(initialLocation.longitude)) : "",
        locationName: initialLocation?.locationName || "",
        locationAddress: initialLocation?.locationAddress || "",
        paymentType: "free",
        price: "",
        maxCapacity: "",
        privacyType: "public",
        genderPreference: "all_people",
        privateAccessType: "solicitud", // Valor predeterminado cuando privacyType es "private"
        applicationQuestions: "",
        mediaItems: [],
        eventPhotos: [],
        eventVideos: [],
        eventPhoto: undefined,
        eventVideo: undefined,
        mainMediaFile: undefined,
      };
    }
  };

  // Inicializar formulario con valores iniciales y resolver problemas de tipos
  const form = useForm<FormValues, any, FormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: getDefaultValues(),
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
  
  // Efecto para actualizar el paso y valores del formulario cuando cambia la ubicación inicial
  useEffect(() => {
    if (initialLocation) {
      console.log("Recibida ubicación inicial:", initialLocation);
      
      // Verificar que las coordenadas sean válidas antes de continuar
      const lat = Number(initialLocation.latitude);
      const lng = Number(initialLocation.longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        console.error("Coordenadas inválidas recibidas:", {
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          tipoLat: typeof initialLocation.latitude,
          tipoLng: typeof initialLocation.longitude
        });
        
        toast({
          title: "Error en coordenadas",
          description: "Las coordenadas recibidas no son válidas. Por favor intenta seleccionar otra ubicación.",
          variant: "destructive"
        });
        
        // No avanzar al paso 2 si las coordenadas no son válidas
        return;
      }
      
      // Actualizar los valores del formulario explícitamente
      form.setValue("latitude", lat);
      form.setValue("longitude", lng);
      form.setValue("locationName", initialLocation.locationName || "");
      form.setValue("locationAddress", initialLocation.locationAddress || "");
      
      // También actualizar el estado del mapa y el marcador con la nueva ubicación
      setCenter({ lat, lng });
      setMarkerPosition({ lat, lng });
      
      console.log("Formulario actualizado con valores:", {
        lat: form.getValues("latitude"),
        lng: form.getValues("longitude"),
        tipoLat: typeof form.getValues("latitude"),
        tipoLng: typeof form.getValues("longitude")
      });
      
      // Establecer al paso 2 solo cuando recibimos coordenadas válidas
      setStep(2);
    } else {
      // SOLUCIÓN AL BUG DE PERSISTENCIA DE UBICACIÓN:
      // Cuando initialLocation es null, resetear la ubicación al valor predeterminado
      console.log("initialLocation es null - reseteando ubicación a valores predeterminados");
      
      // Reset location values to defaults
      form.setValue("latitude", "");
      form.setValue("longitude", "");
      form.setValue("locationName", "");
      form.setValue("locationAddress", "");
      
      // Reset map center and marker to default location
      setCenter(defaultLocation);
      setMarkerPosition(defaultLocation);
      
      // Reset to step 1 since there's no location selected
      setStep(1);
    }
  }, [initialLocation, form, toast]);

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
        
        const address = await reverseGeocode(lng, lat);
        
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

  // Enviar formulario al servidor
  const onSubmit = async (data: FormValues) => {
    // SOLUCIÓN AL ERROR UNDEFINED:
    // El problema ocurre porque los datos no están definidos correctamente
    // Vamos a asegurarnos que todos los valores críticos estén definidos
    
    if (!data || typeof data !== 'object') {
      console.error("Datos del formulario inválidos:", data);
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
      const endDateTime = data.endTime ? new Date(`${data.date}T${data.endTime}`) : new Date(dateTime.getTime() + 2 * 60 * 60 * 1000); // Default to 2 hours later
      
      // Validate that end time is after start time
      if (endDateTime <= dateTime) {
        toast({
          title: "Error de horario",
          description: "La hora de finalización debe ser posterior a la hora de inicio.",
          variant: "destructive",
        });
        return;
      }
      
      // Check for scheduling conflicts before creating the event
      try {
        const response = await fetch(`/api/events/check-conflicts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            startTime: dateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            paymentType: data.paymentType
          })
        });
        
        if (response.ok) {
          const conflictCheck = await response.json();
          if (conflictCheck.hasConflict) {
            toast({
              title: "Conflicto de horarios",
              description: conflictCheck.message || "Ya tienes eventos programados que se superponen con este horario.",
              variant: "destructive",
            });
            return;
          }
        }
      } catch (error) {
        console.error('Error checking conflicts:', error);
        // Continue anyway if conflict check fails
      }
      
      // Crear FormData para enviar archivos
      const formData = new FormData();
      
      // Añadir campos básicos
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('category', data.category);
      formData.append('date', dateTime.toISOString());
      formData.append('endTime', endDateTime.toISOString());
      formData.append('latitude', String(data.latitude));
      formData.append('longitude', String(data.longitude));
      formData.append('locationName', data.locationName);
      formData.append('locationAddress', data.locationAddress);
      formData.append('paymentType', data.paymentType);
      formData.append('privacyType', data.privacyType);
      formData.append('genderPreference', data.genderPreference);
      
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
      
      // 5. Procesar elementos multimedia (excluyendo el principal para evitar duplicación)
      validMediaItems.forEach((item, index) => {
        if (item.file instanceof File && item !== mainMediaItem) {
          formData.append(`mediaFile_${index}`, item.file);
        }
      });
      
      // 6. Preparar metadata para todos los elementos
      const mediaItemsMetadata = validMediaItems.map((item, index) => ({
        type: item.type || 'photo',
        isMain: item === mainMediaItem,
        order: index,
        id: item.id
      }));
      
      // Agregar metadata como JSON
      formData.append('mediaItems', JSON.stringify(mediaItemsMetadata));
      
      // Añadir capacidad máxima si existe
      if (data.maxCapacity) {
        formData.append('maxCapacity', String(Number(data.maxCapacity)));
      }
      
      // Verificar si estamos en modo edición
      const isEditingMode = isEditMode && eventToEdit && eventToEdit.id;
      
      console.log(`${isEditingMode ? "Actualizando" : "Creando"} datos del evento:`, {
        id: isEditingMode ? eventToEdit.id : "nuevo",
        title: data.title,
        description: data.description.substring(0, 30),
        category: data.category,
        mediaItems: data.mediaItems?.length || 0
      });
      
      // Usar fetch directamente para FormData
      // IMPORTANTE: Para edición siempre usamos PATCH porque maneja correctamente 
      // tanto los archivos como los metadatos de multimedia
      const url = isEditingMode ? `/api/events/${eventToEdit.id}` : '/api/events';
      const method = isEditingMode ? 'PATCH' : 'POST';
      
      // Debug: inspeccionar qué contiene el FormData antes de enviarlo
      console.log("===== CONTENIDO DEL FORMDATA =====");
      console.log("Modo:", isEditingMode ? "EDICIÓN" : "CREACIÓN", "usando método:", method);
      console.log("URL:", url);
      let formDataEntries: Record<string, any> = {};
      formData.forEach((value, key) => {
        if (key === 'mediaItems') {
          try {
            formDataEntries[key] = JSON.parse(value.toString());
          } catch (error) {
            formDataEntries[key] = value.toString();
          }
        } else if (value instanceof File) {
          formDataEntries[key] = `File: ${value.name}`;
        } else {
          formDataEntries[key] = value.toString();
        }
      });
      console.log("FormData contiene:", formDataEntries);
      
      const response = await fetch(url, {
        method: method,
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
          title: "Error al crear evento",
          description: safeErrorMessage,
          variant: "destructive",
        });
        
        setIsSubmitting(false);
        return;
      }
      
      const eventData = await response.json();
      console.log(`Evento ${isEditMode && eventToEdit ? 'actualizado' : 'creado'}:`, eventData);
      
      toast({
        title: isEditMode && eventToEdit ? "¡Evento actualizado!" : "¡Evento creado!",
        description: isEditMode && eventToEdit ? "Tu evento se ha actualizado correctamente" : "Tu evento se ha creado correctamente",
      });
      
      // Emitir evento personalizado para actualizar todas las vistas
      if (isEditMode && eventToEdit) {
        // Emitir evento DOM para componentes que no usan react-query
        const eventUpdateEvent = new CustomEvent('event-updated', { 
          detail: { eventId: eventData.id, data: eventData } 
        });
        window.dispatchEvent(eventUpdateEvent);
        console.log('Evento personalizado emitido para actualización de evento:', eventData.id);
      }
      
      // Llamar al callback para actualizar los eventos en el mapa si existe
      if (onEventCreated) {
        console.log("Llamando a onEventCreated para actualizar eventos...");
        onEventCreated();
      }

      // Cerrar formulario (esto llamará al método en Home.tsx que limpia el estado)
      onClose();
      
      // No realizamos ninguna navegación adicional, ya que queremos permanecer en el mapa
      // y ver el evento recién creado en el contexto del mapa
      
      // Emitir notificación de éxito adicional para confirmar al usuario
      setTimeout(() => {
        toast({
          title: "¡Evento visible en el mapa!",
          description: "Tu nuevo evento ya aparece en el mapa",
          variant: "default",
        });
      }, 500);
    } catch (error) {
      console.error("Error al crear evento:", error);
      
      toast({
        title: "Error al crear evento",
        description: "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Animación para cambio de paso
  const [stepAnimation, setStepAnimation] = useState<'none' | 'fade-out' | 'fade-in'>('none');
  
  // Función para cambiar de paso con animación
  const changeStep = useCallback((newStep: 1 | 2) => {
    // Iniciar animación de salida
    setStepAnimation('fade-out');
    
    // Después de que termine la animación de salida, cambiar al nuevo paso y comenzar la animación de entrada
    setTimeout(() => {
      setStep(newStep);
      setStepAnimation('fade-in');
      
      // Reset del estado de la animación después de completarla
      setTimeout(() => {
        setStepAnimation('none');
      }, 300);
    }, 300);
  }, []);
  
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
                          min={new Date().toISOString().split('T')[0]}
                          max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
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
                        <FormLabel className="text-sm text-muted-foreground flex-grow">Hora de inicio</FormLabel>
                        <Clock 
                          className="h-4 w-4 text-primary mr-1" 
                        />
                      </div>
                      <FormControl>
                        <Input 
                          type="time" 
                          className="bg-card"
                          min={
                            form.watch("date") === new Date().toISOString().split('T')[0] 
                              ? new Date().toTimeString().slice(0, 5)
                              : undefined
                          }
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            // Reset end time when start time changes
                            const endTimeValue = form.watch("endTime");
                            if (endTimeValue && e.target.value >= endTimeValue) {
                              form.setValue("endTime", "");
                            }
                          }} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <div className="flex items-center">
                        <FormLabel className="text-sm text-muted-foreground flex-grow">Hora de finalización</FormLabel>
                        <Clock 
                          className="h-4 w-4 text-primary mr-1" 
                        />
                      </div>
                      <FormControl>
                        <Input 
                          type="time" 
                          className="bg-card"
                          min={form.watch("time") || "00:00"}
                          disabled={!form.watch("time")}
                          placeholder="Selecciona primero la hora de inicio"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        La hora de finalización debe ser después de la hora de inicio
                      </p>
                    </FormItem>
                  )}
                />
                
                <div className="flex items-center justify-center text-sm text-gray-500">
                  {form.watch("paymentType") === "paid" ? (
                    <span>Las personas verán tanto el horario de inicio como el de finalización</span>
                  ) : (
                    <span>Si tu evento es público y gratuito las personas solo verán el horario de inicio del evento</span>
                  )}
                </div>
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
            
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 mb-4">
              <h3 className="text-md font-medium mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Destinado Para
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="genderPreference"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm text-muted-foreground">Público destinatario del evento</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-card">
                            <SelectValue placeholder="Selecciona para quién es el evento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all_people">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                              Todas las Personas
                            </div>
                          </SelectItem>
                          <SelectItem value="men">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-cyan-500"></span>
                              Hombres
                            </div>
                          </SelectItem>
                          <SelectItem value="women">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-pink-500"></span>
                              Mujeres
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                existingMedia={form.watch("mediaItems")} 
                onChange={(mediaItems) => form.setValue("mediaItems", mediaItems)} 
              />
            </div>
            
            <div className="flex justify-between mt-8 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleBackButtonClick}
                className="bg-white hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Cancelar
              </Button>
              
              <Button 
                type="submit"
                disabled={isSubmitting}
                onClick={form.handleSubmit(onSubmit)}
                className="bg-primary hover:bg-primary/90 text-white px-8"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{isEditMode && eventToEdit ? "Guardando..." : "Creando..."}</span>
                  </div>
                ) : (
                  <span>{isEditMode && eventToEdit ? "Guardar Cambios" : "Crear Evento"}</span>
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

export default CreateEventFormGoogle;