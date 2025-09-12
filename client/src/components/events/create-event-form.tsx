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
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, libraries, reverseGeocode, defaultMapConfig } from "@/lib/google-maps";
import MediaManager, { MediaItem } from "./media-manager";
import mapboxgl from 'mapbox-gl';
import { searchLocations } from "@/lib/mapbox";

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

// Opciones de preferencia de género disponibles
const GENDER_PREFERENCE_OPTIONS = [
  { value: 'all_people', label: 'Todas las Personas' },
  { value: 'men', label: 'Hombres' },
  { value: 'women', label: 'Mujeres' }
];

// Form schema para validación de eventos
const createEventSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  category: z.string().min(1, "Por favor, selecciona una categoría"),
  date: z.string().min(1, "Por favor, selecciona una fecha"),
  time: z.string().min(1, "Por favor, selecciona una hora"),
  latitude: z.string().or(z.number()),
  longitude: z.string().or(z.number()),
  locationName: z.string().min(3, "El nombre del lugar debe tener al menos 3 caracteres"),
  locationAddress: z.string().min(5, "La dirección debe tener al menos 5 caracteres"),
  paymentType: z.string().min(1, "Por favor, selecciona un tipo de pago"),
  price: z.string().optional(),
  maxCapacity: z.string().optional(),
  privacyType: z.string().min(1, "Por favor, selecciona un tipo de privacidad"),
  genderPreference: z.string().min(1, "Por favor, selecciona para quién es el evento"),
  // Nuevo campo para gestión multimedia unificada
  mediaItems: z.array(z.any()).optional().nullable(),
  // Mantener por compatibilidad con código existente (deprecated)
  eventPhoto: z.instanceof(File).optional().nullable(),
  eventVideo: z.instanceof(File).optional().nullable(),
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
};

type FormValues = z.infer<typeof createEventSchema> & {
  mediaItems: MediaItem[];
};

/**
 * Componente CreateEventForm - Formulario para crear nuevos eventos
 */
