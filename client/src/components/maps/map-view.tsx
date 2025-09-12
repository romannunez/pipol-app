import React, { useState, useEffect, useRef } from "react";
import SearchBar from "@/components/search/search-bar";
import GooglePlacesSearch from "@/components/search/google-places-search";
import EventFilters from "@/components/events/event-filters";
import {
  Circle,
  MapPin,
  MapIcon,
  PinIcon,
  Plus,
  Pin,
  MapPinned,
  Check,
  X,
  Compass,
  Filter,
  Layers,
  Settings,
  Globe,
  Building2,
  Satellite,
  Map as MapIcon2,
  Bell,
  Layers3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useEvents } from "@/hooks/use-events";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMap } from "@/contexts/MapContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { apiRequest } from "@/lib/queryClient";
import NotificationsPanel from "@/components/notifications/notifications-panel";

import EventPin from "./event-pin";
import MapConfigPanel from "./map-config-panel";
import EventDetailSheet from "@/components/events/event-detail-sheet";
import EditEventSheet from "@/components/events/edit-event-sheet";
import mapboxgl from "mapbox-gl";
import {
  initializeMap,
  getUserLocation,
  defaultMapConfig,
  searchLocations,
  reverseGeocode,
  enable3DMap,
  enable2DMap,
  MapStyle,
  getLightPresetByTime,
  enableSatelliteMap,
  applyMapConfig,
  MapConfigOptions,
  LightPreset,
  MapTheme,
  MapFont,
} from "@/lib/mapbox";
// Para debugging - importar también funciones de google
import {
  reverseGeocode as googleReverseGeocode,
  findNearbyPlaces,
} from "@/lib/google-maps";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
// Removed 3D marker manager import - only using 2D markers

// Import new 3D Snap Map components
import PipolMap from "./PipolMap";
import { adaptEventsForMap3D } from "@/lib/eventsAdapter";

// Helper function for category emojis
const getCategoryEmoji = (category: string): string => {
  const categoryEmojis: Record<string, string> = {
    social: "👥",
    music: "🎵",
    spiritual: "🙏",
    education: "📚",
    sports: "⚽",
    food: "🍽️",
    art: "🎨",
    technology: "💻",
    games: "🎮",
    outdoor: "🌲",
    networking: "🤝",
    workshop: "🔧",
    conference: "📋",
    party: "🎉",
    fair: "🎪",
    exhibition: "🖼️",
  };
  return categoryEmojis[category] || "📅";
};

// Import Event type from shared schema
import { events, Event as SchemaEvent } from "../../../../shared/schema";

