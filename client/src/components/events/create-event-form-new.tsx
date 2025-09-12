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
import { GoogleMap, Marker, useLoadScript, Libraries } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, reverseGeocode, defaultMapConfig } from "@/lib/google-maps";

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
  latitude: z.number().or(z.string().transform(val => parseFloat(val))),
  longitude: z.number().or(z.string().transform(val => parseFloat(val))),
  locationName: z.string().min(3, "El nombre del lugar debe tener al menos 3 caracteres"),
  locationAddress: z.string().min(5, "La dirección debe tener al menos 5 caracteres"),
  paymentType: z.string().min(1, "Por favor, selecciona un tipo de pago"),
  price: z.string().optional(),
  maxCapacity: z.string().optional(),
  privacyType: z.string().min(1, "Por favor, selecciona un tipo de privacidad"),
  genderPreference: z.string().min(1, "Por favor, selecciona para quién es el evento"),
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

type FormValues = z.infer<typeof createEventSchema>;

// Librerias de Google Maps
const libraries: Libraries = ["places"];

/**
 * Componente CreateEventForm - Formulario para crear nuevos eventos
 */
const CreateEventFormNew = ({ onClose, visible, initialLocation }: CreateEventFormProps) => {
  // Estados principales
  const [step, setStep] = useState<1 | 2>(initialLocation ? 2 : 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [center, setCenter] = useState({
    lat: initialLocation?.latitude || 19.4326, // Ciudad de México por defecto
    lng: initialLocation?.longitude || -99.1332
  });
  const [markerPosition, setMarkerPosition] = useState({
    lat: initialLocation?.latitude || 19.4326,
    lng: initialLocation?.longitude || -99.1332
  });
  
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
  
  // Inicializar formulario con valores iniciales
  const form = useForm<FormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      date: "",
      time: "",
      latitude: initialLocation ? initialLocation.latitude : 0,
      longitude: initialLocation ? initialLocation.longitude : 0,
      locationName: initialLocation?.locationName || "",
      locationAddress: initialLocation?.locationAddress || "",
      paymentType: "free",
      price: "",
      maxCapacity: "",
      privacyType: "public",
      genderPreference: "todas_las_personas",
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
      
      // Guardar con máxima precisión como números
      form.setValue("latitude", lat);
      form.setValue("longitude", lng);
      
      // Obtener dirección
      reverseGeocode(lng, lat).then(address => {
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
    
    // Avanzar al siguiente paso
    setStep(2);
  };

  // Enviar formulario al servidor
  const onSubmit = async (data: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Preparar datos para la API
      const dateTime = new Date(`${data.date}T${data.time}`);
      
      // Log valores originales antes de procesamiento
      console.log("Valores originales del formulario:", {
        latitude: data.latitude,
        longitude: data.longitude,
        tipo_lat: typeof data.latitude,
        tipo_lng: typeof data.longitude
      });
      
      const eventData = {
        title: data.title,
        description: data.description,
        category: data.category,
        date: dateTime.toISOString(),
        latitude: typeof data.latitude === 'number' ? data.latitude : parseFloat(String(data.latitude)),
        longitude: typeof data.longitude === 'number' ? data.longitude : parseFloat(String(data.longitude)), 
        locationName: data.locationName,
        locationAddress: data.locationAddress,
        paymentType: "free", // Siempre eventos gratuitos
        price: 0, // Sin precio
        maxCapacity: data.maxCapacity ? parseInt(String(data.maxCapacity)) : null,
        privacyType: data.privacyType,
        genderPreference: data.genderPreference,
      };
      
      // Log de datos procesados
      console.log("Datos enviados al servidor:", eventData);
      
      // Enviar al servidor
      const response = await apiRequest("POST", "/api/events", eventData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al crear el evento");
      }
      
      const createdEvent = await response.json();
      console.log("Evento creado:", createdEvent);
      
      toast({
        title: "¡Éxito!",
        description: "Tu evento ha sido creado correctamente",
      });
      
      // Cerrar formulario y actualizar vista
      onClose();
      setTimeout(() => window.location.reload(), 800);
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

  // Renderizado condicional si Google Maps no ha cargado
  if (!isLoaded) {
    return (
      <div className="absolute inset-0 bg-white z-30 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p>Cargando mapa...</p>
        </div>
      </div>
    );
  }

  // Error al cargar Google Maps
  if (loadError) {
    return (
      <div className="absolute inset-0 bg-white z-30 flex items-center justify-center p-4">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg max-w-md">
          <h3 className="font-bold mb-2">Error al cargar el mapa</h3>
          <p>No se pudo cargar Google Maps. Por favor intenta recargar la página.</p>
          <button 
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

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
                <div className="h-96 bg-neutral-100 relative overflow-hidden">
                  <GoogleMap
                    mapContainerStyle={{ height: '100%', width: '100%' }}
                    center={center}
                    zoom={11}
                    onClick={handleMapClick}
                    onLoad={onMapLoad}
                    options={{
                      disableDefaultUI: false,
                      zoomControl: true,
                      mapTypeControl: false,
                      streetViewControl: false,
                      fullscreenControl: true,
                    }}
                  >
                    {/* Marcador en la ubicación seleccionada */}
                    {markerPosition.lat && markerPosition.lng && (
                      <Marker 
                        position={markerPosition}
                        draggable={true}
                        onDragEnd={(e) => {
                          if (e.latLng) {
                            handleMapClick(e as google.maps.MapMouseEvent);
                          }
                        }}
                      />
                    )}
                  </GoogleMap>
                </div>
                
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
                <div className="h-60 bg-neutral-100 relative overflow-hidden">
                  <GoogleMap
                    mapContainerStyle={{ height: '100%', width: '100%' }}
                    center={{
                      lat: parseFloat(String(form.getValues("latitude"))),
                      lng: parseFloat(String(form.getValues("longitude")))
                    }}
                    zoom={14}
                    options={{
                      disableDefaultUI: true,
                      zoomControl: true,
                    }}
                  >
                    <Marker 
                      position={{
                        lat: parseFloat(String(form.getValues("latitude"))),
                        lng: parseFloat(String(form.getValues("longitude")))
                      }}
                    />
                  </GoogleMap>
                </div>
                
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
                        <FormLabel>🔒 Privacidad del evento</FormLabel>
                        <div className="text-sm text-gray-600 mb-2">Tipo de evento</div>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary">
                              <SelectValue placeholder="Selecciona el tipo de evento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="public">🌍 Público (visible para todos)</SelectItem>
                            <SelectItem value="private">🔒 Privado (solo invitados)</SelectItem>
                          </SelectContent>
                        </Select>
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
                  
                  {/* Botones de acción */}
                  <div className="flex gap-2 mb-20">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 py-3"
                      onClick={() => setStep(1)}
                    >
                      Atrás
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 py-3 bg-primary text-white"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Creando...' : 'Crear Evento'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
};

export default CreateEventFormNew;