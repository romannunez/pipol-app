import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@/contexts/navigation-context";
import EditEventFormGoogle from "@/components/events/edit-event-form-google";
import { Loader2, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Componente para la edición de eventos en un panel deslizante

interface EditEventSheetProps {
  eventId: number;
  isOpen: boolean;
  onClose: () => void;
  onEventUpdated?: () => void; // Callback para cuando se actualiza un evento
}

// Componente para la edición de eventos en un panel deslizante

const EditEventSheet = ({ eventId, isOpen, onClose, onEventUpdated }: EditEventSheetProps) => {
  console.log("Renderizando EditEventSheet, isOpen:", isOpen);
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { hideNavigation, showNavigation } = useNavigation();
  const [formVisible, setFormVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false); // Estado para controlar si hay menús desplegables abiertos
  const [error500, setError500] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const editEventKey = useRef(0);
  
  // Control navigation visibility
  useEffect(() => {
    if (isOpen) {
      hideNavigation();
    } else {
      showNavigation();
    }
    
    // Cleanup: show navigation when component unmounts
    return () => {
      showNavigation();
    };
  }, [isOpen, hideNavigation, showNavigation]);

  // Logs para depuración
  useEffect(() => {
    console.log("Panel de editar evento montado con estado:", isOpen ? "abierto" : "cerrado");
  }, []);
  
  // Log para depuración
  useEffect(() => {
    console.log("Estado de EditEventSheet:", { isOpen, closing, formVisible, user: !!user, authLoading, eventId });
  }, [isOpen, closing, formVisible, user, authLoading, eventId]);
  
  // Manejar cierre con animación
  const handleClose = () => {
    console.log("Iniciando cierre de EditEventSheet con animación");
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 300); // Debe coincidir con la duración de la animación CSS
  };

  // Fetch event details
  const { data: event, isLoading, error } = useQuery({
    queryKey: [`/api/events/${eventId}`],
    queryFn: async () => {
      try {
        console.log("Fetching event data for sheet, ID:", eventId);
        const response = await fetch(`/api/events/${eventId}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          console.error("Error fetching event data:", response.status, response.statusText);
          if (response.status === 500) {
            setError500(true);
          }
          throw new Error(`Failed to fetch event details: ${response.status}`);
        }
        const data = await response.json();
        console.log("Event data fetched successfully:", data);
        console.log("🔍 SHEET DEBUG - media_items field:", data.media_items);
        console.log("🔍 SHEET DEBUG - mediaItems field:", data.mediaItems);
        console.log("🔍 SHEET DEBUG - main_media_url field:", data.main_media_url);
        console.log("🔍 SHEET DEBUG - mainMediaUrl field:", data.mainMediaUrl);
        return data;
      } catch (err) {
        console.error("Error in queryFn:", err);
        throw err;
      }
    },
    enabled: isOpen && !!eventId && !isNaN(eventId),
    retry: 1,
  });

  // Check authentication
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      toast({
        title: 'Autenticación Requerida',
        description: 'Por favor inicia sesión para editar eventos',
        variant: 'destructive',
      });
      handleClose();
      return;
    }
  }, [user, authLoading, toast]);

  // Check authorization when event is loaded
  useEffect(() => {
    if (!event || !user) return;
    
    // Check if event has organizer_id or organizerId (backend uses snake_case, frontend might use camelCase)
    const eventOrganizerId = event.organizer_id || event.organizerId;
    
    if (!eventOrganizerId) {
      // Log error and close
      console.error('Error: El evento no tiene ID de organizador válido', event);
      toast({
        title: 'Error de Datos',
        description: 'No se pudo verificar el organizador del evento',
        variant: 'destructive',
      });
      handleClose();
      return;
    }
    
    // En caso de que event.organizer no esté presente pero sí tengamos organizer_id
    if (!event.organizer) {
      console.log('Advertencia: event.organizer no existe, pero sí existe organizer_id:', eventOrganizerId);
    }
    
    // Check if user is the organizer (usando prioritariamente organizer_id del backend)
    const organizerId = eventOrganizerId || (event.organizer && event.organizer.id);
    
    if (organizerId !== parseInt(String(user.id))) {
      console.log(`Usuario ${user.id} intentó editar evento del organizador ${organizerId}`);
      toast({
        title: 'No Autorizado',
        description: 'Solo el organizador puede editar este evento',
        variant: 'destructive',
      });
      handleClose();
      return;
    }
    
    // If authenticated and authorized, show the form
    setFormVisible(true);
  }, [event, user, toast]);

  // Estado para bloquear el cierre durante los primeros segundos
  const [lockClosing, setLockClosing] = useState(false);

  // Efecto para bloquear el cierre durante los primeros momentos después de abrir
  useEffect(() => {
    if (isOpen) {
      // Bloquear inmediatamente cuando se abre
      setLockClosing(true);
      
      // Mantener bloqueado durante 5 segundos
      const timerId = setTimeout(() => {
        setLockClosing(false);
        console.log("🔓 Bloqueo de cierre liberado después de 5 segundos");
      }, 5000);
      
      return () => clearTimeout(timerId);
    }
  }, [isOpen]);

  // Efecto para detectar cuando hay menús desplegables abiertos
  useEffect(() => {
    const checkDropdownState = () => {
      // Buscar cualquier menú desplegable abierto en el DOM
      const openMenus = document.querySelectorAll(
        '[data-radix-popper-content-wrapper], [role="listbox"], [data-state="open"]'
      );
      const isOpen = openMenus.length > 0;
      
      if (isOpen !== selectOpen) {
        console.log(`Estado global de menú select: ${isOpen ? "ABIERTO" : "CERRADO"}`);
        setSelectOpen(isOpen);
      }
    };

    // Ejecutar la comprobación periódicamente mientras el panel está abierto
    const intervalId = isOpen ? setInterval(checkDropdownState, 100) : null;
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, selectOpen]);

  // Efecto para manejar clics fuera del panel - Solución drástica
  useEffect(() => {
    // Define global UI state if it doesn't exist
    if (typeof window !== 'undefined' && !window.__PIPOL_UI_STATE) {
      window.__PIPOL_UI_STATE = {
        selectMenuOpen: false,
        setSelectMenuOpen: (isOpen: boolean) => {
          if (window.__PIPOL_UI_STATE) {
            window.__PIPOL_UI_STATE.selectMenuOpen = isOpen;
          }
        },
        preventPanelClose: false
      };
    }
    
    // Definir la zona segura del click (donde NO debe cerrarse el panel)
    function isTargetSafeToClick(target: HTMLElement): boolean {
      // -1. Si el panel está bloqueado por tiempo, NUNCA cerrar (primeros 5 segundos)
      if (lockClosing) {
        console.log("🔒 Panel bloqueado temporalmente - NO cerrar");
        return true;
      }
      
      // 0. Si hay un menú desplegable abierto, SIEMPRE es seguro (NO cerrar)
      if (selectOpen) {
        console.log("🛡️ Menú desplegable abierto detectado - NO cerrar");
        return true;
      }
      
      // 1. Si el clic está dentro del panel principal, es seguro (NO cerrar)
      if (sheetRef.current && sheetRef.current.contains(target)) {
        console.log("✅ Clic dentro del panel principal - NO cerrar");
        return true;
      }
      
      // 2. Verificar si es parte de algún elemento UI desplegado (dropdown, popup, etc)
      const uiSelectors = [
        // Selectores específicos de ShadCN/Radix UI
        '[data-radix-popper-content-wrapper]',
        '[class*="SelectContent"]',
        '[class*="PopoverContent"]',
        '[class*="DropdownMenu"]',
        '[class*="radix-"]',
        '[class*="Dialog"]',
        '[role="listbox"]',
        '[role="dialog"]',
        '[role="menu"]',
        // Clases genéricas que podrían pertenecer a UI
        '.select-content',
        '.popup-menu',
        '.dropdown-options',
        '.calendar-popup'
      ];
      
      // Si coincide con alguno de estos selectores, es seguro (NO cerrar)
      for (const selector of uiSelectors) {
        if (target.closest(selector)) {
          console.log(`✅ Clic en elemento UI (${selector}) - NO cerrar`);
          return true;
        }
      }
      
      // 3. Si llegamos aquí, no es seguro => CERRAR
      console.log("❌ Clic fuera del panel y elementos UI - CERRAR");
      return false;
    }

    // Función para proteger los contenidos de dropdown específicamente
    function protectDropdownContents() {
      // Seleccionar todos los elementos de dropdown y portales
      const allDropdowns = [
        ...Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper]')),
        ...Array.from(document.querySelectorAll('[data-state="open"]')),
        ...Array.from(document.querySelectorAll('[data-radix-portal]')),
        ...Array.from(document.querySelectorAll('[role="listbox"]')),
        ...Array.from(document.querySelectorAll('.select-dropdown-wrapper'))
      ];
      
      allDropdowns.forEach(dropdown => {
        // Verificar si ya está protegido
        if (!dropdown.hasAttribute('data-pipol-protected')) {
          // Marcar como protegido y agregar captura de eventos
          dropdown.setAttribute('data-pipol-protected', 'true');
          
          // Agregar un objeto directo que intercepte clics en TODA el área
          dropdown.addEventListener('mousedown', (e) => {
            console.log("🔒 Interceptado clic en dropdown (protección especial)");
            e.stopPropagation();
            e.preventDefault();
          }, true);
          
          // Buscar todos los elementos clickeables y protegerlos
          const clickables = dropdown.querySelectorAll('*');
          clickables.forEach(el => {
            el.addEventListener('mousedown', (e) => {
              e.stopPropagation();
            }, true);
          });
        }
      });
    }

    // Ejecutar la protección inmediatamente y en intervalos
    if (isOpen) {
      protectDropdownContents();
      const protectionInterval = setInterval(protectDropdownContents, 50);
      setTimeout(() => clearInterval(protectionInterval), 5000); // Limpia después de 5 segundos
    }

    // Función que maneja el clic global
    function handleGlobalClick(e: MouseEvent) {
      const clickTarget = e.target as HTMLElement;
      
      // VERIFICACIÓN SUPER IMPORTANTE: Si tenemos un menú desplegable abierto con nuestra nueva lógica
      if (window.__PIPOL_UI_STATE?.preventPanelClose) {
        console.log("🚨 PROTECCIÓN GLOBAL ACTIVADA - NO cerrar bajo ninguna circunstancia");
        return;
      }
      
      // VERIFICACIÓN DE DROPDOWN: Clic en un desplegable Radix?
      if (clickTarget.closest('[data-radix-popper-content-wrapper]') || 
          clickTarget.closest('[role="listbox"]') ||
          clickTarget.closest('[data-radix-portal]') ||
          clickTarget.closest('.select-dropdown-wrapper') ||
          clickTarget.closest('[data-pipol-dropdown]') ||
          clickTarget.closest('.pipol-dropdown-content')) {
        console.log("🔒 Clic directo en dropdown Radix capturado - NO cerrar");
        e.stopPropagation();
        return;
      }
      
      // VERIFICACIÓN DEL ESTADO GLOBAL
      if (window.__PIPOL_UI_STATE?.selectMenuOpen) {
        console.log("🚨 Menú Select abierto según estado global - NO cerrar");
        return;
      }
      
      // Verificación antigua para compatibilidad
      const portals = document.querySelectorAll('[data-pipol-select-portal], [data-pipol-protected]');
      let foundInPortal = false;
      
      portals.forEach(portal => {
        if (portal.contains(clickTarget)) {
          console.log("🛡️ Clic detectado dentro de un portal, ignorando cierre");
          foundInPortal = true;
        }
      });
      
      if (foundInPortal) {
        return;
      }
      
      // Si es un área segura donde hacer clic, NO cerramos
      if (isTargetSafeToClick(clickTarget)) {
        return;
      }
      
      // Si llegamos aquí, cerrar el panel
      handleClose();
    }
    
    // Solo agregar listener cuando el panel está abierto
    if (isOpen) {
      // Usar capture: true para capturar el evento antes que otros handlers
      document.addEventListener('mousedown', handleGlobalClick, true);
    }
    
    // Limpiar el listener cuando se desmonta
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick, true);
    };
  }, [isOpen, lockClosing, selectOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[999999] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      onClick={(e) => {
        // Si se hace clic directamente en el fondo oscuro (no en elementos hijos)
        if (e.target === e.currentTarget) {
          console.log("⚠️ Clic en fondo oscuro - cerrando panel");
          handleClose();
        }
      }}
    >
      <div 
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-panel z-[999999] flex flex-col event-panel ${closing ? 'slide-down' : 'slide-up'}`}
        style={{ height: '90vh' }}
        onClick={(e) => e.stopPropagation()} // Evita que clics en el panel blanco lleguen al fondo
      >
        {/* Barra superior con indicador de arrastre y título - fija */}
        <div className="sticky top-0 z-10 bg-white rounded-t-3xl">
          <div className="p-2 flex justify-center">
            <div 
              className="w-10 h-1 bg-neutral-300 rounded-full cursor-pointer"
              onClick={handleClose}  
            ></div>
          </div>
          
          <div className="border-b border-gray-100">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center">
                <button onClick={handleClose} className="mr-3">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-medium">Editar evento</h2>
              </div>
              <button onClick={handleClose} className="text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Contenido principal con scroll */}
        <div className="flex-1 overflow-y-auto pb-20" style={{ height: 'calc(90vh - 70px)', WebkitOverflowScrolling: 'touch' }}>
          
          {/* Loading state */}
          {(isLoading || authLoading) && !formVisible && (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {/* Error state */}
          {error && !formVisible && !error500 && (
            <div className="flex h-48 items-center justify-center">
              <div className="text-center p-4">
                <h2 className="text-lg font-semibold mb-2">Error al cargar el evento</h2>
                <p className="text-neutral-500">No se pudo cargar la información del evento</p>
                <Button 
                  className="mt-4" 
                  onClick={handleClose}
                >
                  Volver
                </Button>
              </div>
            </div>
          )}
          
          {/* Handle errors from the server */}
          {error500 && (
            <div className="flex h-48 items-center justify-center">
              <div className="text-center p-4">
                <h2 className="text-lg font-semibold mb-2">Error del servidor</h2>
                <p className="text-neutral-500">Hubo un problema procesando tu solicitud</p>
                <Button 
                  className="mt-4" 
                  onClick={handleClose}
                >
                  Volver
                </Button>
              </div>
            </div>
          )}
          
          {/* Event not found */}
          {!event && !isLoading && !error && (
            <div className="flex h-48 items-center justify-center">
              <div className="text-center p-4">
                <h2 className="text-lg font-semibold mb-2">No se encontró el evento</h2>
                <p className="text-neutral-500">El evento que buscas no existe o no tienes acceso</p>
                <Button 
                  className="mt-4" 
                  onClick={handleClose}
                >
                  Volver
                </Button>
              </div>
            </div>
          )}
          
          {/* Render edit form when event loaded successfully */}
          {event && formVisible && (
            <div className="event-edit-container">
              <EditEventFormGoogle 
                eventId={event.id}
                event={event}
                visible={true}
                onEventUpdated={() => {
                  // Llamar al callback si existe
                  if (onEventUpdated) {
                    onEventUpdated();
                  }
                  
                  // Emitir evento personalizado para asegurar que todas las vistas se actualicen
                  // incluso si el WebSocket no funciona correctamente
                  const eventUpdateEvent = new CustomEvent('event-updated', { 
                    detail: { eventId: event.id, data: event }
                  });
                  window.dispatchEvent(eventUpdateEvent);
                  console.log('Evento personalizado emitido desde EditEventSheet para:', event.id);
                }}
                onClose={handleClose}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// La interfaz Window.__PIPOL_UI_STATE ya está declarada en select.tsx

export default EditEventSheet;