// Create a more flexible Event type that matches the API response
type BaseEvent = {
  id: number;
  title: string;
  description: string;
  category: string;
  date: Date | string;
  latitude: string | number;
  longitude: string | number;
  locationName: string;
  locationAddress: string;
  paymentType: string;
  price?: number | null;
  maxCapacity?: number | null;
  privacyType: string;
  mediaItems?: string | null;
  mainMediaType?: string | null;
  mainMediaUrl?: string | null;
  main_media_url?: string | null;
  organizerId: number;
  gender_preference?: string | null; // Agregado para el filtro de género
  genderPreference?: string | null; // Formato camelCase alternativo
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

// Extended Event type with populated relations for the map view
type EventWithRelations = BaseEvent & {
  organizer?: {
    id: number;
    name: string;
    avatar?: string;
  };
  attendees?: Array<{
    id: number;
    user: {
      id: number;
      name: string;
      avatar?: string;
    };
  }>;
};

type MapViewProps = {
  onEventSelect: (event: EventWithRelations) => void;
  onCreateEventClick: (locationData?: {
    latitude: number;
    longitude: number;
    locationAddress: string;
    locationName: string;
  }) => void;
  filters?: {
    category?: string[];
    paymentType?: string[];
    date?: string;
    distance?: number;
  };
  events?: EventWithRelations[]; // Eventos pasados desde el componente padre
  resetLocationOnFormClose?: boolean; // Flag para controlar restablecimiento de marcadores
  isFocusedMode?: boolean; // Estado del modo focalizado controlado por el padre
  setIsFocusedMode?: (focused: boolean) => void; // Función para controlar el modo focalizado
  overlaysHidden?: boolean; // Ocultar overlays cuando el panel de detalles está abierto
};

const MapView = ({
  onEventSelect,
  onCreateEventClick,
  filters,
  events: propsEvents,
  resetLocationOnFormClose,
  isFocusedMode = false, // Default a false si no se provee
  setIsFocusedMode = () => {}, // Default a función vacía si no se provee
  overlaysHidden = false, // Default a false si no se provee
}: MapViewProps) => {
  const { user } = useAuth(); // Obtener el usuario actual
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationMode, setLocationMode] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editSheetVisible, setEditSheetVisible] = useState(false);

  // Configurar ID del usuario actual como variable global para los marcadores
  useEffect(() => {
    if (user && user.id) {
      // @ts-ignore - Definimos la propiedad global para el ID del usuario
      window._currentUserId = user.id;
    }
  }, [user]);
  const [eventsPanelVisible, setEventsPanelVisible] = useState(false);
  const [tempLocationMarker, setTempLocationMarker] =
    useState<mapboxgl.Marker | null>(null);
  const [tempLocationData, setTempLocationData] = useState<{
    latitude: number;
    longitude: number;
    locationAddress: string;
    locationName: string;
  } | null>(null);

  // Estado para mostrar botones de acción en ubicación actual
  const [showActionsForLocation, setShowActionsForLocation] = useState(false);

  // Estado para guardar las coordenadas y datos de la ubicación actual del mapa
  const [currentLocation, setCurrentLocation] = useState<{
    lng: number;
    lat: number;
    locationName?: string;
    locationAddress?: string;
  } | null>(null);

  // Estado para indicar si estamos detectando la ubicación
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Function to get user's current location for distance filtering
  const detectUserLocation = async () => {
    if (isDetectingLocation) return currentLocation; // Evitar múltiples detecciones simultáneas
    
    setIsDetectingLocation(true);
    console.log("🌍 Detectando ubicación del usuario...");
    
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            reject, 
            { 
              enableHighAccuracy: true, 
              timeout: 10000, 
              maximumAge: 300000 // Cache for 5 minutes
            }
          );
        });

        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          locationName: "Tu ubicación actual",
          locationAddress: "Ubicación detectada automáticamente"
        };

        setCurrentLocation(userLocation);
        console.log("🌍 Ubicación detectada exitosamente:", userLocation);
        
        // Center map on user location if map is available
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [userLocation.lng, userLocation.lat],
            zoom: 14,
            duration: 1500
          });
        }

        setIsDetectingLocation(false);
        return userLocation;
      } catch (error) {
        console.warn("🌍 Could not detect user location:", error);
        
        // Fallback to default location (Córdoba, Argentina)
        const fallbackLocation = {
          lat: -31.4201,
          lng: -64.1888,
          locationName: "Córdoba, Argentina",
          locationAddress: "Ubicación por defecto"
        };
        
        setCurrentLocation(fallbackLocation);
        console.log("🌍 Usando ubicación por defecto:", fallbackLocation);
        setIsDetectingLocation(false);
        return fallbackLocation;
      }
    } else {
      console.warn("🌍 Geolocation is not supported by this browser");
      setIsDetectingLocation(false);
      return null;
    }
  };

  // Función para calcular la distancia entre dos puntos de coordenadas en km (fórmula de Haversine)
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distancia en km
    return distance;
  };

  // Estado para guardar eventos filtrados por una ubicación específica
  const [locationFilteredEvents, setLocationFilteredEvents] = useState<
    EventWithRelations[]
  >([]);

  // Estados para los filtros del panel de eventos
  const [selectedGender, setSelectedGender] = useState<string>("todos");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDistance, setSelectedDistance] = useState<number>(100); // Default to 100km for "all" events
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("all");

  // Usar los eventos proporcionados como props, o usar el hook useEvents para actualizaciones en tiempo real
  const { events: eventsFromHook, isLoading, error } = useEvents();

  // Usar eventos de props si existen, o los obtenidos del hook
  const events: EventWithRelations[] = (propsEvents || eventsFromHook || []) as EventWithRelations[];

  // Función para aplicar todos los filtros a una lista de eventos
  const applyEventFilters = (eventsToFilter: EventWithRelations[], referenceLocation?: { lat: number; lng: number }) => {
    return eventsToFilter.filter((event: EventWithRelations) => {
      // Filtro por categoría
      if (selectedCategory !== "all" && event.category !== selectedCategory) {
        return false;
      }

      // Filtro por distancia (solo si hay ubicación de referencia)
      if (referenceLocation) {
        const eventLat = typeof event.latitude === "string" ? parseFloat(event.latitude) : event.latitude;
        const eventLng = typeof event.longitude === "string" ? parseFloat(event.longitude) : event.longitude;
        
        if (!isNaN(eventLat) && !isNaN(eventLng)) {
          const distance = calculateDistance(referenceLocation.lat, referenceLocation.lng, eventLat, eventLng);
          if (distance > selectedDistance) {
            return false;
          }
        }
      }

      // Filtro por fecha
      if (selectedDateFilter !== "all") {
        const eventDate = new Date(event.date);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        switch (selectedDateFilter) {
          case "today":
            if (eventDate < today || eventDate >= tomorrow) return false;
            break;
          case "tomorrow":
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
            if (eventDate < tomorrow || eventDate >= dayAfterTomorrow) return false;
            break;
          case "weekend":
            const dayOfWeek = eventDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) return false; // 0 = Sunday, 6 = Saturday
            break;
          case "week":
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() + 7);
            if (eventDate < today || eventDate >= weekEnd) return false;
            break;
          case "month":
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            if (eventDate < today || eventDate >= monthEnd) return false;
            break;
          case "next_months":
            const nextMonthsEnd = new Date(today);
            nextMonthsEnd.setMonth(nextMonthsEnd.getMonth() + 3); // Next 3 months
            if (eventDate < today || eventDate >= nextMonthsEnd) return false;
            break;
        }
      }

      // Por ahora, el filtro de género solo devuelve true (requiere datos adicionales en la base de datos)
      // En el futuro, aquí se podría filtrar por el género del organizador o tipo de evento
      
      return true;
    });
  };

  // Efecto para detectar ubicación automáticamente al cargar la aplicación
  useEffect(() => {
    const autoDetectLocation = async () => {
      if (!currentLocation && !isDetectingLocation) {
        console.log("🌍 Iniciando detección automática de ubicación...");
        try {
          await detectUserLocation();
        } catch (error) {
          console.warn("🌍 Error en detección automática:", error);
        }
      }
    };

    // Ejecutar con un pequeño delay para permitir que la UI cargue primero
    const timer = setTimeout(autoDetectLocation, 1000);
    return () => clearTimeout(timer);
  }, []); // Solo ejecutar una vez al montar el componente

  // Efecto para aplicar filtros automáticamente cuando cambien
  useEffect(() => {
    if (currentLocation && events && events.length > 0) {
      // Buscar eventos que coincidan con la ubicación actual (incluyendo por nombre o cercanía)
      let baseEvents = events.filter((event: EventWithRelations) => {
        if (currentLocation.locationName) {
          const placeName = currentLocation.locationName.toLowerCase();
          const nameMatch =
            event.title.toLowerCase().includes(placeName) ||
            (event.description && event.description.toLowerCase().includes(placeName)) ||
            (event.locationName && event.locationName.toLowerCase().includes(placeName));

          const eventLat = typeof event.latitude === "string" ? parseFloat(event.latitude) : event.latitude;
          const eventLng = typeof event.longitude === "string" ? parseFloat(event.longitude) : event.longitude;
          let distanceMatch = false;

          if (!isNaN(eventLat) && !isNaN(eventLng)) {
            const distance = calculateDistance(currentLocation.lat, currentLocation.lng, eventLat, eventLng);
            distanceMatch = distance <= selectedDistance;
          }

          return nameMatch || distanceMatch;
        }
        return false;
      });

      // Aplicar filtros adicionales
      const filteredEvents = applyEventFilters(baseEvents, currentLocation);
      setLocationFilteredEvents(filteredEvents);
    }
  }, [selectedGender, selectedCategory, selectedDistance, selectedDateFilter, currentLocation, events]);

  // Map mode state (2D or 3D)
  const [is3DMode, setIs3DMode] = useState(true);

  // Snap Map 3D mode (new 3D style)
  const [isSnapMap3D, setIsSnapMap3D] = useState(false);

  // Map style state (satellite or standard)
  const [isSatelliteMode, setIsSatelliteMode] = useState(false);

  // Estado para controlar si mostrar etiquetas basado en zoom - INICIALIZADO CORRECTAMENTE
  const [showEventLabels, setShowEventLabels] = useState(false);

  // Controlador de estado persistente del mapa - guarda el estado actual del mapa
  // para garantizar la persistencia entre cambios de modo
  const mapStateRef = useRef({
    style: "standard", // 'standard', 'satellite', 'dark'
    is3D: true,
    currentZoom: 13,
    currentCenter: { lng: -64.185, lat: -31.428 }, // Centrado en Córdoba, Argentina
    currentBearing: 0,
    currentPitch: 45,
  });

  // Map configuration panel visibility
  const [configPanelVisible, setConfigPanelVisible] = useState(false);

  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Map configuration state
  const [mapConfig, setMapConfig] = useState<MapConfigOptions>({
    showPlaceLabels: true,
    showRoadLabels: true,
    showPointOfInterestLabels: true,
    showTransitLabels: true,
    show3dObjects: true,
    theme: "default" as unknown as MapTheme,
    lightPreset: "day" as LightPreset,
    font: "default" as unknown as MapFont,
    useAutoLightPreset: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setMapInstance, saveCameraState, clearMapInstance } = useMap();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);


  // Function to handle event selection from 3D Snap Map
  const handleEventSelect = (eventId: string, coordinates?: [number, number]) => {
    const event = mapEvents.find(e => e.id.toString() === eventId);
    if (event) {
      // Always activate focused mode when event is selected
      setIsFocusedMode(true);
      
      // Format event data like in the existing click handlers
      const formattedEvent = {
        ...event,
        latitude: typeof event.latitude === "string" ? parseFloat(event.latitude) : event.latitude,
        longitude: typeof event.longitude === "string" ? parseFloat(event.longitude) : event.longitude,
      };
      onEventSelect(formattedEvent);
    }
  };
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);
  // Removed 3D marker manager ref - only using 2D markers

  // Se eliminó el estado para el panel de detalles del evento que ya no se usa

  // Escuchar eventos personalizados showEventDetails y editEventFromMap
  useEffect(() => {
    // Función que maneja el evento showEventDetails (para ver detalles)
    const handleShowEventDetails = (e: any) => {
      // Acceder de forma segura al eventId desde el detalle del evento
      const eventId = e?.detail?.eventId;
      console.log(
        "Evento personalizado recibido: showEventDetails para el evento ID:",
        eventId,
      );

      if (eventId) {
        // Encontrar el evento por su ID
        const eventToShow = events.find((event) => event.id === eventId);
        if (eventToShow) {
          // Activate focused mode when event is selected
          setIsFocusedMode(true);
          // Solo pasar el evento al callback onEventSelect para que se muestre en la vista
          onEventSelect(eventToShow);
        } else {
          console.error("No se encontró el evento con ID:", eventId);
        }
      }
    };

    // Función que maneja el evento editEventFromMap (para editar evento desde el mapa)
    const handleEditEventFromMap = (e: any) => {
      // Acceder de forma segura al eventId desde el detalle del evento
      const eventId = e?.detail?.eventId;
      console.log(
        "Evento personalizado recibido: editEventFromMap para el evento ID:",
        eventId,
      );

      if (eventId) {
        // Encontrar el evento por su ID
        const eventToEdit = events.find((event) => event.id === eventId);
        if (eventToEdit) {
          // Abrir el panel de edición
          setEditingEventId(eventId);
          setEditSheetVisible(true);
        } else {
          console.error("No se encontró el evento con ID:", eventId);
        }
      }
    };

    // Función para manejar actualizaciones de eventos
    const handleEventUpdated = (e: any) => {
      const eventData = e?.detail?.data;
      const eventId = e?.detail?.eventId;

      if (eventId && eventData) {
        console.log("Evento actualizado detectado en MapView:", eventId);

        // Forzar una actualización completa de los marcadores
        if (mapRef.current) {
          // Remover todos los marcadores actuales
          markersRef.current.forEach((marker) => marker.remove());
          popupsRef.current.forEach((popup) => popup.remove());
          markersRef.current = [];
          popupsRef.current = [];

          // Removed 3D marker cleanup - only using 2D markers

          // Re-crear los marcadores con los datos actualizados
          setTimeout(() => {
            // Volver a cargar los marcadores para todos los eventos filtrados
            console.log(
              "Actualizando marcadores con datos nuevos para los eventos",
            );

            // Invalidar la consulta de eventos para forzar una recarga de datos
            queryClient.invalidateQueries({ queryKey: ["/api/events"] });
            console.log(
              "Marcadores actualizados después de la edición del evento:",
              eventId,
            );
          }, 100);
        }
      }
    };

    // Agregar event listeners para nuestros eventos personalizados
    document.addEventListener("showEventDetails", handleShowEventDetails);
    document.addEventListener("editEventFromMap", handleEditEventFromMap);
    window.addEventListener("event-updated", handleEventUpdated);

    // Cleanup: eliminar los event listeners cuando el componente se desmonte
    return () => {
      document.removeEventListener("showEventDetails", handleShowEventDetails);
      document.removeEventListener("editEventFromMap", handleEditEventFromMap);
      window.removeEventListener("event-updated", handleEventUpdated);
    };
  }, [events, onEventSelect]);

  // Fetch notification count periodically
  useEffect(() => {
    if (user) {
      const fetchNotificationCount = async () => {
        try {
          const response = await apiRequest("GET", "/api/notifications/count");
          if (response.ok) {
            const data = await response.json();
            setNotificationCount(data.count || 0);
          }
        } catch (error) {
          console.error("Error fetching notification count:", error);
        }
      };

      fetchNotificationCount();
      
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotificationCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // IMPORTANT: NO filtering for the main map view
  // The main map should always show ALL events
  const mapEvents = events; // All events for the map
  
  // Separate filtering logic ONLY for the "Descubrir eventos" panel
  const getFilteredEventsForPanel = () => {
    return events.filter((event: EventWithRelations) => {
      // Search filter (only applied in panel)
      if (
        searchTerm &&
        !event.title.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Category filter from modal (only applied in panel)
      if (selectedCategory !== "all" && event.category !== selectedCategory) {
        return false;
      }

      // Distance filter (only applied in panel)
      // Only apply distance filter if user has selected a distance < 100km and we have location
      if (selectedDistance < 100 && currentLocation) {
        const eventLat = typeof event.latitude === "string" ? parseFloat(event.latitude) : event.latitude;
        const eventLng = typeof event.longitude === "string" ? parseFloat(event.longitude) : event.longitude;
        
        // Validate coordinates are valid numbers
        if (!isNaN(eventLat) && !isNaN(eventLng) && 
            isFinite(eventLat) && isFinite(eventLng) &&
            isFinite(currentLocation.lat) && isFinite(currentLocation.lng)) {
          
          const distance = calculateDistance(currentLocation.lat, currentLocation.lng, eventLat, eventLng);
          
          // Debug log for distance filtering (only in development)
          if (process.env.NODE_ENV === 'development') {
            console.log(`🎯 Distance filter: Event "${event.title}" is ${distance.toFixed(2)}km away (limit: ${selectedDistance}km)`);
          }
          
          if (distance > selectedDistance) {
            return false;
          }
        } else {
          // If coordinates are invalid, log a warning but don't filter out the event
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ Invalid coordinates for event "${event.title}": Event(${eventLat}, ${eventLng}), User(${currentLocation.lat}, ${currentLocation.lng})`);
          }
        }
      }

      // Date filter from modal (only applied in panel)
      if (selectedDateFilter !== "all") {
        const eventDate = new Date(event.date);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        switch (selectedDateFilter) {
          case "today":
            if (eventDate < today || eventDate >= tomorrow) return false;
            break;
          case "tomorrow":
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
            if (eventDate < tomorrow || eventDate >= dayAfterTomorrow) return false;
            break;
          case "weekend":
            const dayOfWeek = eventDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) return false; // 0 = Sunday, 6 = Saturday
            break;
          case "week":
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() + 7);
            if (eventDate < today || eventDate >= weekEnd) return false;
            break;
          case "month":
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            if (eventDate < today || eventDate >= monthEnd) return false;
            break;
          case "next_months":
            const nextMonthsEnd = new Date(today);
            nextMonthsEnd.setMonth(nextMonthsEnd.getMonth() + 3); // Next 3 months
            if (eventDate < today || eventDate >= nextMonthsEnd) return false;
            break;
        }
      }

      // Gender filter from modal (only applied in panel)
      if (selectedGender !== "todos") {
        // Filter by gender preference of the event
        if (selectedGender === "men" && event.gender_preference !== "men") {
          return false;
        }
        if (selectedGender === "women" && event.gender_preference !== "women") {
          return false;
        }
      }

      return true;
    });
  };

  // Estado para controlar el menú contextual
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    lngLat: mapboxgl.LngLat | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    lngLat: null,
  });

  // Efecto principal para manejar los clics en el mapa (siempre activo)
  useEffect(() => {
    // Esta función se ejecutará cada vez que el usuario haga clic en el mapa
    function handleMapClick(e: mapboxgl.MapMouseEvent) {
      console.log(
        "Clic en el mapa detectado",
        locationMode ? "en modo ubicación" : "en modo normal",
      );

      // IMPORTANTE: Activar el modo de ubicación automáticamente cuando se hace clic en el mapa
      // Esto permite que el menú contextual aparezca sin tener que hacer clic en "Crear un evento" primero
      if (!locationMode) {
        console.log(
          "Activando modo de ubicación automáticamente al hacer clic en el mapa",
        );
        setLocationMode(true);
      }

      // Siempre crear un marcador y mostrar el menú contextual al hacer clic
      if (mapRef.current) {
        console.log("Abriendo menú contextual en", e.lngLat);

        // Limpiar todo antes de empezar - esto es crucial para evitar marcadores duplicados
        closeContextMenu();

        // Remove existing temporary marker if any (extra comprobación para estar seguros)
        if (tempLocationMarker) {
          try {
            tempLocationMarker.remove();
            setTempLocationMarker(null);
          } catch (err) {
            console.error("Error al eliminar marcador temporal:", err);
          }
        }

        // Crear marcador con forma de gota estilo Google Maps pero amarillo
        const markerElement = document.createElement("div");
        markerElement.innerHTML = `
          <svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.563 12.5 41 12.5 41S25 21.563 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="#FFEB3B"/>
            <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.563 12.5 41 12.5 41S25 21.563 25 12.5C25 5.596 19.404 0 12.5 0Z" stroke="#F57C00" stroke-width="1"/>
            <circle cx="12.5" cy="12.5" r="4" fill="white"/>
          </svg>
        `;
        markerElement.style.width = "25px";
        markerElement.style.height = "41px";
        markerElement.style.position = "relative";
        markerElement.style.zIndex = "5";
        markerElement.style.cursor = "pointer";

        try {
          // Create new marker with custom element - usar las coordenadas exactas
          const newMarker = new mapboxgl.Marker({
            element: markerElement,
            draggable: true,
          })
            .setLngLat([e.lngLat.lng, e.lngLat.lat])
            .addTo(mapRef.current);

          // Set marker to state
          setTempLocationMarker(newMarker);
        } catch (err) {
          console.error("Error al crear marcador:", err);
        }

        // Limpiar cualquier menú contextual existente
        setContextMenu({
          visible: false,
          x: 0,
          y: 0,
          lngLat: null,
        });

        // Mostrar nuevo menú contextual
        // Un pequeño retraso para evitar problemas visuales
        setTimeout(() => {
          setContextMenu({
            visible: true,
            x: e.point.x,
            y: e.point.y,
            lngLat: e.lngLat,
          });
        }, 10);

        // Usar ambos servicios en paralelo para obtener resultados más completos
        const mapboxPromise = reverseGeocode(e.lngLat.lng, e.lngLat.lat);
        const googlePromise = googleReverseGeocode(e.lngLat.lng, e.lngLat.lat);
        const nearbyPlacesPromise = findNearbyPlaces(
          e.lngLat.lat,
          e.lngLat.lng,
          100,
        );

        // Procesar todos los resultados
        Promise.all([mapboxPromise, googlePromise, nearbyPlacesPromise])
          .then(([mapboxAddress, googleAddress, nearbyPlaces]) => {
            console.log("Geocode results:", { mapboxAddress, googleAddress });
            console.log("Nearby places:", nearbyPlaces);

            // Extraer nombre del lugar - primero comprobar si hay establecimientos cercanos
            let locationName;
            let address;

            // Prioridad 1: Si encontramos lugares importantes (parques, plazas, etc.) usar esos nombres
            // Identificar posibles lugares importantes (parques, puntos de interés, etc.)
            const importantPlaces = Array.isArray(nearbyPlaces)
              ? nearbyPlaces.filter((place) =>
                  // Buscar parques, puntos de interés, atracciones, locales marcados, etc.
                  [
                    "park",
                    "point_of_interest",
                    "establishment",
                    "premise",
                    "neighborhood",
                    "natural_feature",
                  ].some((type) => place.types && place.types.includes(type)),
                )
              : [];

            if (importantPlaces.length > 0) {
              const place = importantPlaces[0]; // Usar el lugar más relevante
              locationName = place.name || "Lugar del evento";

              // Para la dirección completa, usar el resultado de geocodificación inversa
              if (
                googleAddress &&
                googleAddress !== "Dirección no encontrada" &&
                googleAddress !== "Error al obtener dirección"
              ) {
                address = googleAddress;
              } else {
                address = mapboxAddress;
              }

              console.log("Usando nombre de lugar importante:", locationName);
            }
            // Prioridad 2: Cualquier establecimiento cercano
            else if (Array.isArray(nearbyPlaces) && nearbyPlaces.length > 0) {
              const place = nearbyPlaces[0];
              locationName = place.name || "Lugar del evento";

              // Para la dirección completa, usar el resultado de geocodificación inversa
              if (
                googleAddress &&
                googleAddress !== "Dirección no encontrada" &&
                googleAddress !== "Error al obtener dirección"
              ) {
                address = googleAddress;
              } else {
                address = mapboxAddress;
              }

              console.log(
                "Usando nombre de establecimiento cercano:",
                locationName,
              );
            }
            // Prioridad 3: Usar los resultados de geocodificación inversa de Google
            else if (
              googleAddress &&
              googleAddress !== "Dirección no encontrada" &&
              googleAddress !== "Error al obtener dirección"
            ) {
              // Buscar un nombre significativo que no sea solo una dirección
              // Primero verificar si hay algo como "Parque X" o "Plaza Y" en la dirección
              const specialPlaceMatch = googleAddress.match(
                /(Parque|Plaza|Museo|Estadio|Monumento|Jardín|Biblioteca|Universidad|Teatro|Centro)\s+([^,]+)/i,
              );

              if (specialPlaceMatch) {
                // Usamos el nombre del lugar especial si lo encontramos
                locationName = specialPlaceMatch[0];
              } else {
                // Si no, usamos la primera parte de la dirección
                const placeNameMatch = googleAddress.match(/^([^,]+)/);
                locationName = placeNameMatch
                  ? placeNameMatch[0]
                  : "Lugar del evento";
              }

              address = googleAddress;
              console.log("Usando dirección de Google:", address);
            }
            // Última opción: MapBox como fallback
            else {
              // Buscar un nombre significativo que no sea solo una dirección
              const specialPlaceMatch = mapboxAddress.match(
                /(Parque|Plaza|Museo|Estadio|Monumento|Jardín|Biblioteca|Universidad|Teatro|Centro)\s+([^,]+)/i,
              );

              if (specialPlaceMatch) {
                // Usamos el nombre del lugar especial si lo encontramos
                locationName = specialPlaceMatch[0];
              } else {
                // Si no, usamos la primera parte de la dirección
                const placeNameMatch = mapboxAddress.match(/^([^,]+)/);
                locationName = placeNameMatch
                  ? placeNameMatch[0]
                  : "Lugar del evento";
              }

              address = mapboxAddress;
              console.log("Usando dirección de MapBox (fallback):", address);
            }

            // Store location data
            const locationData = {
              latitude: e.lngLat.lat,
              longitude: e.lngLat.lng,
              locationAddress: address,
              locationName: locationName,
            };

            console.log("Guardando datos de ubicación:", locationData);
            setTempLocationData(locationData);

            toast({
              title: "Ubicación seleccionada",
              description: `${locationName}`,
            });
          })
          .catch((error) => {
            console.error("Error getting address or nearby places:", error);
            toast({
              title: "Error",
              description:
                "No se pudo obtener la dirección. Por favor, intenta de nuevo.",
              variant: "destructive",
            });
          });
      }
    }

    if (mapRef.current) {
      console.log("Configurando manejador de clics en el mapa");

      // Primero eliminar cualquier manejador existente para evitar duplicados
      mapRef.current.off("click", handleMapClick);

      // Luego añadir el manejador de clics
      mapRef.current.on("click", handleMapClick);

      // Return cleanup function
      return () => {
        if (mapRef.current) {
          console.log("Eliminando manejador de clics del mapa");
          mapRef.current.off("click", handleMapClick);
        }
      };
    }
  }, [locationMode, toast]);

  // Efecto mejorado para evitar flickering - solo actualizar cuando cambien condiciones reales
  useEffect(() => {
    if (!mapRef.current) return;

    let lastZoom = mapRef.current.getZoom();
    let lastShowState = lastZoom >= 15;

    const handleZoomEnd = () => {
      if (mapRef.current) {
        const currentZoom = mapRef.current.getZoom();
        const shouldShow = currentZoom >= 15;

        // Solo actualizar si realmente cambió el estado
        if (shouldShow !== lastShowState) {
          console.log(
            `🔍 Zoom check: ${currentZoom.toFixed(1)} >= 15? ${shouldShow}`,
          );
          setShowEventLabels(shouldShow);
          lastShowState = shouldShow;
        }
        lastZoom = currentZoom;
      }
    };

    // Solo escuchar eventos de zoom, no verificar periódicamente
    mapRef.current.on("zoomend", handleZoomEnd);
    mapRef.current.on("moveend", handleZoomEnd);

    // Verificación inicial
    handleZoomEnd();

    return () => {
      if (mapRef.current) {
        mapRef.current.off("zoomend", handleZoomEnd);
        mapRef.current.off("moveend", handleZoomEnd);
      }
    };
  }, []);

  // Initialize map on component mount and center on user's location
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log("Inicializando mapa y configurando eventos globales");

    // Initialize the map with default config - use 3D mode by default
    mapRef.current = initializeMap(mapContainerRef.current, true);
    
    // Configure map instance in context
    console.log("🗺️ MapView: Configurando mapa en contexto...");
    setMapInstance(mapRef.current);
    console.log("🗺️ MapView: Mapa configurado en contexto");

    // Initialize 3D marker manager
    // Removed 3D marker manager initialization - only using 2D markers

    // Add controls
    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Sistema de etiquetas dinámicas con zoom - MEJORADO Y PERFECTO
    let zoomTimeout: NodeJS.Timeout;
    const handleZoomChange = () => {
      if (!mapRef.current) return;

      const currentZoom = mapRef.current.getZoom();
      const shouldShowLabels = currentZoom >= 15;

      console.log(
        `🔍 Zoom check: ${currentZoom.toFixed(1)} >= 15? ${shouldShowLabels}`,
      );

      clearTimeout(zoomTimeout);
      zoomTimeout = setTimeout(() => {
        // Forzar actualización del estado SIEMPRE
        console.log(
          `📊 Before update: current state unknown, should be ${shouldShowLabels}`,
        );
        setShowEventLabels(shouldShowLabels);
        console.log(
          `🎯 FORCED state to: ${shouldShowLabels ? "VISIBLE" : "HIDDEN"}`,
        );
      }, 100); // Respuesta más rápida
    };

    // Múltiples eventos para captura completa
    mapRef.current.on("zoom", handleZoomChange);
    mapRef.current.on("zoomend", handleZoomChange);
    mapRef.current.on("move", handleZoomChange);

    // Configuración inicial de zoom con múltiples verificaciones
    const initializeLabels = () => {
      if (mapRef.current) {
        const initialZoom = mapRef.current.getZoom();
        const shouldShow = initialZoom >= 15;
        console.log(
          `📍 Initial setup: zoom ${initialZoom.toFixed(1)} → labels ${shouldShow ? "ON" : "OFF"}`,
        );
        setShowEventLabels(shouldShow);
      }
    };

    // Múltiples intentos para asegurar inicialización correcta
    setTimeout(initializeLabels, 100);
    setTimeout(initializeLabels, 300);
    setTimeout(initializeLabels, 600);

    // Configurar el manejador de clics directamente en la inicialización del mapa
    if (mapRef.current) {
      // Este manejador de clics estará activo siempre, independientemente del modo
      mapRef.current.on("click", (e) => {
        console.log("Clic en el mapa detectado");

        // SOLUCIÓN MÁS RADICAL: Limpieza completa del DOM
        // 1. Eliminar todos los marcadores del DOM
        const existingMarkers = document.querySelectorAll(".mapboxgl-marker");
        console.log(`Limpiando ${existingMarkers.length} marcadores del DOM`);

        // 2. Eliminar manualmente todos los marcadores encontrados
        existingMarkers.forEach((marker) => {
          // Solo eliminamos si no es un marcador de evento (que tiene distintas clases/estilos)
          if (
            !marker.classList.contains("custom-marker-container") &&
            !marker.querySelector(".custom-marker-container")
          ) {
            marker.remove();
          }
        });

        // 3. Limpiar también el estado y referencias
        if (tempLocationMarker) {
          try {
            tempLocationMarker.remove();
          } catch (err) {
            console.error("Error al eliminar marcador de referencia:", err);
          } finally {
            setTempLocationMarker(null);
          }
        }

        // Si estamos en modo de ubicación, usar el comportamiento específico
        if (locationMode) {
          console.log("Clic en el mapa detectado en modo de ubicación");

          // Crear un elemento DOM personalizado para garantizar visibilidad
          const markerElement = document.createElement("div");
          markerElement.id = `temp-marker-${Date.now()}`;
          markerElement.className = "temp-location-marker"; // Clase para identificación
          markerElement.innerHTML = `
            <svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.563 12.5 41 12.5 41S25 21.563 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="#FFEB3B"/>
              <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.563 12.5 41 12.5 41S25 21.563 25 12.5C25 5.596 19.404 0 12.5 0Z" stroke="#000000" stroke-width="1"/>
              <circle cx="12.5" cy="12.5" r="4" fill="white"/>
            </svg>
          `;
          markerElement.style.width = "25px";
          markerElement.style.height = "41px";
          markerElement.style.position = "relative";
          markerElement.style.zIndex = "5";
          markerElement.style.cursor = "pointer";

          try {
            // Crear un nuevo marcador visible en la posición del clic
            const marker = new mapboxgl.Marker({
              element: markerElement,
              draggable: true,
            })
              .setLngLat([e.lngLat.lng, e.lngLat.lat])
              .addTo(mapRef.current!);

            setTempLocationMarker(marker);

            console.log(
              "Nuevo marcador de ubicación creado:",
              markerElement.id,
            );
          } catch (err) {
            console.error("Error al crear marcador en modo ubicación:", err);
          }

          // Obtener información de la ubicación
          // (Código existente para geocodificación inversa)
          // ...
        }
        // Si no estamos en modo de ubicación, mostrar el menú contextual
        else {
          // Limpiar menú contextual existente
          setContextMenu({
            visible: false,
            x: 0,
            y: 0,
            lngLat: null,
          });

          try {
            // Crear un elemento DOM personalizado para el marcador
            const markerElement = document.createElement("div");
            markerElement.id = `context-marker-${Date.now()}`;
            markerElement.className = "context-menu-marker"; // Clase para identificación
            markerElement.innerHTML = `
              <svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.563 12.5 41 12.5 41S25 21.563 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="#FFEB3B"/>
                <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.563 12.5 41 12.5 41S25 21.563 25 12.5C25 5.596 19.404 0 12.5 0Z" stroke="#000000" stroke-width="1"/>
                <circle cx="12.5" cy="12.5" r="4" fill="white" stroke="#000000" stroke-width="1"/>
              </svg>
            `;
            markerElement.style.width = "25px";
            markerElement.style.height = "41px";
            markerElement.style.position = "relative";
            markerElement.style.zIndex = "5";
            markerElement.style.cursor = "pointer";

            // Crear nuevo marcador
            const newMarker = new mapboxgl.Marker({
              element: markerElement,
              draggable: true,
            })
              .setLngLat([e.lngLat.lng, e.lngLat.lat])
              .addTo(mapRef.current!);

            // Guardar el marcador en el estado
            setTempLocationMarker(newMarker);

            console.log(
              "Nuevo marcador de menú contextual creado:",
              markerElement.id,
            );
          } catch (err) {
            console.error("Error al crear marcador para menú contextual:", err);
          }

          // Mostrar el menú contextual
          setContextMenu({
            visible: true,
            x: e.point.x,
            y: e.point.y,
            lngLat: e.lngLat,
          });

          // Obtener información de la ubicación para que esté disponible
          // aunque el usuario no haga clic en "Crear evento aquí"
          const mapboxPromise = reverseGeocode(e.lngLat.lng, e.lngLat.lat);
          const googlePromise = googleReverseGeocode(
            e.lngLat.lng,
            e.lngLat.lat,
          );

          Promise.all([mapboxPromise, googlePromise])
            .then(([mapboxAddress, googleAddress]) => {
              let locationName, address;

              if (
                googleAddress &&
                googleAddress !== "Dirección no encontrada" &&
                googleAddress !== "Error al obtener dirección"
              ) {
                const placeNameMatch = googleAddress.match(/^([^,]+)/);
                locationName = placeNameMatch
                  ? placeNameMatch[0]
                  : "Lugar del evento";
                address = googleAddress;
              } else {
                const placeNameMatch = mapboxAddress.match(/^([^,]+)/);
                locationName = placeNameMatch
                  ? placeNameMatch[0]
                  : "Lugar del evento";
                address = mapboxAddress;
              }

              // Guardar datos de ubicación
              const locationData = {
                latitude: e.lngLat.lat,
                longitude: e.lngLat.lng,
                locationAddress: address,
                locationName: locationName,
              };

              setTempLocationData(locationData);
            })
            .catch((error) => {
              console.error("Error al obtener dirección:", error);
            });
        }
      });
    }

    // Try to center on user's location automatically
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;

        // Set current location for distance filtering
        setCurrentLocation({
          lng: longitude,
          lat: latitude,
          locationName: "Tu ubicación",
          locationAddress: "Ubicación actual"
        });

        if (mapRef.current) {
          mapRef.current.setCenter([longitude, latitude]);
          mapRef.current.setZoom(13);

          // Crear un elemento DOM personalizado para el marcador de posición del usuario
          const userMarkerElement = document.createElement("div");
          userMarkerElement.style.width = "30px";
          userMarkerElement.style.height = "30px";
          userMarkerElement.style.borderRadius = "50%";
          userMarkerElement.style.backgroundColor = "#1DA1F2"; // Color azul Twitter
          userMarkerElement.style.border = "3px solid white";
          userMarkerElement.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)";

          // Add a marker for the user's current position
          new mapboxgl.Marker({
            element: userMarkerElement,
          })
            .setLngLat([longitude, latitude])
            .addTo(mapRef.current);

          // Try to get the city name for a better user experience
          reverseGeocode(longitude, latitude)
            .then((address) => {
              // Update current location with actual address
              setCurrentLocation(prev => ({
                ...prev!,
                locationAddress: address || "Ubicación actual"
              }));
              
              toast({
                title: "Ubicación detectada",
                description: `Te mostramos eventos cercanos a tu ubicación`,
              });
            })
            .catch((err) => console.error("Error getting address:", err));
        }
      },
      (error) => {
        console.warn("Error getting location:", error);
        // Fallback to default location (centered on a major city)
        if (mapRef.current) {
          // Center on Buenos Aires by default (more relevant for Spanish-speaking users)
          mapRef.current.setCenter([-58.3816, -34.6037]);
          mapRef.current.setZoom(12);
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );

    return () => {
      // Cleanup completo al desmontar componente
      if (mapRef.current) {
        console.log("🧹 Cleaning up map and event listeners");

        // Limpiar timeout de zoom si existe
        if (zoomTimeout) {
          clearTimeout(zoomTimeout);
        }

        // Remover event listeners específicos para zoom
        try {
          mapRef.current.off("zoom", handleZoomChange);
          mapRef.current.off("zoomend", handleZoomChange);
          mapRef.current.off("move", handleZoomChange);
        } catch (e) {
          console.warn("Error removing zoom listeners:", e);
        }
        // Ya que mapRef.current.remove() se encargará de limpiar todo

        // Eliminar el mapa
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Clear markers and popups
      markersRef.current.forEach((marker) => marker.remove());
      popupsRef.current.forEach((popup) => popup.remove());
      markersRef.current = [];
      popupsRef.current = [];
      
      // Clear map context
      console.log("🗺️ MapView: Limpiando instancia del mapa del contexto");
      clearMapInstance();
    };
  }, []);

  // Efecto para cerrar el menú contextual y limpiar marcadores temporales al hacer clic en cualquier parte de la aplicación
  // que no sea el mapa o los botones de acción
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Element;

      // Comprobar si es un clic dentro del mapa
      const isMapClick = target.closest(".mapboxgl-canvas-container");

      // Comprobar si es un clic en los botones de acción
      const isActionButton =
        target.closest("button") &&
        (target.textContent?.includes("Buscar eventos aquí") ||
          target.textContent?.includes("Crear un evento aquí") ||
          target.textContent?.includes("Ver eventos cercanos") ||
          target.textContent?.includes("Crear evento aquí"));

      // Comprobar si es un clic en el menú contextual
      const isContextMenuClick = target.closest(".context-menu");

      // No cerrar el menú contextual si el clic fue en:
      // - El propio menú contextual
      // - Un botón dentro del menú
      if (contextMenu.visible && !isMapClick && !isContextMenuClick) {
        closeContextMenu();
      }

      // Limpiar el marcador temporal y ocultar botones de acción si el clic no fue en:
      // - El mapa
      // - Los botones de acción específicos
      // - La barra de búsqueda
      // - Controles del mapa
      if (
        showActionsForLocation &&
        !isMapClick &&
        !isActionButton &&
        !target.closest(".google-places-search") &&
        !target.closest(".mapboxgl-ctrl")
      ) {
        console.log(
          "Clic fuera de la ubicación seleccionada, ocultando botones de acción",
        );

        // Ocultar botones de acciones específicas
        setShowActionsForLocation(false);

        // Limpiar el marcador temporal si existe
        if (tempLocationMarker) {
          tempLocationMarker.remove();
          setTempLocationMarker(null);
        }
      }
    }

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [contextMenu.visible, showActionsForLocation, tempLocationMarker]);

  // Add event markers when events, filters, or showEventLabels change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers and popups
    markersRef.current.forEach((marker) => marker.remove());
    popupsRef.current.forEach((popup) => popup.remove());
    markersRef.current = [];
    popupsRef.current = [];

    // Clear 3D markers if available
    // Removed 3D marker clearing - only using 2D markers

    // Show ALL events on the main map (no filtering)
    const cordobaEvents = mapEvents.filter((event) => {
      const lat =
        typeof event.latitude === "string"
          ? parseFloat(event.latitude)
          : event.latitude;
      return lat < 0; // Los eventos en Argentina tienen latitud negativa
    });

    // Add 3D markers in both 2D and 3D modes
    // Removed 3D marker creation - only using 2D markers

    // For 2D mode, add regular markers (also add these in 3D mode as fallback)
    mapEvents.forEach((event: EventWithRelations) => {
      if (!mapRef.current) return;

      // Create custom React element for the marker
      const el = document.createElement("div");
      el.className = "custom-marker-container";

      // Unified media processing function
      const getEventImageData = (event: EventWithRelations) => {
        let hasImage = false;
        let imageUrl = "";

        // Priority 1: Main media URL (most reliable)
        const mainMediaUrl =
          (event as any).main_media_url || event.mainMediaUrl;
        if (mainMediaUrl && mainMediaUrl.trim()) {
          hasImage = true;
          imageUrl = mainMediaUrl;
          return { hasImage, imageUrl };
        }

        // Priority 2: Parse mediaItems JSON
        try {
          if (
            event.mediaItems &&
            event.mediaItems !== "[]" &&
            event.mediaItems.trim()
          ) {
            const mediaItems = JSON.parse(event.mediaItems);
            if (Array.isArray(mediaItems) && mediaItems.length > 0) {
              // Find main image or first image
              const mainImage =
                mediaItems.find((item) => item.isMain && item.url) ||
                mediaItems.find((item) => item.url);
              if (mainImage?.url) {
                hasImage = true;
                imageUrl = mainImage.url;
              }
            }
          }
        } catch (e) {
          console.error("Error parsing mediaItems for event:", event.id, e);
        }

        return { hasImage, imageUrl };
      };

      const { hasImage: hasEventImage, imageUrl: eventImageUrl } =
        getEventImageData(event);

      // Render React component to the element with media data
      const root = createRoot(el);
      root.render(
        <EventPin
          category={event.category}
          mainMediaUrl={hasEventImage ? eventImageUrl : undefined}
          mainMediaType={hasEventImage ? "photo" : undefined}
          eventTitle={event.title}
          showLabel={showEventLabels}
        />,
      );

      // Create popup with new design including an image and a button
      const popup = new mapboxgl.Popup({ offset: 25, className: "event-popup" })
        .setHTML(`
          <div class="popup-content" data-event-id="${event.id}" onclick="document.dispatchEvent(new CustomEvent('showEventDetails', {detail: {eventId: ${event.id}}}))">
            <div class="event-popup-category">${event.category.charAt(0).toUpperCase() + event.category.slice(1)}</div>
            
            <div class="event-popup-image">
              ${
                hasEventImage
                  ? `<img src="${eventImageUrl}" alt="${event.title.replace(/"/g, "&quot;")}" 
                     style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; display: block;" 
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />`
                  : ""
              }
              <div class="event-popup-image-placeholder category-${event.category}-light" style="display: ${hasEventImage ? "none" : "flex"};">
                <span>${event.category.charAt(0).toUpperCase()}</span>
              </div>
            </div>
            
            <h3 class="event-popup-title">${event.title}</h3>
            <div class="event-popup-details">
              <div class="event-popup-date-time">
                <span class="event-popup-icon">📅</span>
                ${new Date(event.date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })}, ${new Date(event.date).toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div class="event-popup-location">
                <span class="event-popup-icon">📍</span>
                ${event.locationName}
              </div>
            </div>
            <div class="event-popup-footer">
              <div class="event-popup-attendees">
                <span class="event-popup-icon">👥</span>
                ${event.attendees?.length || 0} asistentes
              </div>
              <div class="event-popup-payment-type ${event.paymentType === "free" ? "free" : "paid"}">
                ${event.paymentType === "free" ? "Free" : `$${event.price || ""}`}
              </div>
            </div>
            <button class="event-popup-button" onclick="document.dispatchEvent(new CustomEvent('showEventDetails', {detail: {eventId: ${event.id}}}))">
              Ver detalles
            </button>
          </div>
        `);

      // Validar y convertir coordenadas
      const lng =
        typeof event.longitude === "string"
          ? parseFloat(event.longitude)
          : event.longitude;
      const lat =
        typeof event.latitude === "string"
          ? parseFloat(event.latitude)
          : event.latitude;

      // Verificar que las coordenadas sean números válidos
      if (isNaN(lng) || isNaN(lat)) {
        console.error(
          "Coordenadas inválidas para el evento:",
          event.id,
          event.title,
          {
            longitude: event.longitude,
            latitude: event.latitude,
          },
        );
        return; // Saltar este evento si las coordenadas no son válidas
      }

      // Only add 2D markers in 2D mode (to avoid duplicates with 3D markers)
      // In 3D mode, we'll exclusively use 3D markers
      // Always add 2D markers (removed 3D mode condition)
      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      // Add event listener to marker with zoom functionality
      el.addEventListener("click", () => {
        // Activate focused mode when event is selected
        setIsFocusedMode(true);
        
        // Add zoom to marker functionality with offset to avoid panel covering
        if (mapRef.current) {
          // Calculate safe offset to position marker in visible area above panel
          // Using conservative 35% to avoid pushing marker off-screen while keeping it visible
          const screenHeight = mapRef.current.getContainer().clientHeight;
          const offsetPixels = screenHeight * 0.35; // Safe 35% offset upward to keep marker visible above panel
          
          // SAVE camera state before moving to marker
          console.log("🚨 DEBUG: Guardando estado de cámara antes de ir al marcador");
          saveCameraState();
          
          mapRef.current.flyTo({
            center: [lng, lat],
            zoom: 18, // Zoom más cercano para efecto focal
            duration: 1200, // Animación más larga y suave
            essential: true,
            pitch: is3DMode ? 60 : 0, // Mantener vista 3D si está activada, sino usar 0 para 2D
            bearing: mapRef.current.getBearing(), // Mantener rotación actual
            offset: [0, -offsetPixels] // Offset negative (upward) to keep marker visible
          });
        }
        
        onEventSelect(event);
      });

      // Track markers and popups for cleanup
      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    });
  }, [mapEvents, onEventSelect, showEventLabels]);

  // Removed 3D mode toggle - only using 2D markers

  // Función auxiliar para determinar con precisión el estilo de mapa actual
  // y actualizar el estado de referencia persistente
  const detectAndUpdateMapStyle = (): {
    isStandard: boolean;
    isSatellite: boolean;
    isLight: boolean;
    isDark: boolean;
  } => {
    if (!mapRef.current) {
      return {
        isStandard: true,
        isSatellite: false,
        isLight: true,
        isDark: false,
      };
    }

    try {
      const style = mapRef.current.getStyle();
      const styleId = style.name || "";
      const styleUrl = style.sprite || "";
      const styleJson = JSON.stringify(style).toLowerCase();

      // Resultados de la detección
      const isSatellite =
        styleJson.includes("satellite") || styleUrl.includes("satellite");
      const isDark =
        styleJson.includes("dark") ||
        styleUrl.includes("dark") ||
        styleId.includes("dark");
      const isStandard = !isSatellite; // Si no es satélite, consideramos que es estándar
      const isLight = !isDark; // Si no es oscuro, consideramos que es claro

      console.log("Estilo de mapa detectado:", {
        isSatellite,
        isDark,
        styleUrl,
        styleId,
      });

      // Actualizar el estado persistente con el estilo detectado
      if (isSatellite) {
        mapStateRef.current.style = "satellite";
      } else if (isDark) {
        mapStateRef.current.style = "dark";
      } else {
        mapStateRef.current.style = "standard";
      }

      // Actualizar también otros parámetros del estado persistente
      if (mapRef.current) {
        mapStateRef.current.currentZoom = mapRef.current.getZoom();
        mapStateRef.current.currentCenter = mapRef.current.getCenter();
        mapStateRef.current.currentBearing = mapRef.current.getBearing();
        mapStateRef.current.currentPitch = mapRef.current.getPitch();
        mapStateRef.current.is3D = mapStateRef.current.currentPitch > 0;
      }

      return { isStandard, isSatellite, isLight, isDark };
    } catch (error) {
      console.error("Error al detectar estilo de mapa:", error);
      return {
        isStandard: true,
        isSatellite: false,
        isLight: true,
        isDark: false,
      };
    }
  };

  // Toggle between 2D and 3D map views with style preservation
  const handleToggleMapView = () => {
    if (!mapRef.current) return;

    // Guardar el estado actual del mapa en nuestro estado persistente
    detectAndUpdateMapStyle();

    // Obtener preset de iluminación basado en la hora
    const currentTimePreset = getLightPresetByTime();

    // Próximo estado del mapa - alternar entre 2D y 3D
    const nextIs3DMode = !is3DMode;

    // Actualizar la referencia de estado persistente
    mapStateRef.current.is3D = nextIs3DMode;

    // Variables de estilo objetivo
    let targetStyle;
    let styleDescription;

    // Seleccionar el estilo de mapa basado en el estado persistente
    // y el nuevo modo de visualización
    if (nextIs3DMode) {
      // Cambiando a modo 3D
      if (mapStateRef.current.style === "satellite") {
        targetStyle = MapStyle.STANDARD_SATELLITE;
        styleDescription = "mapa satelital 3D";
        setIsSatelliteMode(true);
      } else if (mapStateRef.current.style === "dark") {
        targetStyle = MapStyle.STANDARD_3D; // No hay específico oscuro 3D
        styleDescription = "mapa estándar 3D";
        setIsSatelliteMode(false);
      } else {
        targetStyle = MapStyle.STANDARD_3D;
        styleDescription = "mapa estándar 3D";
        setIsSatelliteMode(false);
      }

      // Actualizar estado y configuración
      console.log("Cambiando a 3D:", {
        estilo: mapStateRef.current.style,
        targetStyle,
        zoom: mapStateRef.current.currentZoom,
      });

      // Aplicar el estilo y la inclinación
      mapRef.current.setStyle(targetStyle);
      mapRef.current.setPitch(45);
      setIs3DMode(true);

      // Aplicar configuración una vez que el estilo termine de cargarse
      mapRef.current.once("style.load", () => {
        if (mapRef.current) {
          try {
            // Habilitar objetos 3D
            mapRef.current.setConfigProperty("basemap", "show3dObjects", true);

            // Aplicar iluminación basada en tiempo
            mapRef.current.setConfigProperty(
              "basemap",
              "useAutoLightPreset",
              true,
            );
            mapRef.current.setConfigProperty(
              "basemap",
              "lightPreset",
              currentTimePreset,
            );

            // Actualizar estado de configuración
            setMapConfig((prev) => ({
              ...prev,
              lightPreset: currentTimePreset as LightPreset,
              useAutoLightPreset: true,
              show3dObjects: true,
            }));

            // Restaurar valores de posición/zoom guardados
            mapRef.current.setZoom(mapStateRef.current.currentZoom);
            mapRef.current.setCenter(mapStateRef.current.currentCenter);
            mapRef.current.setBearing(mapStateRef.current.currentBearing);
          } catch (error) {
            console.error("Error al aplicar configuración 3D:", error);
          }
        }
      });

      toast({
        title: "Vista 3D activada",
        description: `Cambiado a vista de ${styleDescription}.`,
      });
    } else {
      // Cambiando a modo 2D
      if (mapStateRef.current.style === "satellite") {
        targetStyle = MapStyle.SATELLITE_2D;
        styleDescription = "mapa satelital 2D";
        setIsSatelliteMode(true);
      } else {
        // Siempre usar el estilo estándar para 2D (no usar tema oscuro)
        targetStyle = MapStyle.STREETS_2D;
        styleDescription = "mapa estándar 2D";
        setIsSatelliteMode(false);
      }

      // Información de depuración
      console.log("Cambiando a 2D:", {
        estilo: mapStateRef.current.style,
        targetStyle,
        zoom: mapStateRef.current.currentZoom,
      });

      // Aplicar el estilo y quitar la inclinación
      mapRef.current.setStyle(targetStyle);
      mapRef.current.setPitch(0);
      setIs3DMode(false);

      // Restaurar configuración de vista
      mapRef.current.once("style.load", () => {
        if (mapRef.current) {
          // Restaurar valores de posición/zoom guardados
          mapRef.current.setZoom(mapStateRef.current.currentZoom);
          mapRef.current.setCenter(mapStateRef.current.currentCenter);
          mapRef.current.setBearing(mapStateRef.current.currentBearing);
        }
      });

      toast({
        title: "Vista 2D activada",
        description: `Cambiado a vista de ${styleDescription}.`,
      });
    }
  };

  // Handle search functionality
  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  // Alternar entre vistas estándar y satelital con preservación de modo 2D/3D
  const handleToggleSatelliteView = () => {
    if (!mapRef.current) return;

    // Guardar el estado actual del mapa
    detectAndUpdateMapStyle();

    // Alternar entre satelital y estándar
    const newIsSatelliteMode = !isSatelliteMode;

    // Actualizar estado persistente
    mapStateRef.current.style = newIsSatelliteMode ? "satellite" : "standard";

    // Variables para aplicar el estilo correcto
    let targetStyle;
    let styleDescription;

    // Seleccionar el estilo correcto basado en el modo actual (2D/3D)
    if (newIsSatelliteMode) {
      // Cambiar a satelital (en 2D o 3D según el modo actual)
      targetStyle = is3DMode
        ? MapStyle.STANDARD_SATELLITE
        : MapStyle.SATELLITE_2D;
      styleDescription = is3DMode ? "mapa satelital 3D" : "mapa satelital 2D";
    } else {
      // Cambiar a estándar (en 2D o 3D según el modo actual)
      targetStyle = is3DMode ? MapStyle.STANDARD_3D : MapStyle.STREETS_2D;
      styleDescription = is3DMode ? "mapa estándar 3D" : "mapa estándar 2D";
    }

    // Actualizar el estado de React
    setIsSatelliteMode(newIsSatelliteMode);

    // Información de depuración
    console.log("Cambiando estilo de mapa:", {
      nuevoEstilo: mapStateRef.current.style,
      targetStyle,
      is3D: is3DMode,
    });

    // Aplicar el estilo
    mapRef.current.setStyle(targetStyle);

    // Mantener la inclinación según el modo actual
    mapRef.current.setPitch(is3DMode ? 45 : 0);

    // Si estamos en 3D, aplicar configuraciones adicionales
    if (is3DMode) {
      const currentTimePreset = getLightPresetByTime();

      mapRef.current.once("style.load", () => {
        if (!mapRef.current) return;

        try {
          // Configurar objetos 3D y luz
          mapRef.current.setConfigProperty("basemap", "show3dObjects", true);
          mapRef.current.setConfigProperty(
            "basemap",
            "useAutoLightPreset",
            true,
          );
          mapRef.current.setConfigProperty(
            "basemap",
            "lightPreset",
            currentTimePreset,
          );

          // Actualizar estado de configuración
          setMapConfig((prev) => ({
            ...prev,
            lightPreset: currentTimePreset as LightPreset,
            useAutoLightPreset: true,
            show3dObjects: true,
          }));
        } catch (error) {
          console.error(
            "Error al aplicar configuración 3D en modo satelital:",
            error,
          );
        }
      });
    }

    // Restaurar vista después de cargar el estilo
    mapRef.current.once("style.load", () => {
      if (!mapRef.current) return;

      // Restaurar valores de zoom y posición guardados
      mapRef.current.setZoom(mapStateRef.current.currentZoom);
      mapRef.current.setCenter(mapStateRef.current.currentCenter);
      mapRef.current.setBearing(mapStateRef.current.currentBearing);
    });

    // Notificar al usuario
    toast({
      title: newIsSatelliteMode ? "Mapa Satelital" : "Mapa Estándar",
      description: `Vista de ${styleDescription} activada`,
    });
  };

  // Función para eliminar todos los marcadores personalizados del mapa
  const removeAllCustomMarkers = () => {
    console.log("⚠️ LIMPIEZA RADICAL DE MARCADORES ⚠️");

    // PASO 1: Limpiar el estado
    if (tempLocationMarker) {
      try {
        tempLocationMarker.remove();
      } catch (err) {
        console.error("Error al eliminar marcador temporal del estado:", err);
      } finally {
        setTempLocationMarker(null);
      }
    }

    // PASO 2: Limpieza directa de todos los marcadores en el DOM
    try {
      // Buscar TODOS los marcadores de Mapbox
      const allMarkers = document.querySelectorAll(".mapboxgl-marker");

      console.log(`Encontrados ${allMarkers.length} marcadores en el DOM`);

      // Filtrar y eliminar solo los marcadores temporales (no los de eventos)
      let markersRemoved = 0;

      allMarkers.forEach((marker) => {
        try {
          // Verificar si es un marcador de evento (que queremos conservar)
          const isEventMarker =
            marker.classList.contains("custom-marker-container") ||
            marker.querySelector(".custom-marker-container");

          if (!isEventMarker) {
            marker.remove();
            markersRemoved++;
          }
        } catch (err) {
          console.error("Error al procesar marcador individual:", err);
        }
      });

      console.log(`Se eliminaron ${markersRemoved} marcadores temporales`);
    } catch (err) {
      console.error("Error grave durante la limpieza de marcadores:", err);
    }

    // PASO 3: Forzar una actualización del mapa
    if (mapRef.current) {
      try {
        // Este resize puede ayudar a refrescar la UI del mapa
        mapRef.current.resize();
      } catch (err) {
        console.error("Error al actualizar el mapa:", err);
      }
    }
  };

  // Función para limpiar los marcadores temporales (versión original - mantenida por compatibilidad)
  const cleanupTempMarkers = () => {
    removeAllCustomMarkers();
  };

  // Función para cerrar el menú contextual
  const closeContextMenu = () => {
    console.log("Cerrando menú contextual y limpiando estado");

    // Asegurarse de que el menú contextual se cierre correctamente
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      lngLat: null,
    });

    // IMPORTANTE: Resetear el modo de ubicación al cancelar
    // Esto arregla el problema de los botones que no vuelven al estado inicial
    setLocationMode(false);

    // Eliminar TODOS los marcadores personalizados
    removeAllCustomMarkers();

    // Resetear cualquier otro estado relacionado con la ubicación
    setTempLocationData(null);

    // Asegurarnos de que los botones de acción no se muestren
    setShowActionsForLocation(false);

    // Forzar un refresco para eliminar cualquier elemento visual persistente
    if (mapRef.current) {
      mapRef.current.resize();
    }

    console.log("Estado limpiado correctamente");
  };

  // Función para crear un evento en la ubicación del menú contextual
  const handleCreateEventAtLocation = async () => {
    // Primero verificar si ya tenemos los datos de la ubicación
    if (tempLocationData && contextMenu.lngLat) {
      // Usar los datos que ya hemos obtenido
      onCreateEventClick({
        latitude: tempLocationData.latitude,
        longitude: tempLocationData.longitude,
        locationAddress: tempLocationData.locationAddress,
        locationName: tempLocationData.locationName,
      });

      // Cerrar el menú contextual
      closeContextMenu();
      return;
    }

    // Si no tenemos datos previos, obtenerlos
    if (contextMenu.lngLat) {
      const { lng, lat } = contextMenu.lngLat;

      try {
        // Obtener información sobre la ubicación seleccionada
        const mapboxPromise = reverseGeocode(lng, lat);
        const googlePromise = googleReverseGeocode(lng, lat);
        const nearbyPlacesPromise = findNearbyPlaces(lat, lng, 100);

        // Procesar resultados
        const [mapboxAddress, googleAddress, nearbyPlaces] = await Promise.all([
          mapboxPromise,
          googlePromise,
          nearbyPlacesPromise,
        ]);

        // Determinar el nombre y dirección del lugar
        let locationName;
        let address;

        // Prioridad 1: Si encontramos lugares importantes (parques, plazas, etc.) usar esos nombres
        // Identificar posibles lugares importantes (parques, puntos de interés, etc.)
        const importantPlaces = Array.isArray(nearbyPlaces)
          ? nearbyPlaces.filter((place) =>
              // Buscar parques, puntos de interés, atracciones, locales marcados, etc.
              [
                "park",
                "point_of_interest",
                "establishment",
                "premise",
                "neighborhood",
                "natural_feature",
              ].some((type) => place.types && place.types.includes(type)),
            )
          : [];

        if (importantPlaces.length > 0) {
          const place = importantPlaces[0]; // Usar el lugar más relevante
          locationName = place.name || "Lugar del evento";

          // Para la dirección completa, usar el resultado de geocodificación inversa
          address = googleAddress || mapboxAddress;

          console.log(
            "Usando nombre de lugar importante (menú contextual):",
            locationName,
          );
        }
        // Prioridad 2: Cualquier establecimiento cercano
        else if (Array.isArray(nearbyPlaces) && nearbyPlaces.length > 0) {
          locationName = nearbyPlaces[0].name || "Lugar del evento";

          // Para la dirección completa usamos geocodificación inversa
          address = googleAddress || mapboxAddress;

          console.log(
            "Usando nombre de establecimiento cercano (menú contextual):",
            locationName,
          );
        }
        // Prioridad 3: Buscar nombres significativos en los resultados de geocodificación
        else if (googleAddress && googleAddress !== "Dirección no encontrada") {
          address = googleAddress;

          // Buscar si hay algo como "Parque X" o "Plaza Y" en la dirección
          const specialPlaceMatch = address.match(
            /(Parque|Plaza|Museo|Estadio|Monumento|Jardín|Biblioteca|Universidad|Teatro|Centro)\s+([^,]+)/i,
          );

          if (specialPlaceMatch) {
            // Usamos el nombre del lugar especial si lo encontramos
            locationName = specialPlaceMatch[0];
            console.log(
              "Encontrado nombre de lugar en dirección Google:",
              locationName,
            );
          } else {
            // Si no, usamos la primera parte de la dirección
            const namePart = googleAddress.split(",")[0];
            locationName = namePart || "Lugar del evento";
          }
        }
        // Última opción: MapBox como fallback
        else {
          address = mapboxAddress;

          // Buscar si hay algo como "Parque X" o "Plaza Y" en la dirección
          const specialPlaceMatch = address.match(
            /(Parque|Plaza|Museo|Estadio|Monumento|Jardín|Biblioteca|Universidad|Teatro|Centro)\s+([^,]+)/i,
          );

          if (specialPlaceMatch) {
            // Usamos el nombre del lugar especial si lo encontramos
            locationName = specialPlaceMatch[0];
            console.log(
              "Encontrado nombre de lugar en dirección MapBox:",
              locationName,
            );
          } else {
            // Si no, usamos la primera parte de la dirección
            const namePart = mapboxAddress.split(",")[0];
            locationName = namePart || "Lugar del evento";
          }
        }

        // Crear objeto de ubicación
        const locationData = {
          latitude: lat,
          longitude: lng,
          locationAddress: address,
          locationName: locationName,
        };

        // Cerrar menú contextual
        closeContextMenu();

        // Iniciar creación de evento con esta ubicación
        onCreateEventClick(locationData);
      } catch (error) {
        console.error("Error al obtener información de la ubicación:", error);
        toast({
          title: "Error",
          description:
            "No se pudo obtener información sobre esta ubicación. Inténtalo de nuevo.",
          variant: "destructive",
        });
      }
    }
  };

  // Función para buscar eventos cercanos a la ubicación del menú contextual
  const handleFindNearbyEvents = () => {
    if (contextMenu.lngLat && mapRef.current) {
      // Guardar las coordenadas antes de cerrar el menú contextual
      const lng = contextMenu.lngLat.lng;
      const lat = contextMenu.lngLat.lat;

      // Cerrar menú contextual primero
      closeContextMenu();

      // Centrar el mapa en la ubicación seleccionada
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 15,
        essential: true,
        duration: 1000,
      });

      // FILTROS ACTIVADOS: cargar eventos cercanos a las coordenadas seleccionadas

      // Actualizar el estado con la ubicación actual
      setCurrentLocation({
        lng: lng,
        lat: lat,
        locationName: "Ubicación seleccionada",
        locationAddress: "",
      });

      // Filtrar eventos por cercanía a estas coordenadas (sin filtros adicionales inicialmente)
      const baseNearbyEvents = events.filter((event: EventWithRelations) => {
        const eventLat = typeof event.latitude === "string" ? parseFloat(event.latitude) : event.latitude;
        const eventLng = typeof event.longitude === "string" ? parseFloat(event.longitude) : event.longitude;

        if (!isNaN(eventLat) && !isNaN(eventLng)) {
          const distance = calculateDistance(lat, lng, eventLat, eventLng);
          return distance <= selectedDistance;
        }
        return false;
      });

      // Aplicar filtros adicionales
      const nearbyEvents = applyEventFilters(baseNearbyEvents, { lat, lng });

      // Actualizar el estado con los eventos filtrados
      setLocationFilteredEvents(nearbyEvents);

      // Mostrar panel de eventos
      setEventsPanelVisible(true);

      // Eliminar cualquier marcador temporal previo
      cleanupTempMarkers();

      // Crear un nuevo marcador en la ubicación seleccionada
      if (mapRef.current) {
        const marker = new mapboxgl.Marker({
          color: "#1DA1F2",
        })
          .setLngLat([lng, lat])
          .addTo(mapRef.current);

        // Guardar la referencia del marcador para poder eliminarlo después
        setTempLocationMarker(marker);

        // Programar la eliminación automática del marcador después de 5 segundos
        setTimeout(() => {
          if (marker) {
            marker.remove();
            setTempLocationMarker(null);
          }
        }, 5000);
      }

      // Mostrar notificación según el número de eventos encontrados
      if (nearbyEvents.length > 0) {
        toast({
          title: `${nearbyEvents.length} eventos encontrados`,
          description: "Mostrando eventos cercanos a este lugar",
        });
      } else {
        toast({
          title: "No se encontraron eventos",
          description: "No hay eventos cerca de esta ubicación",
          variant: "destructive",
        });
      }
    }
  };

  // Function to toggle location selection mode
  const toggleLocationMode = () => {
    console.log("Configurando modo de ubicación:", !locationMode);

    // Eliminar TODOS los marcadores existentes primero
    removeAllCustomMarkers();

    // If we're exiting location mode, clean up
    if (locationMode) {
      resetLocationSelection();
    } else {
      // Enter location selection mode
      toast({
        title: "Modo de selección activado",
        description:
          "Haz clic en el mapa o busca un lugar para seleccionar la ubicación del evento",
      });
    }

    // Toggle mode
    setLocationMode(!locationMode);
  };

  // Function to handle place selection from the search bar
  const handlePlaceSelect = async (place: {
    latitude: number;
    longitude: number;
    locationName: string;
    locationAddress: string;
  }) => {
    console.log("Lugar seleccionado en la búsqueda:", place);

    // Si no estamos en modo de selección de ubicación, simplemente centrar el mapa
    if (!locationMode && mapRef.current) {
      const longitude =
        typeof place.longitude === "string"
          ? parseFloat(place.longitude)
          : place.longitude;
      const latitude =
        typeof place.latitude === "string"
          ? parseFloat(place.latitude)
          : place.latitude;

      // Centrar el mapa en la ubicación seleccionada
      mapRef.current.flyTo({
        center: [longitude, latitude],
        zoom: 15,
        essential: true,
        duration: 1000,
      });

      // Opcional: Añadir un marcador temporal
      if (tempLocationMarker) {
        tempLocationMarker.remove();
      }

      const marker = new mapboxgl.Marker({
        color: "#1DA1F2",
      })
        .setLngLat([longitude, latitude])
        .addTo(mapRef.current);

      // Guardamos la referencia del marcador temporal
      setTempLocationMarker(marker);

      // Guardar la ubicación actual para los botones de acción
      setCurrentLocation({
        lng: longitude,
        lat: latitude,
        locationName: place.locationName,
        locationAddress: place.locationAddress,
      });

      // Mostrar los botones de acción para esta ubicación
      setShowActionsForLocation(true);

      // Mostrar toast con información
      toast({
        title: place.locationName,
        description: place.locationAddress,
      });

      return;
    }

    // Si estamos en modo de selección de ubicación, procesar normalmente
    if (locationMode && mapRef.current) {
      // Remove previous marker if exists
      if (tempLocationMarker) {
        tempLocationMarker.remove();
      }

      // Asegurar que las coordenadas sean números
      const latitude =
        typeof place.latitude === "string"
          ? parseFloat(place.latitude)
          : place.latitude;
      const longitude =
        typeof place.longitude === "string"
          ? parseFloat(place.longitude)
          : place.longitude;

      console.log("Coordenadas recibidas:", {
        latitude,
        longitude,
        tipo_lat: typeof latitude,
        tipo_lng: typeof longitude,
      });

      const coordinates: [number, number] = [longitude, latitude];

      // Create a new marker
      const marker = new mapboxgl.Marker({
        color: "#FF385C",
        draggable: true,
      })
        .setLngLat(coordinates)
        .addTo(mapRef.current);

      // Fly to the location
      mapRef.current.flyTo({
        center: coordinates,
        zoom: 15,
        essential: true,
        duration: 1000,
      });

      // Store the marker reference
      setTempLocationMarker(marker);

      // Intentar utilizar geocodificación inversa de Google Maps para mejor consistencia
      try {
        console.log(
          "Solicitando geocodificación inversa de Google para:",
          longitude,
          latitude,
        );
        const googleAddress = await googleReverseGeocode(longitude, latitude);
        console.log("Google devolvió la dirección:", googleAddress);

        const locationData = {
          latitude: parseFloat(String(latitude)),
          longitude: parseFloat(String(longitude)),
          // Usar la dirección completa de Google para la dirección
          locationAddress: googleAddress || place.locationAddress,
          // IMPORTANTE: Mantener el nombre original del lugar que el usuario seleccionó
          locationName: place.locationName,
        };

        console.log("Guardando datos de ubicación (Google):", locationData);
        setTempLocationData(locationData);

        toast({
          title: "Ubicación seleccionada",
          description: googleAddress || place.locationAddress,
        });
      } catch (error) {
        console.error("Error obteniendo dirección de Google:", error);

        // Fallback a la dirección original
        const fallbackData = {
          latitude: parseFloat(String(latitude)),
          longitude: parseFloat(String(longitude)),
          locationAddress: place.locationAddress,
          locationName: place.locationName,
        };

        console.log("Guardando datos de ubicación (fallback):", fallbackData);
        setTempLocationData(fallbackData);

        toast({
          title: "Ubicación seleccionada",
          description: place.locationAddress,
        });
      }

      // Add dragend event to update data when marker is dragged
      marker.on("dragend", async () => {
        const lngLat = marker.getLngLat();

        // Intentar obtener dirección usando Google primero para mantener consistencia
        try {
          const googleAddress = await googleReverseGeocode(
            lngLat.lng,
            lngLat.lat,
          );

          const updatedData = {
            latitude: parseFloat(String(lngLat.lat)),
            longitude: parseFloat(String(lngLat.lng)),
            locationAddress: googleAddress,
            locationName:
              googleAddress.split(",")[0] || "Ubicación seleccionada",
          };

          console.log(
            "Actualizando ubicación tras arrastrar (Google):",
            updatedData,
          );
          setTempLocationData(updatedData);

          toast({
            title: "Ubicación actualizada",
            description: googleAddress,
          });
        } catch (error) {
          console.error(
            "Error obteniendo dirección de Google al arrastrar:",
            error,
          );

          // Fallback a MapBox si Google falla
          try {
            const mapboxAddress = await reverseGeocode(lngLat.lng, lngLat.lat);

            const fallbackData = {
              latitude: parseFloat(String(lngLat.lat)),
              longitude: parseFloat(String(lngLat.lng)),
              locationAddress: mapboxAddress,
              locationName:
                mapboxAddress.split(",")[0] || "Ubicación seleccionada",
            };

            console.log(
              "Actualizando ubicación tras arrastrar (Mapbox):",
              fallbackData,
            );
            setTempLocationData(fallbackData);

            toast({
              title: "Ubicación actualizada",
              description: mapboxAddress,
            });
          } catch (mapboxError) {
            console.error("Error también con Mapbox:", mapboxError);

            // Último recurso si ambos fallan
            const basicData = {
              latitude: parseFloat(String(lngLat.lat)),
              longitude: parseFloat(String(lngLat.lng)),
              locationAddress: "Dirección desconocida",
              locationName: "Lugar del evento",
            };

            console.log("Actualizando ubicación con datos básicos:", basicData);
            setTempLocationData(basicData);

            toast({
              title: "Ubicación actualizada",
              description: "No se pudo obtener la dirección exacta",
              variant: "destructive",
            });
          }
        }
      });
    }
  };

  // Function to reset location selection
  const resetLocationSelection = () => {
    console.log("Reseteando selección de ubicación");

    // Usar nuestra función más potente para eliminar todos los marcadores
    removeAllCustomMarkers();

    // Resetear también los datos de ubicación temporal
    setTempLocationData(null);
  };

  // Function to confirm location selection with verificación adicional
  const confirmLocationSelection = async () => {
    if (tempLocationData) {
      console.log("Confirmando ubicación original (Mapbox):", tempLocationData);

      try {
        // Verificar que todos los campos necesarios existen
        if (
          tempLocationData.latitude === undefined ||
          tempLocationData.longitude === undefined
        ) {
          console.error("Error: Coordenadas indefinidas", tempLocationData);
          toast({
            title: "Error al confirmar ubicación",
            description:
              "No se pudieron obtener las coordenadas. Por favor, intenta seleccionar otra ubicación.",
            variant: "destructive",
          });
          return;
        }

        // Intentar obtener la dirección usando Google Maps para consistencia
        const googleAddress = await googleReverseGeocode(
          tempLocationData.longitude,
          tempLocationData.latitude,
        );

        // Verificar y asignar valores por defecto para evitar undefined
        const locationName =
          tempLocationData.locationName || "Evento sin nombre";
        const locationAddress =
          googleAddress ||
          tempLocationData.locationAddress ||
          "Dirección desconocida";

        // Crear objeto de ubicación con formato correcto para Google Maps
        // Garantizamos explícitamente que las coordenadas son números
        const locationData = {
          latitude: Number(tempLocationData.latitude),
          longitude: Number(tempLocationData.longitude),
          locationAddress: locationAddress,
          locationName: locationName,
        };

        console.log("COORDENADAS CONFIRMADAS:", {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          tipoLat: typeof locationData.latitude,
          tipoLon: typeof locationData.longitude,
        });

        console.log("Ubicación reformateada para Google Maps:", locationData);

        // Call the function provided by parent to create event with the selected location
        if (typeof onCreateEventClick === "function") {
          onCreateEventClick(locationData);
        } else {
          console.error("Error: onCreateEventClick no es una función");
          toast({
            title: "Error al crear evento",
            description:
              "Hubo un problema al iniciar la creación del evento. Por favor, intenta nuevamente.",
            variant: "destructive",
          });
          return;
        }

        // Clean up
        resetLocationSelection();
        setLocationMode(false);

        toast({
          title: "Ubicación confirmada",
          description: "Ahora puedes completar los detalles del evento",
        });
      } catch (error) {
        console.error(
          "Error al convertir coordenadas para Google Maps:",
          error,
        );

        // Usar datos originales de Mapbox como fallback
        const fallbackLocationData = {
          latitude: Number(tempLocationData.latitude),
          longitude: Number(tempLocationData.longitude),
          locationAddress: tempLocationData.locationAddress,
          locationName: tempLocationData.locationName,
        };

        console.log("COORDENADAS FALLBACK:", {
          latitude: fallbackLocationData.latitude,
          longitude: fallbackLocationData.longitude,
          tipoLat: typeof fallbackLocationData.latitude,
          tipoLon: typeof fallbackLocationData.longitude,
        });

        console.log("Usando ubicación de fallback:", fallbackLocationData);
        onCreateEventClick(fallbackLocationData);

        resetLocationSelection();
        setLocationMode(false);

        toast({
          title: "Ubicación confirmada",
          description: "Ahora puedes completar los detalles del evento",
        });
      }
    } else {
      toast({
        title: "No hay ubicación seleccionada",
        description:
          "Haz clic en el mapa para seleccionar la ubicación del evento",
        variant: "destructive",
      });
    }
  };

  // Función para buscar eventos cercanos a la ubicación actual
  const handleSearchEventsAtLocation = () => {
    if (currentLocation && mapRef.current) {
      // Centrar el mapa en la ubicación seleccionada
      mapRef.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 15,
        essential: true,
        duration: 1000,
      });

      // Filtrar eventos por cercanía y por nombre
      if (currentLocation.locationName) {
        // Convertir a minúsculas para comparar
        const placeName = currentLocation.locationName.toLowerCase();

        console.log("Buscando eventos relacionados con:", placeName);

        // Filtrar eventos cercanos (radio de 2 km) o que contengan el nombre del lugar
        const baseNearbyEvents = events.filter((event: EventWithRelations) => {
          // Verificar si la ubicación está en el nombre o descripción del evento
          const nameMatch =
            event.title.toLowerCase().includes(placeName) ||
            (event.description && event.description.toLowerCase().includes(placeName)) ||
            (event.locationName && event.locationName.toLowerCase().includes(placeName));

          // Verificar distancia (si hay coordenadas válidas)
          let distanceMatch = false;
          const eventLat = typeof event.latitude === "string" ? parseFloat(event.latitude) : event.latitude;
          const eventLng = typeof event.longitude === "string" ? parseFloat(event.longitude) : event.longitude;

          if (!isNaN(eventLat) && !isNaN(eventLng)) {
            const distance = calculateDistance(currentLocation.lat, currentLocation.lng, eventLat, eventLng);
            const maxDistance = selectedDistance;
            distanceMatch = distance <= maxDistance;

            if (distanceMatch) {
              console.log(`Evento "${event.title}" está a ${distance.toFixed(2)} km`);
            }
          }

          // El evento coincide si está cerca o si contiene el nombre del lugar
          return nameMatch || distanceMatch;
        });

        // Aplicar filtros adicionales
        const nearbyEvents = applyEventFilters(baseNearbyEvents, currentLocation);

        console.log("Eventos cercanos o relacionados con", currentLocation.locationName, ":", nearbyEvents.length);

        // Actualizar el estado con los eventos filtrados
        setLocationFilteredEvents(nearbyEvents);

        // Si hay eventos, mostrar notificación con el número
        if (nearbyEvents.length > 0) {
          toast({
            title: `${nearbyEvents.length} eventos encontrados`,
            description: `Eventos cerca de ${currentLocation.locationName}`,
          });
        } else {
          toast({
            title: "No se encontraron eventos",
            description: `No hay eventos cerca de ${currentLocation.locationName}`,
            variant: "destructive",
          });
        }
      } else {
        // Si no hay nombre de ubicación, usar todos los eventos
        setLocationFilteredEvents(events);
      }

      // Mostrar panel de eventos
      setEventsPanelVisible(true);

      // Ocultar botones de acción
      setShowActionsForLocation(false);

      // Limpiar marcadores
      cleanupTempMarkers();

      // Importante: añadir un pequeño retraso para asegurar que no se quede el marcador
      // Este enfoque asegura que cualquier otro marcador que pudiera ser generado
      // por otras funciones también se elimine.
      setTimeout(() => {
        cleanupTempMarkers();
      }, 100);
    }
  };

  // Función para crear un evento en la ubicación actual
  const handleCreateEventAtCurrentLocation = async () => {
    console.log("Creando evento en la ubicación actual");

    // Limpiar TODOS los marcadores primero
    removeAllCustomMarkers();

    if (currentLocation) {
      try {
        // Intentar obtener más información sobre la ubicación
        const googleAddress = await googleReverseGeocode(
          currentLocation.lng,
          currentLocation.lat,
        );

        // Crear objeto de ubicación con el formato esperado
        const locationData = {
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          locationAddress:
            currentLocation.locationAddress ||
            googleAddress ||
            "Dirección desconocida",
          locationName:
            currentLocation.locationName ||
            googleAddress?.split(",")[0] ||
            "Lugar del evento",
        };

        console.log("Iniciando creación de evento con datos:", locationData);

        // Iniciar creación de evento
        onCreateEventClick(locationData);

        // Resetear estados
        resetLocationSelection();
        setShowActionsForLocation(false);
      } catch (error) {
        console.error("Error al preparar la ubicación para el evento:", error);

        // Usar los datos disponibles como fallback
        const fallbackData = {
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          locationAddress:
            currentLocation.locationAddress || "Dirección desconocida",
          locationName: currentLocation.locationName || "Lugar del evento",
        };

        console.log(
          "Usando datos de fallback para creación de evento:",
          fallbackData,
        );

        onCreateEventClick(fallbackData);

        // Resetear estados
        resetLocationSelection();
        setShowActionsForLocation(false);
      }
    }
  };

  // Handle going to user's current location
  const handleGoToCurrentLocation = async () => {
    if (!mapRef.current) return;

    try {
      const position = await getUserLocation(mapRef.current);
      const { longitude, latitude } = position.coords;

      console.log("Obtenida ubicación actual:", {
        latitude,
        longitude,
        tipo_lat: typeof latitude,
        tipo_lng: typeof longitude,
      });

      mapRef.current.flyTo({
        center: [longitude, latitude],
        zoom: 15,
        essential: true,
      });

      // If in location selection mode, set this as the location
      if (locationMode) {
        // Remove existing marker if any
        if (tempLocationMarker) {
          tempLocationMarker.remove();
        }

        // Create marker at current location
        const marker = new mapboxgl.Marker({
          color: "#FF5A5F",
          draggable: true,
        })
          .setLngLat([longitude, latitude])
          .addTo(mapRef.current);

        setTempLocationMarker(marker);

        // Intentar obtener la dirección usando Google Maps para mejor consistencia
        try {
          console.log("Solicitando dirección de Google para ubicación actual");
          const googleAddress = await googleReverseGeocode(longitude, latitude);
          console.log(
            "Google devolvió dirección para ubicación actual:",
            googleAddress,
          );

          // Extract place name
          const locationName =
            googleAddress.split(",")[0] || "Lugar del evento";

          // Store location data
          const locationData = {
            latitude: parseFloat(String(latitude)),
            longitude: parseFloat(String(longitude)),
            locationAddress: googleAddress,
            locationName: locationName,
          };

          console.log(
            "Guardando datos de ubicación actual (Google):",
            locationData,
          );
          setTempLocationData(locationData);

          toast({
            title: "Ubicación seleccionada",
            description: googleAddress,
          });
        } catch (googleError) {
          console.error(
            "Error obteniendo dirección de Google para ubicación actual:",
            googleError,
          );

          // Fallback a Mapbox si Google falla
          try {
            console.log("Intentando obtener dirección con Mapbox");
            const mapboxAddress = await reverseGeocode(longitude, latitude);

            // Extract place name
            const locationName =
              mapboxAddress.split(",")[0] || "Lugar del evento";

            // Store location data
            const fallbackData = {
              latitude: parseFloat(String(latitude)),
              longitude: parseFloat(String(longitude)),
              locationAddress: mapboxAddress,
              locationName: locationName,
            };

            console.log(
              "Guardando datos de ubicación actual (Mapbox):",
              fallbackData,
            );
            setTempLocationData(fallbackData);

            toast({
              title: "Ubicación seleccionada",
              description: mapboxAddress,
            });
          } catch (mapboxError) {
            console.error("También falló Mapbox:", mapboxError);

            // Último recurso: datos básicos sin dirección
            const basicData = {
              latitude: parseFloat(String(latitude)),
              longitude: parseFloat(String(longitude)),
              locationAddress: "Dirección desconocida",
              locationName: "Lugar del evento",
            };

            console.log("Guardando datos de ubicación básicos:", basicData);
            setTempLocationData(basicData);

            toast({
              title: "Ubicación seleccionada",
              description:
                "No se pudo obtener la dirección. La ubicación ha sido seleccionada, pero sin dirección.",
              variant: "destructive",
            });
          }
        }
      } else {
        // Just add a marker for current location if not in selection mode
        new mapboxgl.Marker({ color: "#1DA1F2" })
          .setLngLat([longitude, latitude])
          .addTo(mapRef.current);

        toast({
          title: "Ubicación Actualizada",
          description: "Mapa centrado en tu ubicación actual",
        });
      }
    } catch (error) {
      console.error("Error getting location:", error);
      toast({
        title: "Error de Ubicación",
        description: "No se pudo acceder a tu ubicación",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative flex-1 h-full w-full bg-neutral-100 overflow-hidden">
      {/* Map Container - Shows either traditional Mapbox or new 3D Snap Map */}
      {isSnapMap3D ? (
        <div className="absolute top-0 left-0 right-0 bottom-0 z-0">
          <PipolMap 
            events={adaptEventsForMap3D(mapEvents)}
            center={[
              mapStateRef.current?.currentCenter?.lng || -64.185,
              mapStateRef.current?.currentCenter?.lat || -31.428
            ]}
            onEventClick={handleEventSelect}
          />
        </div>
      ) : (
        <div
          ref={mapContainerRef}
          id="map-container"
          className="absolute top-0 left-0 right-0 bottom-0 z-0 map-container"
        ></div>
      )}

      {/* Events Panel - Only visible when eventsPanelVisible is true */}
      <AnimatePresence>
        {eventsPanelVisible && (
          <>
            {/* Semi-transparent background overlay with backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999]"
              onClick={() => {
                setEventsPanelVisible(false);
                cleanupTempMarkers();
              }}
            />

            {/* Events panel with glassy effect */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ 
                type: "spring",
                damping: 25,
                stiffness: 300,
                duration: 0.3
              }}
              className="fixed inset-0 flex items-center justify-center z-[99999] p-4 pointer-events-none"
            >
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-white/20 pointer-events-auto">
                {/* Header with glassy effect */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5"
                >
                  <h2 className="text-lg font-bold text-white">
                    Descubrir eventos
                  </h2>
                  <button
                    onClick={() => {
                      setEventsPanelVisible(false);
                      cleanupTempMarkers();
                    }}
                    className="p-1 rounded-full hover:bg-white/20 transition-all duration-200 text-white/80 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </motion.div>

                {/* Filters Section */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                  className="p-2 border-b border-white/10 bg-white/5 flex-shrink-0"
                >
                  <div className="space-y-1.5">
                    {/* Compact Filter Grid */}
                    <div className="space-y-2">
                      {/* First Row: Para and Fecha */}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={selectedGender}
                          onChange={(e) => setSelectedGender(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 backdrop-blur-md shadow-lg"
                        >
                          <option value="todos" className="bg-gray-800">
                            Todos
                          </option>
                          <option value="men" className="bg-gray-800">
                            Hombres
                          </option>
                          <option value="women" className="bg-gray-800">
                            Mujeres
                          </option>
                        </select>
                        
                        <select
                          value={selectedDateFilter}
                          onChange={(e) => setSelectedDateFilter(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 backdrop-blur-md shadow-lg"
                        >
                          <option value="all" className="bg-gray-800">
                            Todas las fechas
                          </option>
                          <option value="today" className="bg-gray-800">
                            Hoy
                          </option>
                          <option value="tomorrow" className="bg-gray-800">
                            Mañana
                          </option>
                          <option value="weekend" className="bg-gray-800">
                            Fin de semana
                          </option>
                          <option value="week" className="bg-gray-800">
                            Esta semana
                          </option>
                          <option value="month" className="bg-gray-800">
                            Este mes
                          </option>
                          <option value="next_months" className="bg-gray-800">
                            Próximos meses
                          </option>
                        </select>
                      </div>

                      {/* Second Row: Tema and Limpiar Filtros */}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 backdrop-blur-md shadow-lg"
                        >
                          <option value="all" className="bg-gray-800">
                            Todos los temas
                          </option>
                          <option value="social" className="bg-gray-800">
                            Social
                          </option>
                          <option value="music" className="bg-gray-800">
                            Música
                          </option>
                          <option value="sports" className="bg-gray-800">
                            Deportes
                          </option>
                          <option value="food" className="bg-gray-800">
                            Comida
                          </option>
                          <option value="art" className="bg-gray-800">
                            Arte
                          </option>
                          <option value="party" className="bg-gray-800">
                            Fiestas
                          </option>
                          <option value="education" className="bg-gray-800">
                            Educación
                          </option>
                          <option value="technology" className="bg-gray-800">
                            Tecnología
                          </option>
                        </select>

                        <button
                          onClick={() => {
                            setSelectedGender("todos");
                            setSelectedCategory("all");
                            setSelectedDistance(100);
                            setSelectedDateFilter("all");
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white/10 text-white/90 border border-white/20 hover:bg-white/20 transition-all duration-200 text-sm font-medium backdrop-blur-md shadow-lg"
                        >
                          Limpiar Filtros
                        </button>
                      </div>

                      {/* Distance Filter - More Compact */}
                      <div className="flex items-center gap-3">
                        <span className="text-white/80 text-sm font-medium whitespace-nowrap">
                          Distancia:
                        </span>
                        <div className="flex-1">
                          <Slider
                            value={[
                              (() => {
                                const distanceOptions = [
                                  1, 5, 10, 20, 50, 80, 100,
                                ];
                                return distanceOptions.indexOf(selectedDistance);
                              })(),
                            ]}
                            onValueChange={(values) => {
                              const distanceOptions = [1, 5, 10, 20, 50, 80, 100];
                              setSelectedDistance(distanceOptions[values[0]]);
                            }}
                            max={6}
                            min={0}
                            step={1}
                            className="slider-distance w-full"
                          />
                        </div>
                        <span className="text-white/80 text-sm font-medium whitespace-nowrap">
                          {selectedDistance >= 100 ? '+100km' : selectedDistance >= 80 ? '+80km' : selectedDistance >= 50 ? '+50km' : `${selectedDistance}km`}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Events List with scroll */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="flex-1 overflow-y-auto bg-white/5 backdrop-blur-xl events-scroll-container p-3"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.3) transparent",
                    WebkitOverflowScrolling: "touch",
                    minHeight: "300px",
                    maxHeight: "calc(85vh - 140px)", // Optimized for mobile and desktop
                  }}
                >
                  {(() => {
                    // Apply filtering ONLY for the panel view using our dedicated function
                    const panelFilteredEvents = getFilteredEventsForPanel();

                    return isLoading ? (
                      <div className="flex justify-center items-center py-8">
                        <div className="animate-spin w-8 h-8 border-4 border-white/30 border-t-white rounded-full" />
                      </div>
                    ) : panelFilteredEvents.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 pb-20">
                        {panelFilteredEvents.map(
                          (event: EventWithRelations) => (
                            <Card
                              key={event.id}
                              className="shadow-sm cursor-pointer hover:bg-white/5 transition-all duration-200 bg-white/10 backdrop-blur rounded-xl border border-white/20 flex flex-row overflow-hidden h-[90px]"
                              onClick={() => {
                                // Asegurarse de que latitude y longitude sean números antes de pasar el evento
                                const formattedEvent = {
                                  ...event,
                                  latitude:
                                    typeof event.latitude === "string"
                                      ? parseFloat(event.latitude)
                                      : event.latitude,
                                  longitude:
                                    typeof event.longitude === "string"
                                      ? parseFloat(event.longitude)
                                      : event.longitude,
                                };

                                // Activate focused mode when event is selected
                                setIsFocusedMode(true);
                                onEventSelect(formattedEvent);
                                setEventsPanelVisible(false);
                              }}
                            >
                              <div className="flex-shrink-0 w-24 h-[90px]">
                                <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-l-xl overflow-hidden">
                                  {event.mainMediaUrl ? (
                                    <img 
                                      src={event.mainMediaUrl} 
                                      alt={event.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="text-lg">
                                      {getCategoryEmoji(event.category)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 p-3">
                                <div className="text-xs font-semibold uppercase text-white/60 mb-1">
                                  {event.category}
                                </div>
                                <h3 className="font-bold text-sm truncate text-white">
                                  {event.title}
                                </h3>
                                <p className="text-xs text-white/70 truncate">
                                  {event.locationName}
                                </p>
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-white/60">
                                    {new Date(event.date).toLocaleDateString(
                                      "es-ES",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </p>
                                  {currentLocation && (() => {
                                    const eventLat = typeof event.latitude === "string" ? parseFloat(event.latitude) : event.latitude;
                                    const eventLng = typeof event.longitude === "string" ? parseFloat(event.longitude) : event.longitude;
                                    
                                    if (!isNaN(eventLat) && !isNaN(eventLng)) {
                                      const distance = calculateDistance(currentLocation.lat, currentLocation.lng, eventLat, eventLng);
                                      return (
                                        <p className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">
                                          {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                                        </p>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>
                            </Card>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="w-full text-center py-8 text-white/80">
                        <p>No hay eventos que coincidan con tus filtros</p>
                        <p className="text-sm text-white/60">
                          Intenta con otros filtros o cambia de ubicación
                        </p>
                      </div>
                    );
                  })()}
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Search Bars - Ocultar en modo focalizado */}
      {!isFocusedMode && (
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2">
        {/* Barra de búsqueda principal con filtros */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <GooglePlacesSearch
              onPlaceSelect={handlePlaceSelect}
              onEventSelect={onEventSelect}
              placeholder="Buscar lugares con Google Maps..."
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full bg-white"
            onClick={async () => {
              // Auto-detect user location when opening filters for better distance filtering
              if (!filtersVisible && !currentLocation) {
                await detectUserLocation();
              }
              setFiltersVisible(!filtersVisible);
            }}
          >
            <Filter className="h-5 w-5" />
          </Button>
        </div>

        {/* Barra de búsqueda de MapBox como fallback (temporal) */}
        {false && (
          <SearchBar
            onSearch={handleSearch}
            onFilterClick={() => setFiltersVisible(!filtersVisible)}
            onPlaceSelect={locationMode ? handlePlaceSelect : undefined}
          />
        )}
        </div>
      )}

      {/* Filters Panel */}
      {filtersVisible && (
        <EventFilters
          onClose={() => setFiltersVisible(false)}
          onApply={(newFilters) => {
            // Apply category filter
            if (newFilters.categories.length > 0) {
              setSelectedCategory(newFilters.categories[0]); // Use first selected category
            } else {
              setSelectedCategory("all");
            }

            // Apply date filter
            setSelectedDateFilter(newFilters.dateFilter);

            // Apply distance filter
            setSelectedDistance(newFilters.distance);

            // Apply gender filter
            setSelectedGender(newFilters.genderFilter);

            // Apply the new filters to the parent component if needed
            if (filters && typeof filters === "object") {
              // Update category filter
              if (newFilters.categories.length > 0) {
                filters.category = newFilters.categories;
              } else {
                delete filters.category;
              }

              // Update payment type filter
              if (newFilters.paymentTypes.length > 0) {
                filters.paymentType = newFilters.paymentTypes;
              } else {
                delete filters.paymentType;
              }

              // Update date filter
              if (newFilters.dateFilter !== "all") {
                filters.date = newFilters.dateFilter;
              } else {
                delete filters.date;
              }

              // Update distance filter
              filters.distance = newFilters.distance;

              // Update gender filter (if genderFilter property exists)
              if (newFilters.genderFilter !== "todos") {
                (filters as any).genderFilter = newFilters.genderFilter;
              } else {
                delete (filters as any).genderFilter;
              }
            }

            // Close the filters panel
            setFiltersVisible(false);
            toast({
              title: "Filtros aplicados",
              description:
                "Los eventos han sido filtrados según tus preferencias",
            });
          }}
        />
      )}

      {/* Location Selection Mode Indicator */}
      {locationMode && (
        <div className="absolute top-16 left-0 right-0 z-20 flex justify-center">
          <div className="bg-primary text-white px-4 py-2 rounded-full shadow-lg">
            <span className="text-sm font-medium">
              Selecciona la ubicación para el evento
            </span>
          </div>
        </div>
      )}

      {/* Menú contextual cuando se hace clic en el mapa */}
      {contextMenu.visible && (
        <div
          className="absolute z-40 bg-white rounded-lg shadow-lg p-2 min-w-[180px] context-menu"
          style={{
            top: contextMenu.y - 10,
            left: contextMenu.x,
            transform: "translate(-50%, -100%)",
          }}
          onClick={(e) => {
            // Evitar que se cierre el menú al hacer clic en él
            e.stopPropagation();
          }}
        >
          <div className="flex flex-col">
            {/* Título */}
            <div className="p-2 text-center border-b border-gray-200">
              <span className="text-sm font-medium">¿Qué quieres hacer?</span>
            </div>

            {/* Opciones */}
            <button
              className="p-2 text-left hover:bg-gray-100 text-sm flex items-center gap-2"
              onClick={handleFindNearbyEvents}
            >
              <Compass size={16} />
              Ver eventos cercanos
            </button>

            <button
              className="p-2 text-left hover:bg-gray-100 text-sm flex items-center gap-2"
              onClick={handleCreateEventAtLocation}
            >
              <Plus size={16} />
              Crear evento aquí
            </button>

            <button
              className="p-2 text-left hover:bg-gray-100 text-sm flex items-center gap-2"
              onClick={closeContextMenu}
            >
              <X size={16} />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Solo mostramos el encabezado de selección sin la tarjeta de información */}

      {/* Control buttons - map group (vertical layout) */}
      <div className="absolute top-[90px] left-4 flex flex-col gap-3">
        {/* 3D/2D Toggle Button (Traditional Mapbox) */}
        {!isSnapMap3D && (
          <button
            className="p-3 bg-white rounded-full shadow-card text-neutral-700 border border-neutral-200 hover:bg-gray-50 flex items-center justify-center"
            onClick={handleToggleMapView}
            title={is3DMode ? "Cambiar a vista 2D" : "Cambiar a vista 3D"}
            aria-label={is3DMode ? "Cambiar a vista 2D" : "Cambiar a vista 3D"}
          >
            {is3DMode ? <Building2 size={22} /> : <Globe size={22} />}
          </button>
        )}

        {/* Notifications Button */}
        {user && (
          <button
            onClick={() => setShowNotifications(true)}
            className="p-3 bg-white rounded-full shadow-card text-neutral-700 border border-neutral-200 hover:bg-gray-50 flex items-center justify-center relative"
            title="Notificaciones"
            aria-label="Ver notificaciones"
          >
            <Bell size={22} />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </button>
        )}

        {/* Current Location Button */}
        <button
          className="p-3 bg-white rounded-full shadow-card text-neutral-700 border border-neutral-200 hover:bg-gray-50 flex items-center justify-center"
          onClick={handleGoToCurrentLocation}
          title="Ir a mi ubicación"
          aria-label="Ir a mi ubicación actual"
        >
          <MapPin size={22} />
        </button>
      </div>

      {/* Map Configuration Panel */}
      <MapConfigPanel
        map={mapRef.current}
        isOpen={configPanelVisible}
        onClose={() => setConfigPanelVisible(false)}
        onConfigChange={(config) => {
          setMapConfig((prev) => ({ ...prev, ...config }));

          // Apply settings to map if available
          if (mapRef.current) {
            applyMapConfig(mapRef.current, config);
          }
        }}
        config={mapConfig}
        is3DMode={is3DMode}
      />

      {/* Main action buttons - Positioned above tab bar, ocultar en modo focalizado */}
      {!isFocusedMode && (
        <div className="absolute bottom-[120px] left-0 right-0 z-10 flex justify-center gap-4 px-6">
        {contextMenu.visible ? (
          // Botones cuando hay un menú contextual activo
          <>
            {/* Cancel Button */}
            <button
              className="flex-1 py-3 bg-white rounded-xl shadow-lg text-red-600 border border-neutral-200 flex items-center justify-center gap-2 font-medium"
              onClick={closeContextMenu}
            >
              <X size={20} />
              Cancelar
            </button>

            {/* Crear Evento Aquí Button */}
            <button
              className="flex-1 py-3 bg-primary rounded-xl shadow-lg text-white flex items-center justify-center gap-2 font-medium"
              onClick={handleCreateEventAtLocation}
            >
              <Plus size={20} />
              Crear un evento aquí
            </button>
          </>
        ) : showActionsForLocation ? (
          // Botones específicos para la ubicación buscada
          <>
            {/* Buscar Eventos Cercanos */}
            <button
              className="flex-1 py-3 bg-white rounded-xl shadow-lg text-neutral-700 border border-neutral-200 flex items-center justify-center gap-2 font-medium"
              onClick={handleSearchEventsAtLocation}
            >
              <Compass size={20} />
              Buscar eventos aquí
            </button>

            {/* Crear Evento Aquí */}
            <button
              className="flex-1 py-3 bg-primary rounded-xl shadow-lg text-white flex items-center justify-center gap-2 font-medium"
              onClick={handleCreateEventAtCurrentLocation}
            >
              <Plus size={20} />
              Crear un evento aquí
            </button>
          </>
        ) : !locationMode ? (
          // Botones normales
          <>
            {/* Discover Events Button */}
            <button
              className="flex-1 py-3 bg-white rounded-xl shadow-lg text-neutral-700 border border-neutral-200 flex items-center justify-center gap-2 text-sm font-medium"
              onClick={async () => {
                console.log("Botón Descubrir eventos clickeado");
                setEventsPanelVisible(!eventsPanelVisible);
                // Detectar ubicación inmediatamente al abrir el panel
                if (!eventsPanelVisible && !currentLocation) {
                  await detectUserLocation();
                }
              }}
            >
              {isDetectingLocation ? (
                <div className="animate-spin w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full" />
              ) : (
                <Compass size={18} />
              )}
              {isDetectingLocation ? "Detectando ubicación..." : "Descubrir eventos"}
            </button>

            {/* Create Event Button */}
            <button
              className="flex-1 py-3 bg-primary rounded-xl shadow-lg text-white flex items-center justify-center gap-2 text-sm font-medium"
              onClick={toggleLocationMode}
            >
              <Plus size={18} />
              Crear un evento
            </button>
          </>
        ) : (
          // Botones para modo de selección de ubicación
          <>
            {/* Cancel Location Selection */}
            <button
              className="flex-1 py-3 bg-white rounded-xl shadow-lg text-red-600 border border-neutral-200 flex items-center justify-center gap-2 font-medium"
              onClick={() => {
                setLocationMode(false);
                resetLocationSelection();
              }}
            >
              <X size={20} />
              Cancelar
            </button>

            {/* Confirm Location Button */}
            <button
              className="flex-1 py-3 bg-primary rounded-xl shadow-lg text-white flex items-center justify-center gap-2 font-medium"
              onClick={confirmLocationSelection}
              disabled={!tempLocationData}
            >
              <Check size={20} />
              Crear un evento aquí
            </button>
          </>
        )}
        </div>
      )}

      {/* Panel deslizante para editar eventos (similar a event-detail-sheet) */}
      {editingEventId !== null && editSheetVisible && (
        <EditEventSheet
          eventId={editingEventId}
          isOpen={editSheetVisible}
          onClose={() => {
            setEditSheetVisible(false);
            setEditingEventId(null);
          }}
        />
      )}

      {/* Notifications Panel */}
      {showNotifications && (
        <NotificationsPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
};

export default MapView;
