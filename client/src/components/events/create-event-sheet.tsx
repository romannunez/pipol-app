import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import CreateEventFormGoogle from "@/components/events/create-event-form-google";
import { useNavigation } from "@/contexts/navigation-context";
import { X, ArrowLeft } from "lucide-react";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { usePanelGestures } from "@/hooks/use-panel-gestures";

// Componente para la creación de eventos en un panel deslizante

interface LocationData {
  latitude: number;
  longitude: number;
  locationName: string;
  locationAddress: string;
}

interface CreateEventSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: LocationData | null;
  onEventCreated?: () => void; // Callback para cuando se crea un evento
}

// Componente para la creación de eventos en un panel deslizante

const CreateEventSheet = ({ isOpen, onClose, initialLocation, onEventCreated }: CreateEventSheetProps) => {
  console.log("Renderizando CreateEventSheet, isOpen:", isOpen);
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { hideNavigation, showNavigation } = useNavigation();
  const [formVisible, setFormVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false); // Estado para controlar si hay menús desplegables abiertos
  const sheetRef = useRef<HTMLDivElement>(null);
  const createEventKey = useRef(0);
  
  // Manejar cierre con animación - definido antes del hook que lo usa
  const handleClose = () => {
    console.log("Iniciando cierre de CreateEventSheet con animación");
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 300); // Debe coincidir con la duración de la animación CSS
  };
  
  // Advanced gesture system with intelligent scroll detection
  const { height: panelHeight, isDragging, gestureHandlers } = usePanelGestures({
    minHeight: 25,
    maxHeight: 95,
    snapPositions: [35, 60, 90],
    velocityThreshold: 0.7,
    closeThreshold: 40,
    onClose: handleClose,
    enableRubberBanding: true,
    hapticFeedback: true,
    dragHandleSelector: '.panel-drag-handle', // Solo la barra superior permite arrastre
    contentScrollSelector: '.panel-content', // El área de contenido permite scroll
    intelligentScrollDetection: true,
  });
  
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
    console.log("Panel de crear evento montado con estado:", isOpen ? "abierto" : "cerrado");
  }, []);
  
  // Log para depuración
  useEffect(() => {
    console.log("Estado de CreateEventSheet:", { isOpen, closing, formVisible, user: !!user, authLoading });
  }, [isOpen, closing, formVisible, user, authLoading]);

  // Check authentication
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      toast({
        title: 'Autenticación Requerida',
        description: 'Por favor inicia sesión para crear eventos',
        variant: 'destructive',
      });
      handleClose();
      return;
    }
    
    // If authenticated, show the form
    setFormVisible(true);
  }, [user, authLoading, toast]);

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
        console.log(`Estado de menús desplegables actualizado: ${isOpen ? "ABIERTO" : "CERRADO"}`);
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
  }, [isOpen]);


  // Agregar estilos CSS para las animaciones
  useEffect(() => {
    // Agregar estilos si no existen
    if (!document.getElementById('slide-sheet-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'slide-sheet-styles';
      styleSheet.innerHTML = `
        .slide-up {
          animation: slideUp 0.3s ease forwards;
        }
        .slide-down {
          animation: slideDown 0.3s ease forwards;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideDown {
          from { transform: translateY(0); }
          to { transform: translateY(100%); }
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
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
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-panel z-20 flex flex-col event-panel ${closing ? 'slide-down' : 'slide-up'}`}
        style={{ 
          height: `${panelHeight}vh`,
          transition: isDragging ? 'none' : 'height 0.3s ease'
        }}
        onClick={(e) => e.stopPropagation()} // Evita que clics en el panel blanco lleguen al fondo
      >
        {/* Barra superior con indicador de arrastre y título - fija */}
        <div className="sticky top-0 z-10 bg-white rounded-t-3xl panel-drag-handle">
          <div 
            className="p-4 flex justify-center cursor-pointer select-none touch-none"
            {...gestureHandlers}
          >
            <div className={`w-10 h-1 bg-neutral-300 rounded-full transition-all duration-150 ${isDragging ? 'scale-110 bg-neutral-400' : ''}`}></div>
          </div>
          
          <div className="border-b border-gray-100">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center">
                <button onClick={handleClose} className="mr-3">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-medium">Crear evento</h2>
              </div>
              <button onClick={handleClose} className="text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Contenido principal con scroll - permite scroll natural */}
        <div className="flex-1 overflow-y-auto pb-20 panel-content" style={{ height: `calc(${panelHeight}vh - 70px)`, WebkitOverflowScrolling: 'touch' }}>
          
          {/* Loading state */}
          {authLoading && !formVisible && (
            <div className="flex h-48 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          )}
          
          {/* Render create form when authenticated */}
          {formVisible && (
            <div className="event-create-container pb-20">
              <CreateEventFormGoogle 
                key={`create-event-${createEventKey.current}`}
                onClose={handleClose} 
                visible={true} 
                initialLocation={initialLocation}
                onEventCreated={onEventCreated}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateEventSheet;