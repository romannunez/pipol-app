import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import BottomNav from "@/components/layout/bottom-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice } from "@/lib/stripe";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { CalendarIcon, MapPin, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import EditEventSheet from "@/components/events/edit-event-sheet";
import LoadingSpinner from "@/components/ui/loading-spinner";

const MyEvents = () => {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  // Obtenemos el parámetro tab de la URL
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const tabParam = params.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam === "created" ? "created" : "attending");
  const [editEventId, setEditEventId] = useState<number | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Leer el parámetro tab de la URL cada vez que cambia la ubicación
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'created' || tabParam === 'attending') {
        setActiveTab(tabParam);
      } else if (location.includes('my-events')) {
        // Si no hay parámetro específico, usar 'attending' por defecto
        setActiveTab('attending');
      }
    }
  }, [location]);

  // Invalidar las consultas al cargar el componente para asegurar datos frescos
  useEffect(() => {
    if (user) {
      // Forzar la invalidación de caché para los eventos
      queryClient.invalidateQueries({ queryKey: ["/api/user/events/created"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events/attending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      console.log("Caché de consultas invalidada en MyEvents");
    }
  }, [queryClient, user]);
  
  // Escuchar evento personalizado para actualizaciones de eventos
  useEffect(() => {
    // Manejador para actualizar cuando se reciba un evento de actualización
    const handleEventUpdated = (e: any) => {
      const eventId = e?.detail?.eventId;
      const eventData = e?.detail?.data;
      
      if (eventId && eventData) {
        console.log("Evento actualizado detectado en MyEvents:", eventId);
        
        // Invalidar caches relevantes para forzar la actualización
        queryClient.invalidateQueries({ queryKey: ["/api/user/events/created"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user/events/attending"] });
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        
        // También actualizar la caché específica del evento
        queryClient.setQueryData([`/api/events/${eventId}`], eventData);
      }
    };
    
    // Agregar listener para el evento personalizado
    window.addEventListener('event-updated', handleEventUpdated);
    
    // Limpiar al desmontar
    return () => {
      window.removeEventListener('event-updated', handleEventUpdated);
    };
  }, [queryClient]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  // Fetch created events
  const { data: createdEvents = [] } = useQuery({
    queryKey: ["/api/user/events/created"],
    queryFn: async () => {
      // Añadir un parámetro de timestamp para evitar caché
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/user/events/created?_t=${timestamp}`, {
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });
      if (!response.ok) {
        throw new Error("Failed to fetch created events");
      }
      const events = await response.json();
      // Depurar eventos para asegurarnos de que estamos recibiendo los medios correctos
      console.log("Eventos creados:", events);
      if (events.length > 0 && events[0]) {
        console.log("Primer evento - mainMediaType:", events[0].mainMediaType);
        console.log("Primer evento - mainMediaUrl:", events[0].mainMediaUrl);
        console.log("Primer evento - mediaItems:", events[0].mediaItems);
      }
      return events;
    },
    enabled: !!user,
    staleTime: 0, // Los datos son obsoletos inmediatamente
    refetchOnMount: true, // Recargar datos cada vez que se monte el componente
    refetchOnWindowFocus: true, // Recargar datos cuando la ventana recibe el foco
  });

  // Fetch attending events
  const { data: attendingEvents = [] } = useQuery({
    queryKey: ["/api/user/events/attending"],
    queryFn: async () => {
      // Añadir un parámetro de timestamp para evitar caché
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/user/events/attending?_t=${timestamp}`, {
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });
      if (!response.ok) {
        throw new Error("Failed to fetch attending events");
      }
      return response.json();
    },
    enabled: !!user,
    staleTime: 0, // Los datos son obsoletos inmediatamente
    refetchOnMount: true, // Recargar datos cada vez que se monte el componente
    refetchOnWindowFocus: true, // Recargar datos cuando la ventana recibe el foco
  });

  // Handle event click
  const handleEventClick = (eventId: number) => {
    // In a real app, this would navigate to the event detail view
    console.log("Event clicked:", eventId);
  };
  
  // Open edit sheet for a specific event
  const handleOpenEditSheet = (eventId: number) => {
    console.log("Opening edit sheet for event:", eventId);
    setEditEventId(eventId);
    setIsEditSheetOpen(true);
  };
  
  // Close edit sheet
  const handleCloseEditSheet = () => {
    setIsEditSheetOpen(false);
    setTimeout(() => setEditEventId(null), 300); // Clean up after animation completes
  };
  
  // Handle event update
  const handleEventUpdated = () => {
    // Refetch events to update the UI
    queryClient.invalidateQueries({ queryKey: ["/api/user/events/created"] });
    queryClient.invalidateQueries({ queryKey: ["/api/events"] });
  };

  if (isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex h-screen items-center justify-center"
      >
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.2, 1] 
          }}
          transition={{ 
            rotate: { duration: 2, repeat: Infinity, ease: "linear" },
            scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          <LoadingSpinner size="lg" />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col h-screen bg-neutral-50 overflow-hidden"
    >
      {/* Header with profile summary */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="bg-white px-4 py-4 border-b border-neutral-200 flex-shrink-0"
      >
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center gap-4 mb-2"
        >
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ duration: 0.3 }}
          >
            <Avatar className="h-12 w-12">
              <img 
                src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}`}
                alt={user?.name || 'User'}
                className="h-full w-full object-cover"
              />
            </Avatar>
          </motion.div>
          <motion.div
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            <h1 className="text-lg font-bold">{user?.name}</h1>
            <p className="text-neutral-500 text-sm">@{user?.username}</p>
          </motion.div>
        </motion.div>
        <motion.h2 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="text-base font-bold"
        >
          Mis Eventos
        </motion.h2>
      </motion.div>

      {/* Tabs */}
      <Tabs 
        defaultValue="attending" 
        value={activeTab} 
        onValueChange={(value) => {
          setActiveTab(value);
          // Actualizar la URL cuando cambia la pestaña
          navigate(`/my-events?tab=${value}`, { replace: true });
        }} 
        className="flex-1 flex flex-col min-h-0"
      >
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="sticky top-0 z-10 bg-white px-4 pt-2 pb-2 shadow-sm flex-shrink-0"
        >
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <TabsList className="w-full grid grid-cols-2">
              <motion.div whileTap={{ scale: 0.98 }}>
                <TabsTrigger value="attending">Asistiendo</TabsTrigger>
              </motion.div>
              <motion.div whileTap={{ scale: 0.98 }}>
                <TabsTrigger value="created">Creados</TabsTrigger>
              </motion.div>
            </TabsList>
          </motion.div>
        </motion.div>

        <TabsContent value="attending" className="flex-1 overflow-y-auto p-4 pb-24">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-4"
          >
            <AnimatePresence>
              {attendingEvents.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="text-center py-12"
                >
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    className="text-neutral-500"
                  >
                    No estás asistiendo a ningún evento todavía.
                  </motion.p>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                  >
                    <Button
                      className="mt-4 bg-primary hover:bg-primary/90"
                      onClick={() => navigate("/")}
                    >
                      Descubrir Eventos
                    </Button>
                  </motion.div>
                </motion.div>
              ) : (
                attendingEvents.map((attendance: any, index: number) => (
                  <motion.div
                    key={attendance.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      delay: index * 0.1,
                      duration: 0.4,
                      ease: "easeOut"
                    }}
                    whileHover={{ 
                      y: -4,
                      scale: 1.02,
                      transition: { duration: 0.2 } 
                    }}
                  >
                    <Card className="shadow-card overflow-hidden">
                  <div className="aspect-[3/1] bg-neutral-200">
                    {(() => {
                      console.log(`Renderizando asistencia a evento ${attendance.event.id}:`, {
                        mainMediaType: attendance.event.mainMediaType,
                        mainMediaUrl: attendance.event.mainMediaUrl,
                        mediaItems: attendance.event.mediaItems
                      });
                      
                      // Procesar mediaItems manualmente para obtener el elemento principal
                      let mainMediaItem: any = null;
                      if (attendance.event.mediaItems) {
                        try {
                          const mediaItemsArray = JSON.parse(attendance.event.mediaItems);
                          
                          // Primero buscar un elemento marcado explícitamente como principal
                          let mainItem = mediaItemsArray.find((item: any) => item.isMain === true);
                          
                          // Si no hay ninguno marcado como principal, usar el primer elemento
                          if (!mainItem && mediaItemsArray.length > 0) {
                            // Ordenar por el campo order
                            const sortedItems = [...mediaItemsArray].sort((a: any, b: any) => 
                              (a.order || 0) - (b.order || 0)
                            );
                            mainItem = sortedItems[0];
                          }
                          
                          // Establecer el elemento principal
                          mainMediaItem = mainItem;
                          
                          console.log(`Elemento principal encontrado (asistencia):`, mainMediaItem);
                        } catch (error) {
                          console.error("Error al parsear mediaItems (asistencia):", error);
                        }
                      }
                      
                      const mediaType = mainMediaItem?.type || attendance.event.mainMediaType;
                      const mediaUrl = mainMediaItem?.url || attendance.event.mainMediaUrl;
                      
                      console.log(`Media seleccionado (asistencia): type=${mediaType}, url=${mediaUrl}`);
                      
                      if (mediaType === 'video') {
                        return (
                          <div className="relative w-full h-full">
                            {/* Video en estado pausado */}
                            <video
                              src={mediaUrl}
                              className="w-full h-full object-cover"
                              poster={attendance.event.photoUrl}
                              preload="metadata"
                              muted
                              key={`video-attending-${attendance.event.id}-${mediaUrl}-${Date.now()}`}
                              onError={(e) => {
                                console.error(`Error loading video (asistencia): ${mediaUrl}`, e);
                              }}
                            />
                            {/* Overlay de ícono de play para indicar que es un video */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <img
                            src={mediaUrl || attendance.event.photoUrl || `/images/${attendance.event.category || 'default'}.jpg`}
                            alt={attendance.event.title}
                            className="w-full h-full object-cover"
                            key={`img-attending-${attendance.event.id}-${mediaUrl}-${Date.now()}`}
                            onError={(e) => {
                              console.error(`Error loading image (asistencia): ${mediaUrl}`, e);
                              const target = e.target as HTMLImageElement;
                              // Try fallback images in order
                              if (!target.src.includes('/images/')) {
                                target.src = `/images/1.jpg`;
                              } else if (target.src.includes('1.jpg')) {
                                target.src = `/images/2.jpg`;
                              } else {
                                // Final fallback - create a simple placeholder
                                target.src = `data:image/svg+xml;base64,${btoa(`<svg width="600" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" text-anchor="middle" dy="0.3em" font-family="sans-serif" font-size="16" fill="#6b7280">${attendance.event.title}</text></svg>`)}`;
                              }
                            }}
                          />
                        );
                      }
                    })()}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`inline-block px-2 py-1 text-xs font-medium category-${attendance.event.category || 'general'}-light rounded-full mb-1`}>
                          {attendance.event.category ? attendance.event.category.charAt(0).toUpperCase() + attendance.event.category.slice(1) : 'Evento'}
                        </span>
                        <h3 className="font-semibold text-lg">{attendance.event.title}</h3>
                        <p className="text-neutral-500 flex items-center gap-1 text-sm">
                          <CalendarIcon size={14} />
                          <span>
                            {attendance.event.date ? format(parseISO(attendance.event.date), "E, MMM d • h:mm a") : "Fecha no disponible"}
                          </span>
                        </p>
                        <p className="text-neutral-500 flex items-center gap-1 text-sm mt-1">
                          <MapPin size={14} />
                          <span>{attendance.event.locationName}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatPrice(attendance.event.price)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center mt-4 pt-4 border-t border-neutral-100">
                      <Avatar className="h-8 w-8">
                        <img 
                          src={attendance.event.organizer?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(attendance.event.organizer?.name || 'Organizador')}`} 
                          alt={attendance.event.organizer?.name || 'Organizador'}
                          className="h-full w-full object-cover"
                        />
                      </Avatar>
                      <div className="ml-2">
                        <p className="text-sm text-neutral-500">Organizado por</p>
                        <p className="text-sm font-medium">{attendance.event.organizer?.name || 'Organizador'}</p>
                      </div>
                      
                      <div className="ml-auto flex items-center">
                        <div className="flex items-center gap-1 text-sm text-neutral-500">
                          <Users size={14} />
                          <span>{attendance.event.attendees?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </motion.div>
        </TabsContent>

        <TabsContent value="created" className="flex-1 overflow-y-auto p-4 pb-24">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-4"
          >
            <AnimatePresence>
              {createdEvents.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="text-center py-12"
                >
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    className="text-neutral-500"
                  >
                    No has creado ningún evento todavía.
                  </motion.p>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                  >
                    <Button
                      className="mt-4 bg-primary hover:bg-primary/90"
                      onClick={() => navigate("/create-event")}
                    >
                      Crear Evento
                    </Button>
                  </motion.div>
                </motion.div>
              ) : (
                createdEvents.map((event: any, index: number) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      delay: index * 0.1,
                      duration: 0.4,
                      ease: "easeOut"
                    }}
                    whileHover={{ 
                      y: -4,
                      scale: 1.02,
                      transition: { duration: 0.2 } 
                    }}
                  >
                    <Card className="shadow-card overflow-hidden">
                  <div className="aspect-[3/1] bg-neutral-200">
                    {(() => {
                      console.log(`Renderizando evento creado ${event.id}:`, {
                        mainMediaType: event.mainMediaType,
                        mainMediaUrl: event.mainMediaUrl,
                        mediaItems: event.mediaItems
                      });
                      
                      // Procesar mediaItems para obtener el elemento principal
                      let mainMediaItem: any = null;
                      if (event.mediaItems) {
                        try {
                          let mediaItemsArray;
                          // Verificar si ya es un array o necesita parsing
                          if (typeof event.mediaItems === 'string') {
                            mediaItemsArray = JSON.parse(event.mediaItems);
                          } else if (Array.isArray(event.mediaItems)) {
                            mediaItemsArray = event.mediaItems;
                          } else {
                            mediaItemsArray = [];
                          }
                          
                          // Buscar elemento marcado como principal
                          let mainItem = mediaItemsArray.find((item: any) => item.isMain === true);
                          
                          // Si no hay principal, usar el primer elemento
                          if (!mainItem && mediaItemsArray.length > 0) {
                            const sortedItems = [...mediaItemsArray].sort((a: any, b: any) => 
                              (a.order || 0) - (b.order || 0)
                            );
                            mainItem = sortedItems[0];
                          }
                          
                          mainMediaItem = mainItem;
                          console.log(`Elemento principal encontrado (creado):`, mainMediaItem);
                        } catch (error) {
                          console.error("Error al parsear mediaItems (creado):", error);
                          mainMediaItem = null;
                        }
                      }
                      
                      const mediaType = mainMediaItem?.type || event.mainMediaType;
                      const mediaUrl = mainMediaItem?.url || event.mainMediaUrl;
                      
                      console.log(`Media seleccionado (creado): type=${mediaType}, url=${mediaUrl}`);
                      
                      if (mediaType === 'video') {
                        return (
                          <div className="relative w-full h-full">
                            {/* Video en estado pausado */}
                            <video
                              src={mediaUrl}
                              className="w-full h-full object-cover"
                              poster={event.photoUrl}
                              preload="metadata"
                              muted
                              key={`video-created-${event.id}-${mediaUrl}-${Date.now()}`}
                              onError={(e) => {
                                console.error(`Error loading video (creado): ${mediaUrl}`, e);
                              }}
                            />
                            {/* Overlay de ícono de play para indicar que es un video */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <img
                            src={mediaUrl || event.photoUrl || `/images/${event.category || 'default'}.jpg`}
                            alt={event.title}
                            className="w-full h-full object-cover"
                            key={`img-created-${event.id}-${mediaUrl}-${Date.now()}`}
                            onError={(e) => {
                              console.error(`Error loading image (creado): ${mediaUrl}`, e);
                              const target = e.target as HTMLImageElement;
                              // Try fallback images in order
                              if (!target.src.includes('/images/')) {
                                target.src = `/images/1.jpg`;
                              } else if (target.src.includes('1.jpg')) {
                                target.src = `/images/2.jpg`;
                              } else {
                                // Final fallback - create a simple placeholder
                                target.src = `data:image/svg+xml;base64,${btoa(`<svg width="600" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" text-anchor="middle" dy="0.3em" font-family="sans-serif" font-size="16" fill="#6b7280">${event.title}</text></svg>`)}`;
                              }
                            }}
                          />
                        );
                      }
                    })()}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`inline-block px-2 py-1 text-xs font-medium category-${event.category || 'general'}-light rounded-full mb-1`}>
                          {event.category ? event.category.charAt(0).toUpperCase() + event.category.slice(1) : 'Evento'}
                        </span>
                        <h3 className="font-semibold text-lg">{event.title}</h3>
                        <p className="text-neutral-500 flex items-center gap-1 text-sm">
                          <CalendarIcon size={14} />
                          <span>
                            {event.date ? format(parseISO(event.date), "E, MMM d • h:mm a") : "Fecha no disponible"}
                          </span>
                        </p>
                        <p className="text-neutral-500 flex items-center gap-1 text-sm mt-1">
                          <MapPin size={14} />
                          <span>{event.locationName}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatPrice(event.price)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
                      <div className="flex items-center gap-1 text-sm text-neutral-500">
                        <Users size={14} />
                        <span>{event.attendees?.length || 0} participantes</span>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditSheet(event.id)}
                      >
                        Editar
                      </Button>
                    </div>
                  </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Edit Event Sheet */}
      {editEventId && (
        <EditEventSheet
          eventId={editEventId}
          isOpen={isEditSheetOpen}
          onClose={handleCloseEditSheet}
          onEventUpdated={handleEventUpdated}
        />
      )}

      <BottomNav />
    </motion.div>
  );
};

export default MyEvents;