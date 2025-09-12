import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

// Definimos primero la interfaz para extender Window
declare global {
  interface Window {
    __PIPOL_UI_STATE: {
      selectMenuOpen: boolean;
      setSelectMenuOpen: (isOpen: boolean) => void;
      preventPanelClose: boolean;
    };
  }
}

// Creamos una variable global para un store sencillo
// Esto nos permitirá comunicar entre componentes sin props
window.__PIPOL_UI_STATE = window.__PIPOL_UI_STATE || {
  selectMenuOpen: false,
  setSelectMenuOpen: (isOpen: boolean) => {
    window.__PIPOL_UI_STATE.selectMenuOpen = isOpen;
    console.log(`Estado global de menú select: ${isOpen ? 'ABIERTO' : 'CERRADO'}`);
  },
  preventPanelClose: false
};

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => {
  // SOLUCIÓN DEFINITIVA PARA SELECT DROPDOWN
  
  React.useEffect(() => {
    // Notificar a la app que un menú select está abierto
    if (window.__PIPOL_UI_STATE) {
      window.__PIPOL_UI_STATE.setSelectMenuOpen(true);
      window.__PIPOL_UI_STATE.preventPanelClose = true;
      
      // Marcar todos los contenedores de dropdown y sus hijos para interceptar eventos
      setTimeout(() => {
        const contentWrappers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
        contentWrappers.forEach(wrapper => {
          // Añadir atributo para identificación fácil
          wrapper.setAttribute('data-pipol-dropdown', 'true');
          
          // Añadir clase para facilitar selección por CSS
          wrapper.classList.add('pipol-dropdown-content');
          
          // CRÍTICO: Evitar propagación de eventos de mousedown
          wrapper.addEventListener('mousedown', (e) => {
            console.log('⚡ Evento mousedown capturado en dropdown wrapper');
            e.stopPropagation();
          }, true);
          
          // Capturar todos los eventos click
          wrapper.addEventListener('click', (e) => {
            console.log('⚡ Evento click capturado en dropdown wrapper');
            e.stopPropagation();
          }, true);
          
          // Aplicar a todos los elementos internos
          const allChildren = wrapper.querySelectorAll('*');
          allChildren.forEach(child => {
            child.addEventListener('mousedown', (e) => {
              e.stopPropagation();
            }, true);
          });
          
          // Añadir un overlay invisible que capture clics
          const overlay = document.createElement('div');
          overlay.style.position = 'fixed';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100vw';
          overlay.style.height = '100vh';
          overlay.style.backgroundColor = 'transparent';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '9998';
          document.body.appendChild(overlay);
          
          // Después de un segundo, lo eliminamos
          setTimeout(() => {
            document.body.removeChild(overlay);
          }, 1000);
        });
      }, 10);
    }
    
    // Limpieza al desmontar
    return () => {
      if (window.__PIPOL_UI_STATE) {
        window.__PIPOL_UI_STATE.setSelectMenuOpen(false);
        
        // Mantener el preventPanelClose por un tiempo después de cerrar
        setTimeout(() => {
          window.__PIPOL_UI_STATE.preventPanelClose = false;
        }, 500);
      }
      
      // Eliminar atributos de los elementos marcados
      document.querySelectorAll('[data-pipol-dropdown]').forEach(el => {
        el.removeAttribute('data-pipol-dropdown');
      });
    };
  }, []);
  
  // Interceptar clics en todo el contenido
  const handleContentInteraction = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('⚡ Interacción interceptada en SelectContent');
  }, []);
  
  return (
    <SelectPrimitive.Portal>
      <div 
        className="pipol-select-wrapper"
        style={{ 
          position: 'relative',
          zIndex: 9999999,
          pointerEvents: 'auto'
        }}
        onClick={handleContentInteraction}
        onMouseDown={handleContentInteraction}
      >
        <SelectPrimitive.Content
          ref={ref}
          className={cn(
            "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            position === "popper" &&
              "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
            className
          )}
          position={position}
          {...props}
          onMouseDown={(e) => {
            e.stopPropagation();
            props.onMouseDown?.(e as any);
          }}
          onClick={(e) => {
            e.stopPropagation(); 
            props.onClick?.(e as any);
          }}
          onPointerDownOutside={(e) => {
            // Evitar que se cierre el panel cuando se hace clic fuera del dropdown
            if (window.__PIPOL_UI_STATE) {
              window.__PIPOL_UI_STATE.preventPanelClose = true;
              setTimeout(() => {
                window.__PIPOL_UI_STATE.preventPanelClose = false;
              }, 500);
            }
            
            // Ejecutar el manejador original si existe
            props.onPointerDownOutside?.(e);
          }}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.Viewport
            className={cn(
              "p-1",
              position === "popper" &&
                "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
            )}
            onClick={handleContentInteraction}
            onMouseDown={handleContentInteraction}
          >
            {children}
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton />
        </SelectPrimitive.Content>
      </div>
    </SelectPrimitive.Portal>
  );
})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