const CreateEventForm = ({ onClose, visible, initialLocation }: CreateEventFormProps) => {
  // Estados principales
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapLocation, setMapLocation] = useState<[number, number]>(
    initialLocation ? [initialLocation.longitude, initialLocation.latitude] : [-122.4194, 37.7749]
  );
  
  // Hooks y referencias
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [_, navigate] = useLocation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Inicializar formulario con valores iniciales
  const form = useForm<FormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      date: "",
      time: "",
      latitude: initialLocation ? String(initialLocation.latitude) : "",
      longitude: initialLocation ? String(initialLocation.longitude) : "",
      locationName: initialLocation?.locationName || "",
      locationAddress: initialLocation?.locationAddress || "",
      paymentType: "free",
      price: "",
      maxCapacity: "",
      privacyType: "public",
      genderPreference: "todas_las_personas",
      mediaItems: [],
      eventPhoto: null,
      eventVideo: null,
    },
  });

  // Determinar el paso inicial basado en la ubicación proporcionada
  useEffect(() => {
    setStep(initialLocation ? 2 : 1);
  }, [initialLocation]);

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
    
    // Avanzar al siguiente paso
    setStep(2);
  };

  // Enviar formulario al servidor
  const onSubmit = async (data: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Validar que mediaItems sea un array
      if (!Array.isArray(data.mediaItems)) {
        console.error("Error: mediaItems no es un array válido", data.mediaItems);
        data.mediaItems = [];
      }
      
      // Filtrar items inválidos o nulos
      const safeMediaItems = (data.mediaItems || []).filter(item => item && typeof item === 'object');
      
      // Log para depuración
      console.log("Procesando envío - Items multimedia:", safeMediaItems.length);
      
      // Preparar datos para la API
      const dateTime = new Date(`${data.date}T${data.time}`);
      
      // Log valores originales antes de procesamiento
      console.log("Valores originales del formulario:", {
        latitude: data.latitude,
        longitude: data.longitude,
        tipo_lat: typeof data.latitude,
        tipo_lng: typeof data.longitude,
        eventPhoto: data.eventPhoto,
        eventVideo: data.eventVideo,
        mediaItemsCount: safeMediaItems.length
      });
      
      // Crear FormData para enviar archivos
      const formData = new FormData();
      
      // Añadir datos básicos del evento
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('category', data.category);
      formData.append('date', dateTime.toISOString());
      formData.append('latitude', String(parseFloat(String(data.latitude))));
      formData.append('longitude', String(parseFloat(String(data.longitude))));
      formData.append('locationName', data.locationName);
      formData.append('locationAddress', data.locationAddress);
      formData.append('paymentType', "free"); // Siempre eventos gratuitos
      formData.append('price', "0"); // Sin precio
      
      if (data.maxCapacity) {
        formData.append('maxCapacity', String(parseInt(String(data.maxCapacity))));
      }
      
      formData.append('privacyType', data.privacyType);
      
      // Procesar elementos multimedia
      try {
        // Asegurar que mediaItems siempre es un array, incluso si está vacío
        if (!data.mediaItems) {
          data.mediaItems = [];
        }
        
        // Asegurar que tenemos un array incluso con elementos vacíos
        const mediaItems = Array.isArray(data.mediaItems) ? data.mediaItems : [];
        
        // Añadir todos los archivos nuevos
        mediaItems.forEach((item, index) => {
          // Verificación adicional para evitar problemas con elementos undefined
          if (!item) return;
          
          // Asegurarnos de que el tipo siempre esté definido
          if (!item.type) {
            console.warn(`Tipo no definido para el elemento multimedia ${index}, asignando 'photo' por defecto`);
            item.type = 'photo';
          }
          
          if (item.file) {
            const fieldName = `mediaFile_${index}`;
            formData.append(fieldName, item.file);
            
            // Si es el archivo principal, también enviarlo como el archivo principal
            if (item.isMain) {
              formData.append('mainMediaFile', item.file);
              formData.append('mainMediaType', item.type);
            }
          }
        });
        
        // Convertir los metadatos a JSON y enviarlos para todos los elementos (con o sin archivos)
        const mediaMetadata = mediaItems.map(item => ({
          type: item.type || 'photo',
          url: item.url || '',
          isMain: item.isMain || false,
          isNew: item.isNew || false,
          toDelete: item.toDelete || false
        }));
        
        // Asegurarnos de que siempre enviamos un array, aunque sea vacío
        formData.append('mediaItems', JSON.stringify(mediaMetadata.length > 0 ? mediaMetadata : []));
      } catch (error) {
        console.error("Error procesando elementos multimedia:", error);
        // Enviar un array vacío en caso de error para evitar fallos
        formData.append('mediaItems', '[]');
      }
      
      // Mantener compatibilidad con código existente
      if (data.eventPhoto) {
        formData.append('eventPhoto', data.eventPhoto);
      }
      
      if (data.eventVideo) {
        formData.append('eventVideo', data.eventVideo);
      }
      
      // Log de datos procesados
      console.log("Datos enviados al servidor (FormData creado)");
      
      // CAMBIO CRÍTICO: En lugar de usar FormData que está causando problemas,
      // usaremos un objeto JSON estándar para el cuerpo de la solicitud
      
      // Extraer datos de mediaItems del FormData y asegurarnos de que sea un JSON válido
      let mediaItemsJson = '[]';
      try {
        if (formData.get('mediaItems')) {
          mediaItemsJson = formData.get('mediaItems') as string;
          // Verificar que sea un JSON válido
          JSON.parse(mediaItemsJson);
        }
      } catch (e) {
        console.error("Error analizando mediaItems, usando array vacío:", e);
        mediaItemsJson = '[]';
      }
      
      // Crear objeto JSON para enviar al servidor
      const jsonData = {
        title: data.title,
        description: data.description,
        category: data.category,
        date: data.date,
        time: data.time, 
        locationName: data.locationName,
        locationAddress: data.locationAddress,
        latitude: data.latitude,
        longitude: data.longitude,
        privacyType: data.privacyType,
        genderPreference: data.genderPreference,
        paymentType: "free",
        mediaItems: mediaItemsJson
      };
      
      console.log("Datos JSON que se enviarán al servidor:", jsonData);
      
      // Enviar al servidor con Content-Type: application/json en lugar de FormData
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jsonData),
        credentials: 'include' // Necesario para enviar cookies (sesión)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Check if this is a user authentication error
        if (response.status === 401 || (errorData.code && errorData.code === 'USER_NOT_FOUND')) {
          toast({
            title: "Necesitas registrarte primero",
            description: "Debes crear una cuenta y acceder antes de poder crear eventos.",
            variant: "destructive",
          });
          // Redirect to auth page after a short delay
          setTimeout(() => {
            navigate("/auth");
          }, 2000);
          return;
        }
        
        throw new Error(errorData.message || "Error al crear el evento");
      }
      
      const createdEvent = await response.json();
      console.log("Evento creado:", createdEvent);
      
      toast({
        title: "¡Éxito!",
        description: "Tu evento ha sido creado correctamente",
      });
      
      // Resetear el formulario
      form.reset({
        title: "",
        description: "",
        category: "",
        date: "",
        time: "",
        latitude: "",
        longitude: "",
        locationName: "",
        locationAddress: "",
        paymentType: "free",
        price: "",
        maxCapacity: "",
        privacyType: "public",
        mediaItems: [],
        eventPhoto: null,
        eventVideo: null
      });
      
      // Cerrar formulario
      onClose();
      
      // Actualizar lista de eventos sin recargar la página
      // Usaremos react-query para invalidar la caché de eventos después de un breve retraso
      setTimeout(() => {
        // Importamos queryClient desde queryClient.ts
        import("@/lib/queryClient").then(({ queryClient }) => {
          queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        });
      }, 300);
    } catch (error: any) {
      console.error("Error creando evento:", error);
      toast({
        title: "Error al crear evento",
        description: error.message || "No se pudo crear el evento. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // No renderizar nada si no es visible
  if (!visible) return null;

  // COMPONENTE DE RENDERIZADO
  return (
    <div className="absolute inset-0 bg-white z-30">
      <div className="flex flex-col h-full">
        {/* Cabecera */}
        <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
          <button className="p-2" onClick={onClose}>
            <ArrowLeft size={24} />
          </button>
          <h2 className="font-semibold text-lg">Crear Evento</h2>
          <div className="w-10"></div>
        </div>
        
        {/* Formulario */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-auto">
            {/* PASO 1: Selección de ubicación */}
            {step === 1 && (
              <div className="flex-1 overflow-auto">
                <div className="p-4">
                  <h3 className="font-medium mb-2">Selecciona la Ubicación del Evento</h3>
                  <p className="text-neutral-500 mb-4">Toca el mapa para seleccionar dónde se realizará tu evento.</p>
                </div>
                
                {/* Mapa para selección de ubicación */}
                <div 
                  ref={mapContainerRef} 
                  className="h-96 bg-neutral-100 relative overflow-hidden"
                ></div>
                
                <div className="p-4">
                  <Button 
                    type="button"
                    className="w-full py-3 bg-primary text-white font-semibold rounded-xl mt-4"
                    onClick={validateAndContinue}
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            )}
            
            {/* PASO 2: Formulario de detalles del evento */}
            {step === 2 && (
              <div className="flex-1 overflow-auto">
                {/* Mapa pequeño con ubicación seleccionada */}
                <div 
                  ref={mapContainerRef} 
                  className="h-60 bg-neutral-100 relative overflow-hidden"
                ></div>
                
                <div className="p-4">
                  {/* Información de ubicación */}
                  <div className="mb-4 border border-neutral-200 p-3 rounded-xl bg-neutral-50">
                    <div className="flex items-center gap-2">
                      <MapIcon className="h-5 w-5 text-primary" />
                      <FormLabel className="font-medium">Ubicación</FormLabel>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium">{form.getValues("locationName") || "Ubicación seleccionada"}</p>
                      <p className="text-sm text-gray-600">{form.getValues("locationAddress") || "Dirección detectada del mapa"}</p>
                    </div>
                    
                    {/* Campos ocultos para datos de ubicación */}
                    <input type="hidden" {...form.register("locationAddress")} />
                    <input type="hidden" {...form.register("locationName")} />
                    <input type="hidden" {...form.register("latitude")} />
                    <input type="hidden" {...form.register("longitude")} />
                  </div>
                
                  {/* Título del evento */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Nombre del Evento</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Dale un nombre a tu evento"
                            className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Categoría del evento */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Categoría</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary">
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
                  
                  {/* Fecha y hora */}
                  <div className="mb-4">
                    <FormLabel>Fecha y Hora</FormLabel>
                    <div className="flex gap-2">
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                type="date"
                                className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
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
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                type="time"
                                className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  {/* Descripción */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Cuéntale a la gente sobre tu evento..."
                            className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary h-28"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Tipo de pago - Siempre establecido a "free" */}
                  <input type="hidden" {...form.register("paymentType")} value="free" />
                  
                  {/* Capacidad máxima */}
                  <FormField
                    control={form.control}
                    name="maxCapacity"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Capacidad Máxima (Opcional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min="1"
                            placeholder="Sin límite"
                            className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Tipo de privacidad */}
                  <FormField
                    control={form.control}
                    name="privacyType"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Privacidad</FormLabel>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            className={`flex-1 py-3 ${field.value === 'public' ? 'bg-primary text-white' : 'bg-white border border-neutral-300 text-neutral-700'} font-medium rounded-xl`}
                            onClick={() => form.setValue("privacyType", "public")}
                          >
                            Público
                          </Button>
                          <Button
                            type="button"
                            className={`flex-1 py-3 ${field.value === 'private' ? 'bg-primary text-white' : 'bg-white border border-neutral-300 text-neutral-700'} font-medium rounded-xl`}
                            onClick={() => form.setValue("privacyType", "private")}
                          >
                            Privado
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Preferencia de género */}
                  <FormField
                    control={form.control}
                    name="genderPreference"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>👥 Destinado Para</FormLabel>
                        <div className="text-sm text-gray-600 mb-2">Público destinatario del evento</div>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary">
                              <SelectValue placeholder="Selecciona para quién es el evento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GENDER_PREFERENCE_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Gestor de multimedia unificado */}
                  <FormField
                    control={form.control}
                    name="mediaItems"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <MediaManager
                            existingMedia={field.value || []}
                            onChange={(mediaItems) => {
                              // CAMBIO CRÍTICO: Asegurarnos que mediaItems es un array válido
                              if (!Array.isArray(mediaItems)) {
                                console.error("MediaManager devolvió un valor no válido:", mediaItems);
                                return;
                              }
                              
                              // SEGURIDAD: Hacer una copia limpia del array para evitar problemas de referencia
                              const safeMediaItems = [...mediaItems].filter(Boolean);
                              
                              // Actualizar campo del formulario
                              field.onChange(safeMediaItems);
                              
                              try {
                                // Procesar los elementos multimedia para compatibilidad con el código existente
                                const mainItem = safeMediaItems.find(item => item && item.isMain === true);
                                
                                console.log("=== PROCESANDO onChange EN MEDIA MANAGER ===");
                                console.log("¿Hay elemento principal explícito?", !!mainItem);
                                
                                if (mainItem) {
                                  console.log("ELEMENTO PRINCIPAL FINAL:", {
                                    tipo: mainItem.type || 'ninguno'
                                  });
                                  
                                  // Comprobación de seguridad para archivo
                                  const hasValidFile = mainItem.file && typeof mainItem.file === 'object';
                                  
                                  // Solo establecer archivo si existe y es válido
                                  if (hasValidFile) {
                                    if (mainItem.type === 'photo') {
                                      form.setValue('eventPhoto', mainItem.file);
                                  } else if (mainItem.type === 'video') {
                                    form.setValue('eventVideo', mainItem.file);
                                  }
                                }
                                
                                // En lugar de intentar cambiar mainMediaType directamente (que no está en el schema),
                                // actualizar una variable interna para usar más tarde durante el envío
                                console.log("Configurando campos legacy con archivo principal:", mainItem.type || 'photo', mainItem.file || null);
                              } else {
                                console.log("No hay elemento principal seleccionado entre", safeMediaItems.length, "elementos");
                              }
                              
                              console.log("=== FIN PROCESAMIENTO onChange ===");
                              } catch (error) {
                                console.error("Error al procesar los elementos multimedia:", error);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Botón de envío */}
                  <Button 
                    type="submit"
                    className="w-full py-3 bg-primary text-white font-semibold rounded-xl mt-4"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin mr-2 h-4 w-4 border-b-2 border-white rounded-full inline-block"></span>
                        Creando Evento...
                      </>
                    ) : (
                      "Crear Evento"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
};

export default CreateEventForm;