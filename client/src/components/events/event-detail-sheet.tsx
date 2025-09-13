import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useAnimation } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  CalendarIcon,
  MapPin,
  Users,
  X,
  MessageSquare,
  Share2,
  UserPlus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNavigation } from "@/contexts/navigation-context";
import { useUserProfile } from "@/contexts/user-profile-context";
import { useZIndex } from "@/contexts/z-index-context";
import { useMap } from "@/contexts/MapContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Chat from "@/components/chat/chat";
import EventRequests from "@/components/events/event-requests";
import EditEventForm from "@/components/events/edit-event-form";
import EditEventSheet from "@/components/events/edit-event-sheet";
import { formatPrice, formatAccessType } from "@/lib/stripe";
import mapboxgl from "mapbox-gl";
import useEmblaCarousel from "embla-carousel-react";

// Declare Google Maps types for TypeScript
declare global {
  interface Window {
    google: any;
  }
}

type EventDetailSheetProps = {
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
    maxCapacity?: number;
    privacyType: string;
    genderPreference?: string;
    longitude?: number | string;
    latitude?: number | string;
    photoUrl?: string;
    photo_url?: string;
    videoUrl?: string;
    video_url?: string;
    // Campos multimedia nuevos
    mediaItems?: string; // JSON string de items multimedia
    mainMediaType?: string; // Tipo del medio principal ('photo' o 'video')
    mainMediaUrl?: string; // URL del medio principal
    // Campos de la base de datos (formato snake_case)
    main_media_type?: string;
    main_media_url?: string;
    organizerId: number; // ID del organizador
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
  } | null;
  onClose: () => void;
  visible: boolean;
  onEventUpdated?: () => void;
  openedFromChat?: boolean; // Indica si se abrió desde el chat
};

