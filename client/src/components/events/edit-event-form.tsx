import React, { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, MapIcon, Compass, Search } from "lucide-react";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, libraries, reverseGeocode, defaultMapConfig } from "@/lib/google-maps";
import { MediaManager, type MediaItem } from "./media-manager-v2";
import mapboxgl from 'mapbox-gl';
import { searchLocations } from "@/lib/mapbox";
import { useQueryClient } from '@tanstack/react-query';

// Definición centralizada de categorías para reutilización (igual que en el formulario de creación)
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

// Definición del esquema de validación para edición (modo flexible - sin campos obligatorios estrictos)
const editEventSchema = z.object({
  title: z.string().optional().default(""),
  description: z.string().optional().default(""),
  category: z.string().optional().default(""),
  date: z.string().optional().default(""),
  time: z.string().optional().default(""),
  endTime: z.string().optional().default(""),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationName: z.string().optional().default(""),
  locationAddress: z.string().optional().default(""),
  paymentType: z.string().optional().default("free"),
  price: z.string().optional().default(""),
  maxCapacity: z.string().optional().default(""),
  privacyType: z.string().optional().default("public"),
  // Campos para gestión multimedia - archivos existentes se conservan
  mediaItems: z.array(z.any()).optional().nullable(),
  // Compatibilidad con código existente
  eventPhoto: z.instanceof(File).optional().nullable(),
  eventVideo: z.instanceof(File).optional().nullable(),
  // Campos adicionales para eventos privados
  privateAccessType: z.string().optional().nullable(),
  applicationQuestions: z.string().optional().nullable(),
});

// Tipos para props y datos
type LocationData = {
  latitude: number;
  longitude: number;
  locationName: string;
  locationAddress: string;
};

type EditEventFormProps = {
  eventId: number;
  onClose: () => void;
  onEventUpdated?: () => void;
  visible: boolean;
  event: {
    id: number;
    title: string;
    description: string;
    category: string;
    date: string;
    locationName: string;
    locationAddress: string;
    paymentType: string;
    price?: string | number;
    maxCapacity?: number | string;
    privacyType: string;
    latitude: string | number;
    longitude: string | number;
    organizerId: number;
    organizer?: {
      id: number;
      name: string;
      avatar?: string;
    };
    photoUrl?: string;
    photo_url?: string;
    videoUrl?: string;
    video_url?: string;
    mainMediaUrl?: string;
    mainMediaType?: string;
    mediaItems?: string;
    privateAccessType?: string | null;
    applicationQuestions?: string | null;
    endTime?: string;
  };
};

type FormValues = z.infer<typeof editEventSchema> & {
  mediaItems: MediaItem[];
};

/**
 * Componente EditEventForm - Formulario para editar eventos existentes
 * Réplica del formulario de creación adaptado para edición
 */
