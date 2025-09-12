import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import MapView from "@/components/maps/map-view";
import EventDetailSheet from "@/components/events/event-detail-sheet";
import CreateEventSheet from "@/components/events/create-event-sheet";
import BottomNav from "@/components/layout/bottom-nav";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapProvider, useMap } from "@/contexts/MapContext";
import { queryClient } from "@/lib/queryClient";
import { useNavigation } from "@/contexts/navigation-context";

// Define types for the events
type Event = {
  id: number;
  title: string;
  description: string;
  category: string;
  date: string;
  latitude: string | number;
  longitude: string | number;
  locationName: string;
  locationAddress: string;
  paymentType: string;
  price?: string | number;
  maxCapacity?: number;
  privacyType: string;
  organizerId: number;
  organizer: {
    id: number;
    name: string;
    avatar?: string;
  };
  attendees: Array<{
    id: number;
    user: {
      id: number;
      name: string;
      avatar?: string;
    };
  }>;
};

const HomeContent = () => {
  const { restoreCameraState } = useMap();
  // State for UI components
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);
  const [createEventVisible, setCreateEventVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [isFocusedMode, setIsFocusedMode] = useState(false);
  
  // Referencia para controlar el componente de creación de eventos
  const createEventKey = useRef<number>(0);
  
  const { user, isLoading } = useAuth();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const { showNavigation } = useNavigation();

  // Handle event selection
  const handleEventSelect = (event: any) => {
    try {
      console.log("🎯 Home: Evento seleccionado:", event);
      
      // Asegurarse de que latitude y longitude sean números y date sea string
      const formattedEvent = {
        ...event,
        latitude: typeof event.latitude === 'string' ? parseFloat(event.latitude) : (event.latitude || 0),
        longitude: typeof event.longitude === 'string' ? parseFloat(event.longitude) : (event.longitude || 0),
        date: event.date instanceof Date ? event.date.toISOString() : event.date
      };
      
      // Primero establecer el evento y luego mostrar el panel de detalles
      setSelectedEvent(formattedEvent);
      console.log("🎯 Home: Setting detailSheetVisible to true");
      setDetailSheetVisible(true);
      console.log("🎯 Home: detailSheetVisible set to true");
    } catch (error) {
      console.error("Error al seleccionar evento:", error);
      toast({
        title: "Error",
        description: "No se pudo abrir los detalles del evento",
        variant: "destructive"
      });
    }
  };

  // Estado para la ubicación seleccionada para el evento
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    locationName: string;
    locationAddress: string;
  } | null>(null);
  
  // Estado para controlar la limpieza de marcadores al cerrar el formulario
  const [resetMapMarkers, setResetMapMarkers] = useState(false);
  
  // Usar React Query para obtener y mantener actualizados los eventos
  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useQuery({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const response = await fetch('/api/events', {
        credentials: 'include',
        // Añadir un parámetro para evitar caché
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error('Error al cargar eventos');
      }
      return response.json();
    },
    // Configuración optimizada para evitar flickering durante eliminaciones
    refetchInterval: 30000, // Actualizar cada 30 segundos para evitar interrupciones constantes
    refetchOnWindowFocus: true, // Actualizar cuando la ventana recupera el foco
    staleTime: 5000, // Balance entre actualizaciones rápidas y estabilidad visual
    refetchOnMount: true, // Siempre refrescar al montar el componente
    refetchIntervalInBackground: false, // No actualizar en segundo plano para evitar flickering
  });

  // Handle create event button click - protegido contra undefined
  const handleCreateEventClick = (locationData?: {
    latitude: number;
    longitude: number; 
    locationAddress: string;
    locationName: string;
  }) => {
    try {
      // Verificar autenticación primero
      if (!user && !isLoading) {
        toast({
          title: "Autenticación Requerida",
          description: "Por favor, inicia sesión para crear eventos",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }
      
      // Si recibimos datos de ubicación, guardamos y abrimos el formulario
      if (locationData) {
        // Verificar si alguno de los campos críticos es undefined antes de procesar
        if (locationData.latitude === undefined || locationData.longitude === undefined) {
          console.error("Error: Datos de ubicación incompletos", locationData);
          toast({
            title: "Error al procesar ubicación",
            description: "No se pudo obtener información completa de la ubicación. Por favor, intenta seleccionar otra ubicación.",
            variant: "destructive"
          });
          return;
        }
        
        // Log para depuración
        console.log("Recibiendo datos de ubicación en Home:", locationData);
        
        // Asegurarse que la latitud y longitud sean números y proporcionar valores por defecto para todo
        const formattedLocation = {
          latitude: typeof locationData.latitude === 'string' 
            ? parseFloat(locationData.latitude) 
            : (locationData.latitude || 0),
          longitude: typeof locationData.longitude === 'string' 
            ? parseFloat(locationData.longitude) 
            : (locationData.longitude || 0),
          locationName: locationData.locationName || "Ubicación sin nombre",
          locationAddress: locationData.locationAddress || "Dirección desconocida"
        };
        
        // Si el formulario ya está abierto, forzar una recreación completa
        if (createEventVisible) {
          // Cerrar formulario actual
          setCreateEventVisible(false);
          
          // Incrementar clave para forzar recreación del componente
          createEventKey.current += 1;
          console.log("Recreando formulario con nueva clave:", createEventKey.current);
          
          // Breve retardo para asegurar que se desmonta completamente
          setTimeout(() => {
            // Establecer nueva ubicación y abrir nuevo formulario
            setSelectedLocation(formattedLocation);
            setCreateEventVisible(true);
          }, 100);
        } else {
          // Comportamiento para primera apertura
          setSelectedLocation(formattedLocation);
          setCreateEventVisible(true);
        }
        
        // Mostrar toast con configuración para evitar interferencia con los clics
        toast({
          title: "Ubicación seleccionada",
          description: "Ahora completa los detalles del evento",
          duration: 3000, // 3 segundos es suficiente
          className: "event-toast", // Clase especial para estilizar 
        });
      } else {
        // Incrementar clave para asegurar componente limpio
        createEventKey.current += 1;
        console.log("Abriendo formulario sin ubicación, clave:", createEventKey.current);
        
        // Si no hay datos, abrimos formulario limpio
        setSelectedLocation(null);
        setCreateEventVisible(true);
        
        toast({
          title: "Crear evento",
          description: "Puedes seleccionar la ubicación después",
        });
      }
    } catch (error) {
      console.error("Error al procesar la creación del evento:", error);
      toast({
        title: "Error al iniciar la creación del evento",
        description: "Hubo un problema al procesar los datos. Por favor, intenta nuevamente con otra ubicación.",
        variant: "destructive"
      });
    }
  };

  // Handle apply filters
  const handleApplyFilters = (filters: any) => {
    setActiveFilters(filters);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative h-screen flex flex-col"
    >
      {/* Map View */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="flex-1 relative"
      >
        <AnimatePresence>
          {eventsLoading ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10"
            >
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-center"
              >
                <motion.div 
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.1, 1] 
                  }}
                  transition={{ 
                    rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                    scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="h-8 w-8 mx-auto mb-2 rounded-full bg-primary/30"
                />
                <p className="text-sm text-neutral-600">Cargando eventos...</p>
              </motion.div>
            </motion.div>
          ) : eventsError ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10"
            >
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                whileHover={{ scale: 1.02 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-center text-red-500 p-4 rounded-lg bg-red-50"
              >
                <p>Error al cargar eventos</p>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-2 text-xs underline text-red-600"
                  onClick={() => queryClient.invalidateQueries({queryKey: ['/api/events']})}
                >
                  Intentar de nuevo
                </motion.button>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        
        <MapView 
          onEventSelect={handleEventSelect}
          onCreateEventClick={handleCreateEventClick}
          filters={activeFilters}
          resetLocationOnFormClose={resetMapMarkers}
          events={events}
          isFocusedMode={isFocusedMode}
          setIsFocusedMode={setIsFocusedMode}
        />
      </motion.div>
      
      {/* Event Detail Sheet - Always rendered but controlled by visible prop */}
      <EventDetailSheet 
        event={selectedEvent}
        onClose={() => {
          console.log("🎯 Home: Closing event detail sheet - START");
          console.log("🎯 Home: Current detailSheetVisible:", detailSheetVisible);
          console.log("🎯 Home: Current selectedEvent:", selectedEvent ? selectedEvent.title : "null");
          
          // Restaurar la posición de la cámara guardada usando el contexto
          restoreCameraState();
          
          setDetailSheetVisible(false);
          setSelectedEvent(null); // Clear immediately for instant closure
          setIsFocusedMode(false); // Salir del modo focalizado al cerrar el panel
          console.log("🎯 Home: Closing event detail sheet - DONE");
        }}
        onEventUpdated={() => {
          console.log("🔒 Event updated/deleted, closing detail panel immediately");
          // Restaurar la posición de la cámara antes de cerrar el panel
          restoreCameraState();
          setDetailSheetVisible(false);
          setSelectedEvent(null);
        }}
        visible={detailSheetVisible && selectedEvent !== null}
      />
      

      
      {/* Create Event Sheet */}
      <CreateEventSheet 
        isOpen={createEventVisible}
        onClose={() => {
          console.log("Cerrando formulario de evento desde Home");
          
          // Primero ocultamos el formulario
          setCreateEventVisible(false);
          
          // Incrementamos la clave para forzar una recreación completa del componente
          // en la próxima vez que se muestre
          createEventKey.current += 1;
          
          // Limpieza segura de la ubicación seleccionada
          setSelectedLocation(null);
          
          // Activar la limpieza de marcadores en el mapa
          setResetMapMarkers(prev => !prev); // Toggle para forzar el cambio en la dependencia del useEffect
          
          console.log("Ubicación seleccionada limpiada, clave incrementada a:", createEventKey.current);
        }}
        initialLocation={selectedLocation}
        onEventCreated={() => {
          console.log("Evento creado - refrescando eventos...");
          refetchEvents();
        }}
      />
      
      {/* Bottom Navigation */}
      <BottomNav />
    </motion.div>
  );
};

const Home = () => {
  return (
    <MapProvider>
      <HomeContent />
    </MapProvider>
  );
};

export default Home;