const EventDetailSheet = ({
  event: initialEvent,
  onClose,
  visible,
  onEventUpdated,
  openedFromChat = false,
}: EventDetailSheetProps) => {
  console.log(
    "🎯 EventDetailSheet: Component rendered with visible =",
    visible,
    "event =",
    initialEvent ? "present" : "null",
  );

  // Early return MUST be before any hooks - only check visible state for immediate closure
  if (!visible) {
    console.log(
      "🎯 EventDetailSheet: Early return - visible =",
      visible,
      "event =",
      initialEvent ? "present" : "null",
    );
    return null;
  }

  // Additional check for missing event after visible check
  if (!initialEvent) {
    console.log("🎯 EventDetailSheet: Early return - missing event");
    return null;
  }

  // Use initialEvent for the rest of the component (non-null after early return)
  const currentEvent = initialEvent;

  const { user } = useAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const { hideNavigation, showNavigation } = useNavigation();
  const { showUserProfile } = useUserProfile();
  const { getNextZIndex } = useZIndex();
  const { restoreCameraState } = useMap();
  const [chatVisible, setChatVisible] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [editFormVisible, setEditFormVisible] = useState(false);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [event, setEvent] = useState(initialEvent);
  const [locationName, setLocationName] = useState<string>("");
  const [showAllAttendees, setShowAllAttendees] = useState(false);
  const [currentZIndex, setCurrentZIndex] = useState(100);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isComingFromChat, setIsComingFromChat] = useState(false);
  const [panelHeight, setPanelHeight] = useState(78); // Percentage height - Fixed at 78%
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(78);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const detailPanelControls = useAnimation();

  // Validar asistentes y estado de asistencia
  const safeAttendees = currentEvent?.attendees || [];
  const [isAttending, setIsAttending] = useState(false);

  // Debug logs para verificar los asistentes
  console.log("🎯 EventDetailSheet - Debug de asistentes:");
  console.log("currentEvent:", currentEvent);
  console.log("currentEvent.attendees:", currentEvent?.attendees);
  console.log("safeAttendees:", safeAttendees);
  console.log("safeAttendees.length:", safeAttendees.length);

  // Enhanced close handler that restores camera state before closing
  const handleClose = () => {
    console.log("🔄 EventDetailSheet: ANTES de restaurar estado de cámara");
    restoreCameraState();
    console.log("🔄 EventDetailSheet: DESPUÉS de restaurar estado de cámara");
    onClose();
  };

  // Control navigation visibility and z-index with premium animations
  useEffect(() => {
    console.log("🎯 EventDetailSheet: Component effect, visible =", visible);
    if (visible && !hasAnimated && !isComingFromChat) {
      console.log("🎯 EventDetailSheet: Hiding navigation");
      hideNavigation();
      setHasAnimated(true);
      
      // Get new z-index when becoming visible
      const newZIndex = getNextZIndex();
      setCurrentZIndex(newZIndex);
      console.log(`🎯 EventDetailSheet opened with z-index: ${newZIndex}`);
    } else if (!visible && hasAnimated) {
      setHasAnimated(false);
      showNavigation();
    }

    // Cleanup to restore navigation when component unmounts or becomes invisible
    return () => {
      if (hasAnimated && !isComingFromChat) {
        console.log("🎯 EventDetailSheet: Cleanup - Showing navigation");
        showNavigation();
      }
    };
  }, [visible, hasAnimated, isComingFromChat, hideNavigation, showNavigation, getNextZIndex]);

  // Actualizar el evento cuando cambia initialEvent
  useEffect(() => {
    setEvent(initialEvent);
  }, [initialEvent]);

  // Asegurarse de que la fecha sea válida
  const eventDate = currentEvent.date
    ? new Date(currentEvent.date)
    : new Date();

  // Escuchar el evento personalizado 'event-updated'
  useEffect(() => {
    const handleEventUpdate = (e: CustomEvent) => {
      const { eventId, data } = e.detail;

      // Verificar si este es nuestro evento
      if (eventId === currentEvent.id && data) {
        console.log(
          "Actualizando datos del evento en el panel de detalles mediante evento personalizado:",
          data,
        );
        setEvent(data);

        // Adicionalmente, podríamos invalidar consultas de react-query si estamos usando esa librería
        import("@/lib/queryClient").then(({ queryClient }) => {
          queryClient.invalidateQueries({ queryKey: ["/api/events"] });
          queryClient.invalidateQueries({
            queryKey: [`/api/events/${eventId}`],
          });
        });
      }
    };

    // Agregar el listener
    window.addEventListener(
      "event-updated",
      handleEventUpdate as EventListener,
    );

    // Limpiar al desmontar
    return () => {
      window.removeEventListener(
        "event-updated",
        handleEventUpdate as EventListener,
      );
    };
  }, [currentEvent.id]);

  // Verificar si el usuario está asistiendo al evento usando la API
  useEffect(() => {
    if (user && currentEvent.id) {
      // Si el usuario es el organizador, automáticamente está "asistiendo"
      const userIsOrganizer =
        currentEvent.organizerId === parseInt(String(user.id)) ||
        currentEvent.organizer?.id === parseInt(String(user.id));

      if (userIsOrganizer) {
        setIsAttending(true);
        console.log("Usuario es organizador, automáticamente asistiendo");
        return;
      }

      const checkAttendanceStatus = async () => {
        try {
          const res = await fetch(`/api/events/${currentEvent.id}/status`, {
            method: "GET",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (res.ok) {
            const data = await res.json();
            // Si el usuario es organizador según la API, también está asistiendo
            if (data.isOrganizer) {
              setIsAttending(true);
              console.log(
                "Usuario es organizador según la API, automáticamente asistiendo",
              );
            } else if (data.isAttending) {
              setIsAttending(true);
              console.log("Usuario está asistiendo al evento según la API");
            } else {
              setIsAttending(false);
              console.log("Usuario no está asistiendo al evento según la API");
            }
          } else if (res.status === 404) {
            // Si la API responde con 404, el usuario no está asistiendo
            setIsAttending(false);
            console.log("Usuario no está asistiendo al evento según la API");
          }
        } catch (error) {
          console.error("Error verificando asistencia:", error);
          setIsAttending(false);
        }
      };

      checkAttendanceStatus();
    }
  }, [
    user,
    currentEvent.id,
    currentEvent.organizerId,
    currentEvent.organizer?.id,
  ]);

  // Validar organizador - usar organizerId como fuente primaria
  const isOrganizer =
    user &&
    (currentEvent.organizerId === parseInt(String(user.id)) ||
      currentEvent.organizer?.id === parseInt(String(user.id)));

  // Calcular capacidad y conteo
  const spotsLeft = currentEvent.maxCapacity
    ? currentEvent.maxCapacity - (safeAttendees.length || 0)
    : null;
  const attendeeCount = safeAttendees.length || 0;

  // Fetch location name from Google Maps geocoding
  useEffect(() => {
    const fetchLocationName = async () => {
      if (!currentEvent.latitude || !currentEvent.longitude) return;

      try {
        const lat =
          typeof currentEvent.latitude === "string"
            ? parseFloat(currentEvent.latitude)
            : currentEvent.latitude;
        const lng =
          typeof currentEvent.longitude === "string"
            ? parseFloat(currentEvent.longitude)
            : currentEvent.longitude;

        const response = await fetch(
          `/api/google-proxy/geocode/json?latlng=${lat},${lng}`,
        );
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          // Get the formatted address from the first result
          const formattedAddress = data.results[0].formatted_address;
          setLocationName(formattedAddress);
        } else {
          console.log("No geocoding results found for coordinates:", {
            lat,
            lng,
          });
          setLocationName("Ubicación del evento");
        }
      } catch (error) {
        console.error("Error fetching location name:", error);
        setLocationName("Ubicación del evento");
      }
    };

    if (visible) {
      fetchLocationName();
    }
  }, [visible, currentEvent.latitude, currentEvent.longitude]);

  // Reset map loaded state when event changes
  useEffect(() => {
    setMapLoaded(false);
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, [currentEvent.id]);

  // Inicializar el mapa cuando el componente sea visible
  useEffect(() => {
    if (
      !visible ||
      !mapContainerRef.current ||
      mapLoaded ||
      !currentEvent.latitude ||
      !currentEvent.longitude
    )
      return;

    const initializeMap = async () => {
      // Try to get Mapbox token from server
      let mapboxToken: string | null = null;
      try {
        const tokenResponse = await fetch("/api/mapbox-token");
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          mapboxToken = tokenData.token;
        }
      } catch (error) {
        console.log("Could not fetch Mapbox token:", error);
      }

      // Extraer las coordenadas desde los datos del evento y garantizar que son números
      const location = {
        longitude:
          typeof currentEvent.longitude === "string"
            ? parseFloat(currentEvent.longitude)
            : currentEvent.longitude,
        latitude:
          typeof currentEvent.latitude === "string"
            ? parseFloat(currentEvent.latitude)
            : currentEvent.latitude,
      };

      try {
        const lng = Number(location.longitude);
        const lat = Number(location.latitude);

        if (isNaN(lng) || isNaN(lat)) {
          console.error("Invalid coordinates:", { lat, lng });
          return;
        }

        console.log("Initializing map with coordinates:", { lat, lng });

        // Use Google Maps instead of Mapbox for better integration
        if (mapContainerRef.current) {
          const initGoogleMap = () => {
            if (mapContainerRef.current && window.google) {
              const map = new window.google.maps.Map(mapContainerRef.current, {
                center: { lat, lng },
                zoom: 15,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
              });

              // Add marker identical to Google's default blue but in yellow
              new window.google.maps.Marker({
                position: { lat, lng },
                map: map,
                icon: {
                  url:
                    "data:image/svg+xml;charset=UTF-8," +
                    encodeURIComponent(`
                  <svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.563 12.5 41 12.5 41S25 21.563 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="#FFEB3B"/>
                    <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.563 12.5 41 12.5 41S25 21.563 25 12.5C25 5.596 19.404 0 12.5 0Z" stroke="#000000" stroke-width="1"/>
                    <circle cx="12.5" cy="12.5" r="4" fill="white" stroke="#000000" stroke-width="1"/>
                  </svg>
                `),
                  scaledSize: new window.google.maps.Size(25, 41),
                  anchor: new window.google.maps.Point(12.5, 41),
                },
              });

              setMapLoaded(true);
            }
          };

          // Load Google Maps script dynamically
          if (!window.google) {
            fetch("/api/google-maps-key")
              .then((response) => response.json())
              .then((apiKey) => {
                const script = document.createElement("script");
                script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
                script.onload = initGoogleMap;
                document.head.appendChild(script);
              })
              .catch((error) => {
                console.error("Error loading Google Maps:", error);
                // Fallback to simple display
                if (mapContainerRef.current) {
                  mapContainerRef.current.innerHTML = `
                  <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f5f5f5; border-radius: 8px;">
                    <div style="text-align: center;">
                      <div style="font-size: 16px; color: #666; margin-bottom: 8px;">📍 Ubicación del evento</div>
                      <button onclick="window.open('https://www.google.com/maps?q=${lat},${lng}', '_blank')" 
                              style="padding: 8px 16px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Ver en Google Maps
                      </button>
                    </div>
                  </div>
                `;
                }
                setMapLoaded(true);
              });
          } else {
            initGoogleMap();
          }
        }
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    };

    initializeMap();
  }, [
    visible,
    currentEvent.id,
    currentEvent.latitude,
    currentEvent.longitude,
    mapLoaded,
  ]);

  const [joinRequestStatus, setJoinRequestStatus] = useState<string | null>(
    null,
  );

  // Check if user has a pending request for this event
  useEffect(() => {
    if (user && event && !isAttending && !isOrganizer) {
      const checkPendingRequest = async () => {
        try {
          const res = await apiRequest(
            "GET",
            `/api/events/${currentEvent.id}/status`,
          );
          if (res.ok) {
            const data = await res.json();
            if (data.status === "pending") {
              setJoinRequestStatus("pending");
            }
          }
        } catch (error) {
          console.error("Error checking request status:", error);
        }
      };

      checkPendingRequest();
    }
  }, [user, event, isAttending, isOrganizer]);

  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicationAnswers, setApplicationAnswers] = useState<string[]>([]);

  const handleJoinEvent = async (answers?: string[]) => {
    if (!user) {
      toast({
        title: "Autenticación Requerida",
        description: "Por favor inicia sesión para unirte a este evento",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    // Check if this is a private event with special access requirements
    if (currentEvent.privacyType === 'private') {
      const privateAccessType = (currentEvent as any).privateAccessType || (currentEvent as any).private_access_type;
      
      if (privateAccessType === 'postulacion' && !answers) {
        // Show application form for "postulación" events
        setShowApplicationForm(true);
        return;
      }
      
      if (privateAccessType === 'paga') {
        // Handle payment for "solo de pago" events
        try {
          const res = await apiRequest(
            "POST",
            `/api/events/${currentEvent.id}/pay`,
          );

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Error al procesar el pago");
          }

          const data = await res.json();
          
          if (data.paymentSuccess) {
            toast({
              title: "¡Pago Exitoso!",
              description: "Te has unido al evento después del pago.",
            });

            // Update attendance status
            import("@/lib/queryClient").then(({ queryClient }) => {
              queryClient.invalidateQueries({ queryKey: ["/api/events"] });
              setIsAttending(true);
            });
            return;
          }
        } catch (error) {
          console.error("Error processing payment:", error);
          toast({
            title: "Error de Pago",
            description: error instanceof Error ? error.message : "No se pudo procesar el pago.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    try {
      const requestBody = answers ? { answers } : {};
      
      const res = await apiRequest(
        "POST",
        `/api/events/${currentEvent.id}/join`,
        requestBody
      );

      if (!res.ok) {
        const errorData = await res.json();
        
        if (res.status === 402 && errorData.requiresPayment) {
          // This shouldn't happen now since we handle payment above, but keep as fallback
          toast({
            title: "Pago Requerido",
            description: "Este evento requiere pago para acceder.",
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(errorData.message || "Error al unirse al evento");
      }

      const data = await res.json();

      if (data.isPendingApproval) {
        setJoinRequestStatus("pending");
        setShowApplicationForm(false); // Close application form
        toast({
          title: "Solicitud Enviada",
          description: currentEvent.privacyType === 'private' && 
            ((currentEvent as any).privateAccessType === 'postulacion' || (currentEvent as any).private_access_type === 'postulacion')
            ? "Tu postulación ha sido enviada y está pendiente de revisión."
            : "Tu solicitud para unirte al evento ha sido enviada y está pendiente de aprobación.",
        });
        return;
      }

      toast({
        title: "¡Éxito!",
        description: "¡Te has unido al evento!",
      });

      // Actualizar datos sin recargar
      import("@/lib/queryClient").then(({ queryClient }) => {
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        // Verificar de nuevo el estado de asistencia
        setIsAttending(true);
      });
    } catch (error) {
      console.error("Error joining event:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo unir al evento. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  // Función para mostrar el perfil de un usuario
  const handleShowUserProfile = (attendee: any) => {
    if (attendee.user) {
      showUserProfile({
        id: attendee.user.id,
        name: attendee.user.name,
        email: attendee.user.email || `${attendee.user.name}@example.com`,
        avatar: attendee.user.avatar,
        username: attendee.user.username,
        bio: attendee.user.bio
      });
    }
  };

  const handleLeaveEvent = async () => {
    if (!user) {
      toast({
        title: "Autenticación Requerida",
        description: "Por favor inicia sesión para dejar este evento",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    // Mostrar confirmación antes de dejar el evento
    if (!window.confirm("¿Estás seguro que deseas dejar este evento?")) {
      return;
    }

    try {
      const res = await apiRequest(
        "DELETE",
        `/api/events/${currentEvent.id}/leave`,
      );

      if (res.ok) {
        toast({
          title: "¡Éxito!",
          description: "Has dejado el evento exitosamente",
        });

        // Actualizar datos sin recargar
        import("@/lib/queryClient").then(({ queryClient }) => {
          queryClient.invalidateQueries({ queryKey: ["/api/events"] });
          // Actualizar estado de asistencia
          setIsAttending(false);
          // Opcionalmente, cerrar el panel de detalles
          handleClose();
        });
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al dejar el evento");
      }
    } catch (error) {
      console.error("Error leaving event:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo dejar el evento. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  // Touch gesture handlers for panel manipulation
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!panelRef.current) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStartY(touch.clientY);
    setDragStartHeight(panelHeight);
    
    // Prevent scrolling while dragging
    document.body.style.overflow = 'hidden';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !panelRef.current) return;
    
    const touch = e.touches[0];
    const deltaY = dragStartY - touch.clientY;
    const viewportHeight = window.innerHeight;
    const heightChange = (deltaY / viewportHeight) * 100;
    
    let newHeight = dragStartHeight + heightChange;
    
    // Constrain between 25% and 90%
    newHeight = Math.max(25, Math.min(90, newHeight));
    
    setPanelHeight(newHeight);
    
    // Prevent default to stop page scrolling
    e.preventDefault();
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    document.body.style.overflow = '';
    
    // Keep fixed height at 68% unless closing
    let targetHeight: number;
    
    if (panelHeight < 40) {
      // Close panel
      targetHeight = 25;
      setTimeout(() => handleClose(), 200);
    } else {
      // Always snap back to 78%
      targetHeight = 78;
    }
    
    setPanelHeight(targetHeight);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Convert mouse events to touch-like events for desktop compatibility
    const touch = { clientY: e.clientY };
    setIsDragging(true);
    setDragStartY(touch.clientY);
    setDragStartHeight(panelHeight);
    document.body.style.overflow = 'hidden';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !panelRef.current) return;
    
    const deltaY = dragStartY - e.clientY;
    const viewportHeight = window.innerHeight;
    const heightChange = (deltaY / viewportHeight) * 100;
    
    let newHeight = dragStartHeight + heightChange;
    newHeight = Math.max(25, Math.min(90, newHeight));
    
    setPanelHeight(newHeight);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    document.body.style.overflow = '';
    
    let targetHeight: number;
    
    if (panelHeight < 40) {
      targetHeight = 25;
      setTimeout(() => handleClose(), 200);
    } else {
      // Always snap back to 78%
      targetHeight = 78;
    }
    
    setPanelHeight(targetHeight);
  };

  // Add mouse event listeners for desktop support
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStartY, dragStartHeight, panelHeight]);

  // Función para eliminar un evento

  if (!visible) return null;

  return (
    <>
      {/* Overlay to close when clicking outside - sin blur para mejor experiencia visual */}
      <div
        className="fixed inset-0"
        style={{ zIndex: currentZIndex - 1 }}
        onClick={handleClose}
      />

      {/* Chat component */}
      {chatVisible && (
        <Chat
          eventId={currentEvent.id}
          eventTitle={currentEvent.title}
          visible={chatVisible}
          onClose={() => setChatVisible(false)}
          eventImage={
            (event as any).main_media_url || currentEvent.mainMediaUrl
          }
          parentZIndex={currentZIndex}
          onHeaderClick={() => {
            // Al hacer click en el header del chat, cerrar chat y abrir detalles del evento
            setChatVisible(false);
            // Dar tiempo para que se cierre el chat antes de abrir el panel de detalles
            // Instead of timeout, immediately update z-index and trigger smooth transition
            const newZIndex = getNextZIndex();
            setCurrentZIndex(newZIndex);
            setIsComingFromChat(true);
            console.log(`🎯 EventDetailSheet reopened from chat with z-index: ${newZIndex}`);
            
            // Smooth forward slide animation like chat panel
            detailPanelControls.start({
              y: ["10px", "-5px", "0px"],
              opacity: [0.8, 0.95, 1],
              scale: [0.98, 1.02, 1],
              transition: {
                duration: 0.6,
                times: [0, 0.6, 1],
                ease: [0.23, 1, 0.32, 1]
              }
            });
            
            // Reset the flag after animation
            setTimeout(() => setIsComingFromChat(false), 600);
          }}
        />
      )}

      {/* Formulario de edición (legacy) */}
      {editFormVisible && (
        <EditEventForm
          eventId={currentEvent.id}
          event={{
            ...event,
            latitude: currentEvent.latitude || "",
            longitude: currentEvent.longitude || "",
          }}
          visible={editFormVisible}
          onClose={() => {
            setEditFormVisible(false);

            // Hacer una petición para actualizar los datos del evento
            const fetchUpdatedEvent = async () => {
              try {
                const response = await fetch(`/api/events/${currentEvent.id}`, {
                  credentials: "include",
                });

                if (response.ok) {
                  const updatedEventData = await response.json();
                  console.log(
                    "Datos actualizados del evento obtenidos después de editar (legacy):",
                    updatedEventData,
                  );

                  // Actualizar el estado local con los datos actualizados
                  setEvent(updatedEventData);
                }
              } catch (error) {
                console.error(
                  "Error al obtener los datos actualizados del evento:",
                  error,
                );
              }
            };

            // Ejecutar la actualización
            fetchUpdatedEvent();
          }}
        />
      )}

      {/* Panel de edición (nueva versión) */}
      {editSheetVisible && (
        <EditEventSheet
          eventId={currentEvent.id}
          isOpen={editSheetVisible}
          onClose={() => {
            // Cuando se cierra el panel de edición, forzamos una actualización de los datos
            setEditSheetVisible(false);

            // Hacer una petición para actualizar los datos del evento
            const fetchUpdatedEvent = async () => {
              try {
                const response = await fetch(`/api/events/${currentEvent.id}`, {
                  credentials: "include",
                });

                if (response.ok) {
                  const updatedEventData = await response.json();
                  console.log(
                    "Datos actualizados del evento obtenidos después de editar:",
                    updatedEventData,
                  );

                  // Actualizar el estado local con los datos actualizados
                  setEvent(updatedEventData);
                } else if (response.status === 404) {
                  // El evento fue eliminado, cerrar el panel de detalles también
                  console.log("🔒 Event not found (404), closing detail panel");
                  handleClose();
                }
              } catch (error) {
                console.error(
                  "Error al obtener los datos actualizados del evento:",
                  error,
                );
                // Si hay un error de red u otro problema, también cerrar el panel
                handleClose();
              }
            };

            // Ejecutar la actualización
            fetchUpdatedEvent();
          }}
          onEventUpdated={() => {
            // Llamar al callback si existe
            if (onEventUpdated) {
              onEventUpdated();
            }

            // Emitir evento personalizado para asegurar que todas las vistas se actualicen
            // incluso si el WebSocket no funciona correctamente
            const eventUpdateEvent = new CustomEvent("event-updated", {
              detail: { eventId: currentEvent.id, data: event },
            });
            window.dispatchEvent(eventUpdateEvent);
            console.log(
              "Evento personalizado emitido desde EventDetailSheet para:",
              currentEvent.id,
            );

            // Verificar si el evento aún existe después de la actualización
            const verifyEventExists = async () => {
              try {
                const response = await fetch(`/api/events/${currentEvent.id}`, {
                  credentials: "include",
                });

                if (response.status === 404) {
                  // El evento fue eliminado durante la edición, cerrar este panel también
                  console.log(
                    "🔒 Event deleted during editing, closing detail panel",
                  );
                  handleClose();
                }
              } catch (error) {
                console.error(
                  "Error verificando existencia del evento:",
                  error,
                );
              }
            };

            verifyEventExists();
          }}
        />
      )}

      <motion.div
        animate={isComingFromChat ? detailPanelControls : { 
          y: ["-8px", "0px"],
          opacity: 1,
          scale: 1,
          rotateX: 0,
          transition: {
            duration: 0.75,
            times: [0, 1],
            ease: [0.16, 1, 0.3, 1]
          }
        }}
        initial={{ y: "100%", opacity: 0, scale: 0.93, rotateX: 5 }}
        exit={{ 
          y: "100%", 
          opacity: 0, 
          scale: 0.95,
          rotateX: 3,
          transition: {
            duration: 0.45,
            ease: [0.4, 0, 0.6, 1]
          }
        }}
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-panel flex flex-col transition-all duration-200 ease-out"
        style={{ 
          zIndex: currentZIndex,
          transformStyle: "preserve-3d",
          perspective: "1000px",
          height: `${panelHeight}vh`,
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onAnimationComplete={() => {
          if (isComingFromChat) {
            console.log(`🎬 EventDetailSheet special animation from chat completed`);
          }
        }}
      >
        <div 
          className="p-2 flex justify-center cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="w-12 h-1 bg-neutral-300 rounded-full"></div>
        </div>

        <div
          className="flex-1 overflow-y-auto p-5"
          style={{ 
            scrollBehavior: "smooth",
            touchAction: isDragging ? 'none' : 'pan-y'
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <span
                className={`inline-block px-2 py-1 text-xs font-medium category-${currentEvent.category}-light rounded-full mb-2`}
              >
                {currentEvent.category.charAt(0).toUpperCase() +
                  currentEvent.category.slice(1)}
              </span>
              <h2 className="text-xl font-bold text-neutral-900">
                {currentEvent.title}
              </h2>
              <p className="text-neutral-500 flex items-center gap-1 mt-1">
                <CalendarIcon size={16} />
                <span>
                  {format(eventDate, "EEE, d MMM • HH:mm", { locale: es })}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {(isAttending || isOrganizer) && (
                <button
                  className="p-2 text-primary bg-primary/10 rounded-full"
                  onClick={() => setChatVisible(true)}
                  aria-label="Abrir chat"
                >
                  <MessageSquare size={20} />
                </button>
              )}
              <button
                className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
                onClick={handleClose}
                aria-label="Cerrar detalles"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Event multimedia */}
          {(() => {
            // Parse mediaItems to get all media items
            let mediaItemsArray: MediaItem[] = [];
            let hasValidMedia = false;

            if (currentEvent.mediaItems) {
              try {
                if (typeof currentEvent.mediaItems === "string") {
                  mediaItemsArray = JSON.parse(currentEvent.mediaItems);
                } else if (Array.isArray(currentEvent.mediaItems)) {
                  mediaItemsArray = currentEvent.mediaItems;
                } else {
                  mediaItemsArray = [];
                }

                // Filter out invalid items and ensure proper structure
                mediaItemsArray = mediaItemsArray
                  .filter((item: any) => {
                    return (
                      item &&
                      item.url &&
                      item.type &&
                      (item.type === "photo" || item.type === "video")
                    );
                  })
                  .map((item: any) => ({
                    type: item.type,
                    url: item.url,
                    isMain: item.isMain === true,
                    order: item.order || 0,
                  }));

                hasValidMedia = mediaItemsArray.length > 0;
              } catch (error) {
                console.error("Error parsing mediaItems in detail:", error);
                mediaItemsArray = [];
              }
            }

            // Fallback to legacy media fields
            const mainMediaUrl =
              (event as any).main_media_url || currentEvent.mainMediaUrl;
            const mainMediaType =
              (event as any).main_media_type || currentEvent.mainMediaType;

            if (!hasValidMedia && mainMediaUrl) {
              const mediaType = mainMediaType === "video" ? "video" : "photo";
              mediaItemsArray = [
                {
                  type: mediaType,
                  url: mainMediaUrl,
                  isMain: true,
                },
              ];
              hasValidMedia = true;
            }

            if (!hasValidMedia || mediaItemsArray.length === 0) {
              return null; // Don't render empty multimedia section
            }

            const allMediaItems = mediaItemsArray;

            return (
              <SimpleMediaCarousel
                items={allMediaItems}
                eventTitle={currentEvent.title}
              />
            );
          })()}

          {/* Organizer info */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <img
                  src={
                    currentEvent.organizer?.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(currentEvent.organizer?.name || "Organizador")}`
                  }
                  alt={currentEvent.organizer?.name || "Organizador"}
                  className="w-full h-full object-cover"
                />
              </Avatar>
              <div>
                <p className="text-sm text-neutral-500">Organizado por</p>
                <p className="font-medium">
                  {currentEvent.organizer?.name || "Usuario"}
                </p>
              </div>
            </div>


          </div>

          {/* Event description - Enhanced version */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-neutral-50 to-neutral-100 p-5 rounded-2xl border border-neutral-200/60">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-white p-2 rounded-lg">
                  <span className="text-xl">👋</span>
                </div>
                <div>
                  <p className="font-semibold text-neutral-800">Acerca de este evento</p>
                </div>
              </div>
              <div className="relative">
                <p className="text-neutral-700 leading-relaxed text-base whitespace-pre-wrap">
                  {currentEvent.description || "El organizador no ha proporcionado una descripción para este evento."}
                </p>
                {currentEvent.description && currentEvent.description.length > 150 && (
                  <div className="absolute bottom-0 right-0 bg-gradient-to-l from-neutral-100 to-transparent w-12 h-6 pointer-events-none rounded-bl-lg"></div>
                )}
              </div>
              {currentEvent.description && currentEvent.description.length > 300 && (
                <div className="mt-3 pt-3 border-t border-neutral-200/60">
                  <p className="text-xs text-neutral-500 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                    Descripción detallada por el organizador
                  </p>
                </div>
              )}
            </div>
          </div>


          {/* Event details - Meetup style cards (without Host card) */}
          <div className="space-y-3 mb-5">
            {/* Location card - show if we have any location data */}
            {(currentEvent.locationName ||
              currentEvent.locationAddress ||
              currentEvent.latitude ||
              currentEvent.longitude ||
              (currentEvent as any).latitude ||
              (currentEvent as any).longitude) && (
              <div className="bg-neutral-100 p-4 rounded-xl">
                <div className="flex items-start gap-3 mb-3">
                  <div className="bg-white p-2 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-neutral-600"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-800">
                      Ubicación del evento
                    </p>
                    <p className="text-sm text-neutral-600">
                      {currentEvent.locationAddress ||
                        locationName ||
                        currentEvent.locationName ||
                        (currentEvent.latitude || (currentEvent as any).latitude
                          ? `${(currentEvent.latitude || (currentEvent as any).latitude)?.toString().substring(0, 9)}, ${(currentEvent.longitude || (currentEvent as any).longitude)?.toString().substring(0, 10)}`
                          : "Ver ubicación en el mapa")}
                    </p>
                  </div>
                </div>
                {/* Map display within the location card */}
                {(currentEvent.latitude || (currentEvent as any).latitude) && 
                 (currentEvent.longitude || (currentEvent as any).longitude) && (
                  <div
                    ref={mapContainerRef}
                    className="w-full h-48 rounded-lg overflow-hidden bg-gray-100"
                    style={{ border: "1px solid #e5e5e5", minHeight: "192px" }}
                  ></div>
                )}
              </div>
            )}

            {/* Date and time card */}
            <div className="bg-neutral-100 p-4 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="bg-white p-2 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-neutral-600"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-neutral-800">
                    {new Date(currentEvent.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-neutral-600">
                    {new Date(currentEvent.date).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                    {(currentEvent as any).endTime && (
                      <span>
                        {" "}
                        -{" "}
                        {new Date(
                          (currentEvent as any).endTime,
                        ).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Gender preference card */}
            {(currentEvent as any).gender_preference && (
              <div className="bg-neutral-100 p-4 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="bg-white p-2 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-neutral-600"
                    >
                      <path d="M16 4a4 4 0 0 1 0 8 4 4 0 0 1 0-8z" />
                      <path d="M16 12v6" />
                      <path d="M8 20a4 4 0 0 1 0-8 4 4 0 0 1 0 8z" />
                      <path d="M8 12V6" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-800">Destinado Para</p>
                    <p className="text-sm text-neutral-600">
                      {((currentEvent as any).gender_preference === 'all_people' || (currentEvent as any).gender_preference === 'mixto') && 'Todas Las Personas'}
                      {(currentEvent as any).gender_preference === 'men' && 'Hombres'}
                      {(currentEvent as any).gender_preference === 'women' && 'Mujeres'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Going section */}
            <div 
              className="bg-neutral-100 p-4 rounded-xl cursor-pointer hover:bg-neutral-200 transition-colors"
              onClick={() => attendeeCount > 0 && setShowAllAttendees(true)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {/* Person icon with same style as other icons */}
                  <div className="bg-white p-2 rounded-lg">
                    <Users className="w-5 h-5 text-neutral-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-800">Yendo</p>
                    <p className="text-sm text-neutral-600">
                      {attendeeCount > 0 ? `${attendeeCount} asistente${attendeeCount > 1 ? 's' : ''}` : 'aun nadie se unio al evento'}
                    </p>
                  </div>
                </div>

                {/* Attendee avatars - show if there are attendees */}
                {attendeeCount > 0 && (
                  <div className="flex -space-x-1">
                    {safeAttendees.slice(0, 8).map((attendee, index) => (
                      <Avatar
                        key={attendee.id}
                        className="w-7 h-7 border-2 border-white cursor-pointer hover:scale-110 transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowUserProfile(attendee);
                        }}
                      >
                        <img
                          src={
                            attendee.user?.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(attendee.user?.name || "Usuario")}&background=random`
                          }
                          alt={attendee.user?.name || "Usuario"}
                          className="w-full h-full object-cover"
                        />
                      </Avatar>
                    ))}
                    {attendeeCount > 8 && (
                      <div className="w-7 h-7 rounded-full bg-gray-500 border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          +{attendeeCount - 8}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Join event button */}
          <div className="mb-5">
            {!isOrganizer &&
              !isAttending &&
              joinRequestStatus !== "pending" && 
              !showApplicationForm && (
                <Button
                  className="w-full py-4 bg-yellow-400 text-black font-semibold rounded-full text-lg hover:bg-yellow-500"
                  onClick={() => handleJoinEvent()}
                >
                  {currentEvent.privacyType === 'private' 
                    ? (() => {
                        const accessType = (currentEvent as any).privateAccessType || (currentEvent as any).private_access_type;
                        if (accessType === 'solicitud') return 'Quiero unirme (con solicitud)';
                        if (accessType === 'postulacion') return 'Quiero unirme (con postulación)';
                        if (accessType === 'paga') return 'Quiero unirme (con pago)';
                        return 'Quiero unirme (con solicitud)';
                      })()
                    : 'Quiero unirme'
                  }
                </Button>
              )}

            {/* Application Form for "postulación" events */}
            {showApplicationForm && (
              <div className="bg-white border rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Postulación al Evento</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowApplicationForm(false)}
                  >
                    ✕
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {(() => {
                    try {
                      const questionsData = (currentEvent as any).applicationQuestions || (currentEvent as any).application_questions;
                      const questions = questionsData ? JSON.parse(questionsData) : ['¿Por qué te interesa este evento?', '¿Qué esperas obtener de esta experiencia?'];
                      
                      return questions.map((question: string, index: number) => (
                        <div key={index}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {question}
                          </label>
                          <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                            rows={3}
                            value={applicationAnswers[index] || ''}
                            onChange={(e) => {
                              const newAnswers = [...applicationAnswers];
                              newAnswers[index] = e.target.value;
                              setApplicationAnswers(newAnswers);
                            }}
                            placeholder="Tu respuesta..."
                          />
                        </div>
                      ));
                    } catch (e) {
                      console.error('Error parsing application questions:', e);
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ¿Por qué te interesa este evento?
                          </label>
                          <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                            rows={3}
                            value={applicationAnswers[0] || ''}
                            onChange={(e) => {
                              const newAnswers = [...applicationAnswers];
                              newAnswers[0] = e.target.value;
                              setApplicationAnswers(newAnswers);
                            }}
                            placeholder="Tu respuesta..."
                          />
                        </div>
                      );
                    }
                  })()}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowApplicationForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-yellow-400 text-black hover:bg-yellow-500"
                    onClick={() => handleJoinEvent(applicationAnswers)}
                    disabled={applicationAnswers.every(answer => !answer?.trim())}
                  >
                    Enviar Postulación
                  </Button>
                </div>
              </div>
            )}

            {joinRequestStatus === "pending" && (
              <div className="flex flex-col space-y-2">
                <div className="bg-amber-100 text-amber-800 px-4 py-3 rounded-xl flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.42 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10.42"></path>
                    <path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"></path>
                    <path d="M18 14.5V21"></path>
                  </svg>
                  <span>
                    {currentEvent.privacyType === 'private' && 
                     ((currentEvent as any).privateAccessType === 'postulacion' || (currentEvent as any).private_access_type === 'postulacion')
                      ? 'Postulación pendiente de revisión'
                      : 'Solicitud pendiente de aprobación'
                    }
                  </span>
                </div>
                <Button
                  variant="destructive"
                  className="px-6 py-2 text-sm rounded-xl"
                  onClick={handleLeaveEvent}
                >
                  Cancelar {currentEvent.privacyType === 'private' && 
                           ((currentEvent as any).privateAccessType === 'postulacion' || (currentEvent as any).private_access_type === 'postulacion')
                           ? 'Postulación' : 'Solicitud'}
                </Button>
              </div>
            )}

            {isAttending && joinRequestStatus !== "pending" && !isOrganizer && (
              <div className="space-y-3">
                <Button
                  className="w-full py-4 bg-primary text-white font-semibold rounded-xl text-lg hover:bg-primary/90 flex items-center justify-center gap-2"
                  onClick={() => setChatVisible(true)}
                >
                  <MessageSquare size={20} />
                  Chat del evento
                </Button>
                <Button
                  variant="destructive"
                  className="w-full py-4 font-semibold rounded-xl text-lg"
                  onClick={handleLeaveEvent}
                >
                  Abandonar Evento
                </Button>
              </div>
            )}

            {isOrganizer && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    className="border-primary text-primary px-6 py-3 font-semibold rounded-xl"
                    onClick={() => setEditSheetVisible(true)}
                  >
                    Administrar
                  </Button>

                  {currentEvent.privacyType === "private" && (
                    <Button
                      variant="outline"
                      className="flex items-center gap-1"
                      onClick={() => setShowRequests(!showRequests)}
                    >
                      <UserPlus size={18} />
                      <span>Solicitudes</span>
                    </Button>
                  )}
                </div>

                {/* Event requests management section */}
                {showRequests && currentEvent.privacyType === "private" && (
                  <div className="mt-6 border rounded-lg p-4 bg-neutral-50">
                    <EventRequests
                      eventId={currentEvent.id}
                      onStatusChange={() => {
                        // Refrescar los datos al cambiar el estado de una solicitud
                        toast({
                          title: "Actualizado",
                          description:
                            "La solicitud ha sido procesada exitosamente",
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Modal para mostrar todos los asistentes */}
      {showAllAttendees && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: currentZIndex + 10 }}
          onClick={() => setShowAllAttendees(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full max-h-[70vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Asistentes ({attendeeCount})
              </h3>
              <button
                onClick={() => setShowAllAttendees(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(70vh-80px)]">
              <div className="space-y-3">
                {safeAttendees.map((attendee, index) => (
                  <div
                    key={attendee.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    onClick={() => {
                      handleShowUserProfile(attendee);
                      setShowAllAttendees(false);
                    }}
                  >
                    <Avatar className="w-10 h-10">
                      <img
                        src={
                          attendee.user?.avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(attendee.user?.name || "Usuario")}&background=random`
                        }
                        alt={attendee.user?.name || "Usuario"}
                        className="w-full h-full object-cover"
                      />
                    </Avatar>
                    <div>
                      <p className="font-medium text-gray-900">
                        {attendee.user?.name || "Usuario"}
                      </p>
                      {(attendee.user as any)?.username && (
                        <p className="text-sm text-gray-500">
                          @{(attendee.user as any).username}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Componente de carrusel estilo Instagram para elementos multimedia
type MediaItem = {
  type: "photo" | "video";
  url: string;
  isMain?: boolean;
  order?: number;
};

type MediaCarouselProps = {
  items: MediaItem[];
  eventTitle: string;
};

const SimpleMediaCarousel = ({ items, eventTitle }: MediaCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Prevenir scroll del body cuando el lightbox esté abierto
  useEffect(() => {
    if (isLightboxOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isLightboxOpen]);

  if (!items || items.length === 0) return null;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
    document.body.style.overflow = 'hidden'; // Prevent scrolling
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    document.body.style.overflow = ''; // Re-enable scrolling
  };

  const nextLightboxSlide = () => {
    setLightboxIndex((prev) => (prev + 1) % items.length);
  };

  const prevLightboxSlide = () => {
    setLightboxIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const currentItem = items[currentIndex];

  // Safety check for currentItem
  if (!currentItem || !currentItem.type || !currentItem.url) {
    return null;
  }

  return (
    <>
      <div className="mb-5">
        <h3 className="font-semibold mb-3">Contenido multimedia</h3>
        <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-black">
          {/* Current media item */}
          {currentItem.type === "video" ? (
            <video
              key={currentIndex}
              src={currentItem.url}
              className="w-full h-full object-cover"
              preload="metadata"
              controls
            />
          ) : (
            <img
              src={currentItem.url}
              alt={`${eventTitle} - imagen ${currentIndex + 1}`}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => openLightbox(currentIndex)}
            />
          )}

          {/* Navigation arrows */}
          {items.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 text-gray-800 rounded-full p-2 hover:bg-white transition-colors shadow-md z-10"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 text-gray-800 rounded-full p-2 hover:bg-white transition-colors shadow-md z-10"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {/* Pagination indicator */}
          {items.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-sm px-2 py-1 rounded z-10">
              {currentIndex + 1} / {items.length}
            </div>
          )}

          {/* Main indicator badge */}
          {currentItem.isMain && (
            <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded z-10">
              Principal
            </div>
          )}
        </div>

        {/* Dot navigation */}
        {items.length > 1 && (
          <div className="flex gap-1 mt-2 justify-center">
            {items.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? "bg-blue-500" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Full-Screen Lightbox Modal using Portal */}
      {typeof window !== "undefined" &&
        isLightboxOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black flex items-center justify-center"
            style={{
              zIndex: 2147483647,
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: "100vw",
              height: "100vh",
            }}
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 left-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors"
              style={{ zIndex: 2147483647 }}
            >
              <X size={24} />
            </button>

            {/* Image counter */}
            <div
              className="absolute top-4 right-4 text-white bg-black/50 px-3 py-1 rounded-full text-sm"
              style={{ zIndex: 2147483647 }}
            >
              {lightboxIndex + 1} of {items.length}
            </div>

            {/* Current image */}
            <div
              className="relative w-full h-full flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {items[lightboxIndex]?.type === "video" ? (
                <video
                  src={items[lightboxIndex].url}
                  className="max-w-full max-h-full object-contain"
                  controls
                  autoPlay
                />
              ) : (
                <img
                  src={items[lightboxIndex]?.url}
                  alt={`${eventTitle} - imagen ${lightboxIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
              )}

              {/* Navigation arrows in lightbox */}
              {items.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      prevLightboxSlide();
                    }}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white bg-black/50 rounded-full p-3 hover:bg-black/70 transition-colors"
                    style={{ zIndex: 2147483647 }}
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      nextLightboxSlide();
                    }}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white bg-black/50 rounded-full p-3 hover:bg-black/70 transition-colors"
                    style={{ zIndex: 2147483647 }}
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default EventDetailSheet;