const EditEventForm = ({ eventId, onClose, onEventUpdated, visible, event }: EditEventFormProps) => {
  // Estados principales
  const [step, setStep] = useState<1 | 2>(2); // Al editar empezamos en paso 2
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // Convertir coordenadas a números
  const latitudeNum = typeof event.latitude === 'string' ? parseFloat(event.latitude) : event.latitude;
  const longitudeNum = typeof event.longitude === 'string' ? parseFloat(event.longitude) : event.longitude;
  
  const [mapLocation, setMapLocation] = useState<[number, number]>([
    longitudeNum, latitudeNum
  ]);
  
  // Debug: Mostrar toda la estructura del evento
  console.log("🔍 DEBUGGING EVENT STRUCTURE:");
  console.log("Event keys:", Object.keys(event));
  console.log("Event.mediaItems:", event.mediaItems);
  console.log("Event.media_items:", (event as any).media_items);
  console.log("Event.mainMediaUrl:", event.mainMediaUrl);
  console.log("Event.main_media_url:", (event as any).main_media_url);

  // Estado para elementos multimedia - procesar desde el evento
  const processMediaItems = useCallback(() => {
    console.log("📱 processMediaItems ejecutándose...");
    console.log("📱 event.mediaItems:", event.mediaItems, typeof event.mediaItems);
    console.log("📱 event.media_items:", (event as any).media_items, typeof (event as any).media_items);
    
    // Intentar tanto mediaItems como media_items (snake_case desde la DB)
    const mediaData = event.mediaItems || (event as any).media_items || event.mainMediaUrl;
    
    if (mediaData) {
      console.log("📱 Datos de media encontrados:", mediaData, "tipo:", typeof mediaData);
      
      try {
        // Si ya es un array, usarlo directamente
        if (Array.isArray(mediaData)) {
          console.log("📱 Es array, devolviendo:", mediaData);
          return mediaData;
        }
        
        // Si es string, parsearlo
        if (typeof mediaData === 'string' && mediaData.trim()) {
          console.log("📱 Es string, parseando:", mediaData);
          
          // Si es una URL simple (mainMediaUrl), crear un objeto MediaItem
          if (mediaData.startsWith('/') || mediaData.startsWith('http')) {
            const mediaItem = {
              type: mediaData.includes('.mp4') || mediaData.includes('.mov') || mediaData.includes('.webm') ? 'video' : 'photo',
              url: mediaData,
              order: 0,
              isMain: true
            };
            console.log("📱 Creando MediaItem desde URL:", mediaItem);
            return [mediaItem];
          }
          
          // Si no, intentar parsearlo como JSON
          try {
            const parsed = JSON.parse(mediaData);
            const result = Array.isArray(parsed) ? parsed : [];
            console.log("📱 Resultado parseado:", result);
            return result;
          } catch (e) {
            console.log("📱 No es JSON válido, tratando como URL simple");
            return [{
              type: 'photo',
              url: mediaData,
              order: 0,
              isMain: true
            }];
          }
        }
      } catch (error) {
        console.error("📱 Error procesando mediaItems:", error);
      }
    }
    
    // Como último recurso, intentar crear desde mainMediaUrl
    if (event.mainMediaUrl || (event as any).main_media_url) {
      const mainUrl = event.mainMediaUrl || (event as any).main_media_url;
      console.log("📱 Usando mainMediaUrl como fallback:", mainUrl);
      return [{
        type: event.mainMediaType === 'video' ? 'video' : 'photo',
        url: mainUrl,
        order: 0,
        isMain: true
      }];
    }
    
    console.log("📱 No se encontraron datos de media, devolviendo array vacío");
    return [];
  }, [event.mediaItems, (event as any).media_items]);
  
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => processMediaItems());
  
  // Hooks y referencias
  const { toast } = useToast();
  const { user } = useAuth();
  const [_, navigate] = useLocation();
  const queryClient = useQueryClient();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Crear un objeto Date a partir de la fecha almacenada
  const eventDate = event.date ? new Date(event.date) : new Date();
  
  // Formatear la fecha para el input type="date" (YYYY-MM-DD)
  const formattedDate = eventDate.toISOString().split('T')[0];
  
  // Extraer la hora para el input type="time" (HH:MM)
  const hours = eventDate.getHours().toString().padStart(2, '0');
  const minutes = eventDate.getMinutes().toString().padStart(2, '0');
  const formattedTime = `${hours}:${minutes}`;

  // Extraer hora de fin del evento si existe
  const formatEndTime = (endTimeString: any): string => {
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
  
  const formattedEndTime = formatEndTime(event.endTime || null);

  // Inicializar el formulario con los valores del evento
  const form = useForm<FormValues>({
    resolver: zodResolver(editEventSchema),
    defaultValues: {
      title: event.title || '',
      description: event.description || '',
      category: event.category || '',
      date: formattedDate,
      time: formattedTime,
      endTime: formattedEndTime,
      latitude: latitudeNum,
      longitude: longitudeNum,
      locationName: event.locationName || '',
      locationAddress: event.locationAddress || '',
      paymentType: event.paymentType || 'free',
      price: event.price ? event.price.toString() : '',
      maxCapacity: event.maxCapacity ? event.maxCapacity.toString() : '',
      privacyType: event.privacyType || 'public',
      privateAccessType: event.privateAccessType || null,
      applicationQuestions: event.applicationQuestions || null,
      mediaItems: (() => {
        const processed = processMediaItems();
        console.log("📱 Inicializando form con mediaItems:", processed);
        return processed;
      })(),
      eventPhoto: null,
      eventVideo: null,
    },
  });

  // Inicializar y gestionar el mapa
  useEffect(() => {
    // Solo inicializar si es visible y el contenedor está disponible
    if (!visible || !mapContainerRef.current) return;
    
    // Inicializar mapa
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: mapLocation,
      zoom: 13
    });
    
    // Añadir controles de navegación
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapRef.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true
      }), 
      'top-right'
    );
    
    // Añadir marcador inicial
    markerRef.current = new mapboxgl.Marker({ 
      draggable: true,
      color: "#FF5A5F"
    })
      .setLngLat(mapLocation)
      .addTo(mapRef.current);
    
    // Función para actualizar ubicación cuando se arrastra el marcador
    const updateLocationFromMarker = async (lng: number, lat: number) => {
      setMapLocation([lng, lat]);
      // Guardar como números, no como strings
      form.setValue("latitude", lat);
      form.setValue("longitude", lng);
      
      try {
        // Convertimos explícitamente a string los valores para evitar errores de tipo
        const address = await reverseGeocode(lng, lat);
        form.setValue("locationAddress", address);
        
        // Extraer nombre del lugar de la dirección
        const locationName = address.split(',')[0] || "Lugar del evento";
        if (!form.getValues("locationName")) {
          form.setValue("locationName", locationName);
        }
      } catch (error) {
        console.error("Error getting address:", error);
        // Si falla, mantener al menos las coordenadas
      }
    };
    
    // Configurar eventos del marcador y mapa
    if (markerRef.current) {
      markerRef.current.on('dragend', () => {
        if (markerRef.current) {
          const lngLat = markerRef.current.getLngLat();
          updateLocationFromMarker(lngLat.lng, lngLat.lat);
        }
      });
    }
    
    // Click en el mapa para colocar el marcador
    mapRef.current.on('click', (e) => {
      if (markerRef.current && mapRef.current) {
        mapRef.current.panTo(e.lngLat, { duration: 500 });
        markerRef.current.setLngLat(e.lngLat);
        
        updateLocationFromMarker(e.lngLat.lng, e.lngLat.lat);
        
        toast({
          title: "Ubicación seleccionada",
          description: "Obteniendo detalles de la dirección...",
        });
      }
    });
    
    // Limpiar al desmontar
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, [visible, mapLocation, form, toast]);
  
  // Escuchar eventos de cambio de elemento multimedia principal
  useEffect(() => {
    const handleMediaMainChanged = (event: CustomEvent) => {
      console.log("🔄 Cambio detectado en elemento principal multimedia:", event.detail);
      
      const { mediaItems, mainItem } = event.detail;
      
      if (mainItem && mediaItems) {
        // Actualizar el estado local
        setMediaItems(mediaItems);
        
        // Si hay un elemento principal, prepararlo para envío automático
        if (mainItem.url) {
          console.log("📤 Enviando actualización automática para elemento principal:", mainItem);
          
          // Crear FormData para enviar una actualización rápida solo del elemento principal
          const quickUpdateFormData = new FormData();
          
          // Agregar solo la información esencial para actualizar el elemento principal
          quickUpdateFormData.append('mediaItems', JSON.stringify(mediaItems));
          quickUpdateFormData.append('mainMediaType', mainItem.type);
          quickUpdateFormData.append('mainMediaUrl', mainItem.url);
          
          // Enviar una actualización rápida al servidor
          fetch(`/api/events/${eventId}`, {
            method: 'PUT',
            body: quickUpdateFormData,
          })
            .then(response => {
              if (response.ok) {
                console.log("✅ Actualización rápida de elemento principal exitosa");
                // Invalidar consultas para asegurar que todos los componentes se actualicen
                queryClient.invalidateQueries({ queryKey: ['events'] });
                queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
              } else {
                console.error("❌ Error en actualización rápida:", response.status);
              }
            })
            .catch(error => {
              console.error("❌ Error en actualización rápida:", error);
            });
        }
      }
    };
    
    // Registrar el event listener
    window.addEventListener('media-main-changed', handleMediaMainChanged as EventListener);
    
    // Limpiar al desmontar
    return () => {
      window.removeEventListener('media-main-changed', handleMediaMainChanged as EventListener);
    };
  }, [eventId, queryClient]);
  
  // Auto-actualización de eventos cuando los campos cambian
  useEffect(() => {
    // Crear un timer para auto-guardar
    let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
    
    // Registrar una función para detectar cambios en el formulario
    const subscription = form.watch((value, { name, type }) => {
      // Si es un cambio en un campo importante, programar autoguardado
      if (name && ['title', 'description', 'category', 'date', 'time', 'paymentType', 'price', 'maxCapacity', 'privacyType'].includes(name)) {
        console.log(`Campo "${name}" modificado, programando auto-guardado...`);
        
        // Cancelar timer anterior si existe
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
        }
        
        // Programar una nueva actualización después de 1 segundo de inactividad
        autoSaveTimer = setTimeout(() => {
          // Solo actualizar si hay cambios importantes
          if (form.formState.isDirty) {
            console.log("⏱️ Auto-guardando cambios tras inactividad...");
            setIsAutoSaving(true);
            
            // Obtener los valores actuales
            const currentData = form.getValues();
            
            // Crear FormData
            const autoSaveFormData = new FormData();
            
            // Solo agregar los campos modificados
            Object.entries(currentData).forEach(([key, value]) => {
              if (key !== 'mediaItems' && value !== undefined && value !== null) {
                autoSaveFormData.append(key, value.toString());
              }
            });
            
            // Construir fecha completa
            if (currentData.date && currentData.time) {
              const dateTimeStr = `${currentData.date}T${currentData.time}:00`;
              autoSaveFormData.append('dateTime', dateTimeStr);
            }
            
            // Agregar mediaItems en formato JSON
            if (mediaItems.length > 0) {
              autoSaveFormData.append('mediaItems', JSON.stringify(mediaItems));
            }
            
            // Enviar actualización automática
            fetch(`/api/events/${eventId}`, {
              method: 'PUT',
              body: autoSaveFormData,
            })
              .then(response => {
                if (response.ok) {
                  console.log("✅ Auto-guardado completado");
                  // Invalidar consultas relacionadas para mantener todo sincronizado
                  queryClient.invalidateQueries({ queryKey: ['events'] });
                  queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
                  
                  // Mostrar un indicador sutil solo la primera vez
                  if (name === 'title' || name === 'description') {
                    toast({
                      title: "✓ Cambios guardados automáticamente",
                      description: "Todos los cambios se guardan automáticamente mientras editas",
                      duration: 3000,
                    });
                  }
                } else {
                  console.error("❌ Error en auto-guardado:", response.status);
                  toast({
                    title: "Error al guardar cambios",
                    description: "No se pudieron guardar los cambios automáticamente",
                    variant: "destructive",
                  });
                }
              })
              .catch(error => {
                console.error("❌ Error en auto-guardado:", error);
                toast({
                  title: "Error al guardar cambios",
                  description: "No se pudieron guardar los cambios automáticamente",
                  variant: "destructive",
                });
              })
              .finally(() => {
                setIsAutoSaving(false);
              });
          }
        }, 1000); // 1 segundo de retraso
      }
    });
    
    // Limpiar suscripción y cancelar timer al desmontar
    return () => {
      subscription.unsubscribe();
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [form, eventId, mediaItems, queryClient]);

  // Buscar dirección y actualizar mapa
  const searchAddress = async (address: string) => {
    if (!mapRef.current || !markerRef.current) return;
    
    try {
      const results = await searchLocations(address, ['address', 'poi', 'poi.landmark', 'place']);
      
      if (results.length > 0) {
        const { center, place_name, properties, text } = results[0];
        
        // Actualizar estado y formulario - guardando como números
        setMapLocation([center[0], center[1]]);
        form.setValue("latitude", center[1]);
        form.setValue("longitude", center[0]);
        form.setValue("locationAddress", place_name);
        
        // Nombre de ubicación si es un punto de interés
        if (properties?.category && !form.getValues("locationName")) {
          form.setValue("locationName", text || place_name.split(',')[0]);
        }
        
        // Actualizar mapa
        mapRef.current.flyTo({ 
          center, 
          zoom: 15,
          essential: true,
          duration: 1000 
        });
        markerRef.current.setLngLat(center);
        
        toast({
          title: "Ubicación Encontrada",
          description: "Mapa actualizado a la ubicación buscada",
        });
      } else {
        toast({
          title: "Ubicación No Encontrada",
          description: "No se pudo encontrar la dirección especificada",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error buscando dirección:", error);
      toast({
        title: "Error de Búsqueda",
        description: "No se pudo buscar la dirección",
        variant: "destructive",
      });
    }
  };

  // Parsear los elementos multimedia del evento
  useEffect(() => {
    console.log("Procesando multimedia para evento:", event.id);
    
    let parsedItems: MediaItem[] = [];
    
    // Verificar si tenemos mediaItems como JSON
    if (event.mediaItems) {
      try {
        const parsed = JSON.parse(event.mediaItems);
        if (Array.isArray(parsed)) {
          parsedItems = parsed;
          console.log(`Cargados ${parsedItems.length} elementos multimedia para el evento ${event.id}`);
        } else {
          console.warn("mediaItems no es un array:", parsed);
        }
      } catch (error) {
        console.error('Error al parsear elementos multimedia:', error);
      }
    }
    
    // Si no tenemos items del JSON o el array está vacío, intentamos construir a partir de las propiedades individuales
    if (parsedItems.length === 0) {
      console.log("Construyendo array de multimedia a partir de propiedades individuales");
      
      // Verificar si tenemos mainMediaUrl (prioridad más alta)
      if (event.mainMediaUrl) {
        parsedItems.push({
          type: event.mainMediaType as 'photo' | 'video' || 'photo',
          url: event.mainMediaUrl,
          order: 0,
          isMain: true
        });
      }
      
      // Agregar photoUrl si existe y no es igual al mainMediaUrl
      const photoUrl = event.photoUrl || event.photo_url;
      if (photoUrl && (!event.mainMediaUrl || photoUrl !== event.mainMediaUrl)) {
        parsedItems.push({
          type: 'photo',
          url: photoUrl,
          order: parsedItems.length,
          isMain: parsedItems.length === 0
        });
      }
      
      // Agregar videoUrl si existe
      const videoUrl = event.videoUrl || event.video_url;
      if (videoUrl) {
        parsedItems.push({
          type: 'video',
          url: videoUrl,
          order: parsedItems.length,
          isMain: parsedItems.length === 0
        });
      }
    }
    
    // Asegurarse de que al menos un elemento está marcado como principal
    if (parsedItems.length > 0 && !parsedItems.some(item => item.isMain)) {
      parsedItems[0].isMain = true;
    }
    
    // Actualizar el estado y el formulario
    setMediaItems(parsedItems);
    form.setValue("mediaItems", parsedItems);
  }, [event, form]);

  // Manejar envío del formulario
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    
    try {
      // Crear un objeto FormData para manejar archivos
      const formData = new FormData();
      
      // Agregar campos de texto del formulario
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'mediaItems' && value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });
      
      // Combinar fecha y hora
      if (data.date && data.time) {
        const dateTimeStr = `${data.date}T${data.time}:00`;
        formData.append('dateTime', dateTimeStr);
      }
      
      // Procesar los mediaItems antes de enviarlos
      const processedMediaItems = [...mediaItems];
      
      // Verificar si hay nuevos archivos para determinar el método adecuado (PATCH o PUT)
      const hasNewFiles = processedMediaItems.some(item => item.file && item.isNew);
      
      // Agregar JSON de elementos multimedia (incluidos los marcados para eliminar)
      formData.append('mediaItems', JSON.stringify(processedMediaItems));
      formData.append('mediaItemsInfo', JSON.stringify(processedMediaItems));
      
      // Agregar archivos nuevos al formData
      if (hasNewFiles) {
        processedMediaItems.forEach((item, index) => {
          if (item.file && item.isNew) {
            // Usar nombre de campo compatible con el backend (mediaFile_X)
            formData.append(`mediaFile_${index}`, item.file);
            console.log(`Agregando archivo nuevo: mediaFile_${index}`, item.file.name);
          }
        });
      }
      
      // Seleccionar método apropiado según si hay archivos nuevos
      const method = hasNewFiles ? 'PATCH' : 'PUT';
      console.log(`Enviando formulario usando método ${method} con ${hasNewFiles ? 'archivos nuevos' : 'solo datos'}`);
      
      // Hacer la solicitud de actualización al servidor
      const response = await fetch(`/api/events/${eventId}`, {
        method,
        body: formData,
        // No establecer Content-Type, dejar que el navegador lo calcule con el boundary correcto
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar el evento');
      }
      
      // Parsear los datos del evento actualizado para trabajar con ellos
      const updatedEventData = await response.json();
      
      // Actualizar cache de eventos e invalidar consultas relacionadas inmediatamente
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/events/created'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/events/attending'] });
      
      // Pre-poblar la caché con los datos actualizados para evitar parpadeos
      queryClient.setQueryData([`/api/events/${eventId}`], updatedEventData);
      
      // Disparar el evento personalizado 'event-updated' para que otros componentes se actualicen
      if (updatedEventData && typeof window !== 'undefined') {
        const customEvent = new CustomEvent('event-updated', {
          detail: {
            eventId,
            data: updatedEventData,
            source: 'edit-form'
          }
        });
        window.dispatchEvent(customEvent);
        console.log('Enviado evento personalizado de actualización:', eventId);
      }
      
      // Mostrar notificación de éxito
      toast({
        title: "Evento actualizado",
        description: "Los cambios se han guardado correctamente",
      });
      
      // Cerrar el formulario - con un pequeño retraso para permitir que la caché se actualice
      setTimeout(() => {
        onClose();
      }, 100);
      
    } catch (error) {
      console.error('Error al actualizar evento:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'No se pudo actualizar el evento',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Manejar eliminación de evento
  const handleDeleteEvent = async () => {
    const confirmed = window.confirm("¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer.");
    
    if (!confirmed) return;
    
    setIsDeleting(true);
    console.log("🗑️ Iniciando eliminación del evento:", eventId);
    
    try {
      // NO hacer optimistic update - esperar a que la API confirme
      console.log("⏳ Esperando confirmación del servidor antes de actualizar UI");
      
      // Hacer la llamada a la API
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar el evento');
      }
      
      console.log("✅ Server confirmed deletion, now updating UI");
      
      // Ahora que el servidor confirmó, eliminar del cache local
      queryClient.setQueryData(["/api/events"], (oldData: any) => {
        if (!oldData) return [];
        return oldData.filter((event: any) => event.id !== eventId);
      });
      
      // Eliminar del cache individual también
      queryClient.removeQueries({ queryKey: [`/api/events/${eventId}`] });
      
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
      
      // Mostrar notificación de éxito
      toast({
        title: "Evento eliminado",
        description: "El evento ha sido eliminado correctamente",
      });
      
      // Cerrar panel de edición y llamar onEventUpdated para cerrar el panel de detalles también
      onClose();
      if (onEventUpdated) {
        onEventUpdated();
      }
      
      // Navegar al mapa principal
      navigate('/');
      
    } catch (error) {
      console.error('Error al eliminar evento:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'No se pudo eliminar el evento',
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Para verificar la vista actual (estilo de formulario diferente según la vista)
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isMapView = currentPath === '/' || currentPath === '';
  const isMyEventsEditView = currentPath === '/myevents' || currentPath.startsWith('/myevents/');
  
  // Formulario común para ambas vistas
  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="pb-44 relative">
        {step === 1 ? (
          /* Paso 1: Seleccionar ubicación */
          <div className="px-4 py-3 space-y-4">
            <h2 className="text-base font-medium text-neutral-800">Ubicación del evento</h2>
            
            {/* Buscador de direcciones */}
            <div className="flex items-center space-x-2 mb-4">
              <Input 
                id="search-address"
                placeholder="Buscar dirección o lugar" 
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    searchAddress((e.target as HTMLInputElement).value);
                  }
                }}
              />
              <Button 
                type="button" 
                variant="outline"
                onClick={() => {
                  const input = document.getElementById('search-address') as HTMLInputElement;
                  if (input && input.value) {
                    searchAddress(input.value);
                  }
                }}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Mapa para seleccionar ubicación */}
            <div 
              ref={mapContainerRef} 
              className="w-full h-[300px] bg-slate-100 rounded-md mb-4"
            ></div>
            
            <div className="text-sm text-neutral-500 mb-2">
              Haz clic en el mapa para seleccionar la ubicación exacta
            </div>
            
            {/* Campos ocultos para guardar las coordenadas */}
            <FormField
              control={form.control}
              name="latitude"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl>
                    <Input type="text" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="longitude"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl>
                    <Input type="text" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            {/* Botón para continuar */}
            <Button 
              type="button" 
              onClick={() => setStep(2)}
              className="w-full mt-4"
            >
              Continuar
            </Button>
          </div>
        ) : (
          /* Paso 2: Información del evento */
          <>
            {/* Sección de detalles básicos */}
            <div className="px-4 py-3 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-neutral-800">Detalles básicos</h2>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setStep(1)}
                >
                  <MapIcon className="h-4 w-4 mr-1" />
                  Cambiar ubicación
                </Button>
              </div>
              
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título del evento</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe tu evento..." 
                        className="min-h-[120px]" 
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
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select 
                      defaultValue={field.value} 
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EVENT_CATEGORIES.map((category) => (
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="locationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del lugar</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Teatro Colón" {...field} />
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
                      <Input placeholder="Ej: Calle Principal 123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Sección de privacidad */}
            <div className="px-4 py-3 space-y-4 border-t border-gray-100">
              <h2 className="text-base font-medium text-neutral-800">Privacidad</h2>
              
              <FormField
                control={form.control}
                name="privacyType"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Tipo de Evento</FormLabel>
                    <div className="flex w-full gap-2">
                      <Button
                        type="button"
                        className={`flex-1 py-2 ${field.value === 'public' ? 'bg-primary text-white' : 'bg-white text-neutral-700 border border-neutral-300'}`}
                        onClick={() => {
                          form.setValue("privacyType", "public");
                          form.setValue("privateAccessType", null);
                          form.setValue("applicationQuestions", null);
                        }}
                      >
                        Público
                      </Button>
                      <Button
                        type="button" 
                        className={`flex-1 py-2 ${field.value === 'private' ? 'bg-primary text-white' : 'bg-white text-neutral-700 border border-neutral-300'}`}
                        onClick={() => form.setValue("privacyType", "private")}
                      >
                        Privado
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {form.watch("privacyType") === "private" && (
                <FormField
                  control={form.control}
                  name="privateAccessType"
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel>Modo de Acceso</FormLabel>
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="solicitud"
                            value="solicitud"
                            checked={field.value === "solicitud"}
                            onChange={() => form.setValue("privateAccessType", "solicitud")}
                            className="h-4 w-4 text-primary"
                          />
                          <label htmlFor="solicitud" className="text-neutral-700 text-sm">
                            Por solicitud (aprobar o rechazar)
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="postulacion"
                            value="postulacion"
                            checked={field.value === "postulacion"}
                            onChange={() => form.setValue("privateAccessType", "postulacion")}
                            className="h-4 w-4 text-primary"
                          />
                          <label htmlFor="postulacion" className="text-neutral-700 text-sm">
                            Por postulación (con preguntas)
                          </label>
                        </div>
                        <div className="flex items-center space-x-2 opacity-50">
                          <input
                            type="radio"
                            id="paga"
                            value="paga"
                            disabled
                            checked={field.value === "paga"}
                            onChange={() => {}}
                            className="h-4 w-4 text-primary"
                          />
                          <label htmlFor="paga" className="text-neutral-700 text-sm">
                            Por pago (próximamente)
                          </label>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {/* Mostrar campo de preguntas solo si el tipo de acceso es por postulación */}
              {form.watch("privateAccessType") === "postulacion" && (
                <FormField
                  control={form.control}
                  name="applicationQuestions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preguntas para postulantes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Escribe aquí las preguntas que los usuarios deben responder..." 
                          className="min-h-[80px]" 
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="paymentType"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Tipo de Pago</FormLabel>
                    <div className="flex w-full gap-2">
                      <Button
                        type="button"
                        className={`flex-1 py-2 ${field.value === 'free' ? 'bg-primary text-white' : 'bg-white text-neutral-700 border border-neutral-300'}`}
                        onClick={() => {
                          form.setValue("paymentType", "free");
                          form.setValue("price", "");
                        }}
                      >
                        Gratuito
                      </Button>
                      <Button
                        type="button" 
                        className={`flex-1 py-2 ${field.value === 'paid' ? 'bg-primary text-white' : 'bg-white text-neutral-700 border border-neutral-300'}`}
                        onClick={() => form.setValue("paymentType", "paid")}
                        disabled
                      >
                        De pago (Próximamente)
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {form.watch("paymentType") === "paid" && (
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio (ARS $)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Ej: 500" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="maxCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidad máxima (opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Deja en blanco si no hay límite" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Sección de multimedia */}
            <div className="px-4 py-3 space-y-4 border-t border-gray-100">
              <h2 className="text-base font-medium text-neutral-800">Multimedia</h2>
              
              <div className="relative mb-4">
                {/* Indicadores visuales de estado de guardado */}
                {saveStatus === 'saving' && (
                  <div className="absolute top-2 right-2 bg-blue-500/80 text-white text-xs px-3 py-1 rounded-full animate-pulse z-10 flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-spin"></div>
                    Guardando...
                  </div>
                )}
                {saveStatus === 'saved' && (
                  <div className="absolute top-2 right-2 bg-green-500/90 text-white text-xs px-3 py-1 rounded-full z-10 flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    ¡Guardado!
                  </div>
                )}
                {saveStatus === 'error' && (
                  <div className="absolute top-2 right-2 bg-red-500/90 text-white text-xs px-3 py-1 rounded-full z-10 flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    Error
                  </div>
                )}
                {isAutoSaving && (
                  <div className="absolute top-2 right-2 bg-primary/80 text-white text-xs px-2 py-1 rounded-md animate-pulse z-10">
                    Guardando cambios...
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="mediaItems"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <MediaManager
                          existingMedia={(() => {
                            const processed = processMediaItems();
                            console.log("📱 MediaManager recibiendo existingMedia:", processed);
                            return processed;
                          })()}
                          onChange={(newMediaItems) => {
                            console.log("📱 MediaManager onChange en edit:", newMediaItems.length, "items", newMediaItems);
                            
                            // Actualizar el estado local primero para la UI
                            setMediaItems(newMediaItems);
                            
                            // Guardar el valor en el formulario también 
                            field.onChange(newMediaItems);
                            
                            // Mostrar indicador de cambio
                            setSaveStatus('saving');
                            setTimeout(() => setSaveStatus('saved'), 800);
                            setTimeout(() => setSaveStatus('idle'), 2500);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="px-4 py-3 space-y-4 border-t border-gray-100 sticky bottom-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <Button 
                  type="button" 
                  variant="destructive"
                  onClick={handleDeleteEvent}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <><LoadingSpinner size={16} className="mr-2" /> Eliminando</>
                  ) : (
                    "Eliminar evento"
                  )}
                </Button>
                
                <div className="flex space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || isAutoSaving}
                    className="relative"
                  >
                    {isSubmitting ? (
                      <><LoadingSpinner size={16} className="mr-2" /> Guardando</>
                    ) : isAutoSaving ? (
                      <>
                        <LoadingSpinner size={16} className="mr-2" /> 
                        Auto-guardando...
                      </>
                    ) : (
                      <>
                        ✓ Guardar cambios
                        <span className="text-xs ml-2 opacity-70">(Auto-guardado activado)</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </form>
    </Form>
  );
  
  // Si estamos en la vista de mapa, solo mostramos el formulario como contenido simple
  if (isMapView) {
    return <div className="w-full">{formContent}</div>;
  }
  
  // En la vista de "Mis eventos", mostramos el formulario con un layout y título de página
  return (
    <div className="w-full rounded-xl bg-white overflow-hidden">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex justify-between items-center p-4">
          <h3 className="text-lg font-medium">Editar evento</h3>
          <button 
            onClick={onClose}
            className="rounded-full p-2 hover:bg-gray-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        </div>
      </div>
      {formContent}
    </div>
  );
};

export default EditEventForm;