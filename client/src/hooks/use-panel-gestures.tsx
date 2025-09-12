import { useState, useRef, useCallback, useEffect } from "react";

export interface PanelGestureOptions {
  minHeight: number;
  maxHeight: number;
  snapPositions: number[];
  velocityThreshold: number;
  closeThreshold: number;
  onClose?: () => void;
  enableRubberBanding?: boolean;
  hapticFeedback?: boolean;
  dragHandleSelector?: string; // Selector para la zona específica de arrastre
  contentScrollSelector?: string; // Selector para el contenido con scroll
  intelligentScrollDetection?: boolean; // Activar detección inteligente de scroll
}

export interface PanelGestureState {
  height: number;
  isDragging: boolean;
  velocity: number;
  isClosing: boolean;
}

export const usePanelGestures = (options: PanelGestureOptions) => {
  const {
    minHeight = 20,
    maxHeight = 95,
    snapPositions = [30, 60, 90],
    velocityThreshold = 0.5,
    closeThreshold = 35,
    onClose,
    enableRubberBanding = true,
    hapticFeedback = false,
    dragHandleSelector = '.panel-drag-handle',
    contentScrollSelector = '.panel-content',
    intelligentScrollDetection = true,
  } = options;

  const [height, setHeight] = useState(snapPositions[snapPositions.length - 1]);
  const [isDragging, setIsDragging] = useState(false);
  const [velocity, setVelocity] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const velocityHistory = useRef<Array<{ v: number; t: number }>>([]);
  const animationFrameId = useRef<number>();
  const isDragAllowed = useRef(false);
  const initialScrollTop = useRef(0);
  const gestureStartTarget = useRef<HTMLElement | null>(null);

  // Calculate rubber band effect
  const applyRubberBand = useCallback((value: number, min: number, max: number): number => {
    if (!enableRubberBanding) {
      return Math.max(min, Math.min(max, value));
    }

    if (value < min) {
      const diff = min - value;
      const resistance = 0.3; // Rubber band resistance factor
      return min - diff * resistance;
    } else if (value > max) {
      const diff = value - max;
      const resistance = 0.3;
      return max + diff * resistance;
    }
    return value;
  }, [enableRubberBanding]);

  // Calculate velocity with smoothing
  const updateVelocity = useCallback((currentY: number, currentTime: number) => {
    const deltaY = currentY - lastY.current;
    const deltaTime = Math.max(currentTime - lastTime.current, 1);
    const currentVelocity = (deltaY / deltaTime) * 16.67; // Normalize to 60fps

    velocityHistory.current.push({ v: currentVelocity, t: currentTime });
    
    // Keep only recent history (last 100ms)
    const cutoff = currentTime - 100;
    velocityHistory.current = velocityHistory.current.filter(entry => entry.t > cutoff);

    // Calculate average velocity from history for smoothing
    if (velocityHistory.current.length > 0) {
      const totalV = velocityHistory.current.reduce((sum, entry) => sum + entry.v, 0);
      setVelocity(totalV / velocityHistory.current.length);
    }

    lastY.current = currentY;
    lastTime.current = currentTime;
  }, []);

  // Find the best snap position based on current height and velocity
  const findBestSnapPosition = useCallback((currentHeight: number, currentVelocity: number): number => {
    const sortedPositions = [...snapPositions].sort((a, b) => a - b);
    
    // If velocity is high, consider velocity-based snapping
    if (Math.abs(currentVelocity) > velocityThreshold) {
      if (currentVelocity > 0) {
        // Moving up, find next higher position
        const higher = sortedPositions.find(pos => pos > currentHeight);
        if (higher) return higher;
        return sortedPositions[sortedPositions.length - 1];
      } else {
        // Moving down, find next lower position
        const lower = [...sortedPositions].reverse().find(pos => pos < currentHeight);
        if (lower) return lower;
        return sortedPositions[0];
      }
    }

    // No significant velocity, snap to nearest position
    let closest = sortedPositions[0];
    let minDistance = Math.abs(currentHeight - closest);

    for (const position of sortedPositions) {
      const distance = Math.abs(currentHeight - position);
      if (distance < minDistance) {
        minDistance = distance;
        closest = position;
      }
    }

    return closest;
  }, [snapPositions, velocityThreshold]);

  // Haptic feedback simulation
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!hapticFeedback || typeof navigator === 'undefined' || !navigator.vibrate) {
      return;
    }

    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30],
    };

    navigator.vibrate(patterns[type]);
  }, [hapticFeedback]);

  // Función para determinar si un gesto debe activar el panel o permitir scroll
  const shouldAllowPanelGesture = useCallback((target: HTMLElement, deltaY: number, isInitial: boolean = false): boolean => {
    if (!intelligentScrollDetection) return true;

    // Si el gesto comienza en el área de arrastre, siempre permitir
    const dragHandle = target.closest(dragHandleSelector);
    if (dragHandle) {
      console.log("🎯 Gesto iniciado en zona de arrastre - permitir manipulación del panel");
      return true;
    }

    // Si no está en una zona de arrastre y es el primer movimiento, verificar el contenido
    if (isInitial) {
      const scrollContainer = target.closest(contentScrollSelector) as HTMLElement;
      if (scrollContainer) {
        const canScrollUp = scrollContainer.scrollTop > 0;
        const canScrollDown = scrollContainer.scrollTop < (scrollContainer.scrollHeight - scrollContainer.clientHeight);
        
        console.log("📱 Verificando capacidad de scroll:", { 
          canScrollUp, 
          canScrollDown, 
          deltaY,
          scrollTop: scrollContainer.scrollTop,
          scrollHeight: scrollContainer.scrollHeight,
          clientHeight: scrollContainer.clientHeight
        });

        // Si el usuario está intentando hacer scroll hacia arriba y el contenido puede scrollear hacia arriba
        if (deltaY > 0 && canScrollUp) {
          console.log("⬆️ Permitir scroll hacia arriba en contenido");
          return false;
        }

        // Si el usuario está intentando hacer scroll hacia abajo y el contenido puede scrollear hacia abajo
        if (deltaY < 0 && canScrollDown) {
          console.log("⬇️ Permitir scroll hacia abajo en contenido");
          return false;
        }

        // Si el contenido no puede scrollear en esa dirección, permitir manipulación del panel
        console.log("🎯 Contenido no puede scrollear en esa dirección - permitir manipulación del panel");
        return true;
      }
    }

    // Por defecto, permitir manipulación del panel
    return true;
  }, [intelligentScrollDetection, dragHandleSelector, contentScrollSelector]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const target = e.target as HTMLElement;
    
    gestureStartTarget.current = target;
    dragStartY.current = touch.clientY;
    dragStartHeight.current = height;
    lastY.current = touch.clientY;
    lastTime.current = performance.now();
    velocityHistory.current = [];
    isDragAllowed.current = false; // Iniciamos como no permitido hasta evaluar
    
    // Guardamos el scroll inicial del contenido si existe
    const scrollContainer = target.closest(contentScrollSelector) as HTMLElement;
    if (scrollContainer) {
      initialScrollTop.current = scrollContainer.scrollTop;
    }
    
    console.log("👆 Inicio de gesto táctil en:", target.className);
  }, [height, contentScrollSelector]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const deltaY = dragStartY.current - currentY;
    
    // En el primer movimiento, determinar si debemos permitir el gesto del panel
    if (!isDragAllowed.current && gestureStartTarget.current) {
      const shouldAllow = shouldAllowPanelGesture(gestureStartTarget.current, deltaY, true);
      
      if (!shouldAllow) {
        console.log("🚫 Gesto de panel no permitido - permitir scroll natural");
        return; // Permitir que el scroll natural funcione
      }
      
      // Si llegamos aquí, permitimos el gesto del panel
      isDragAllowed.current = true;
      setIsDragging(true);
      
      // Prevenir scrolling solo cuando confirmamos que es un gesto del panel
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      
      triggerHaptic('light');
      console.log("✅ Gesto de panel permitido - iniciando manipulación");
    }
    
    if (!isDragging || !isDragAllowed.current) return;
    
    const currentTime = performance.now();
    updateVelocity(currentY, currentTime);
    
    const viewportHeight = window.innerHeight;
    const heightChange = (deltaY / viewportHeight) * 100;
    
    let newHeight = dragStartHeight.current + heightChange;
    newHeight = applyRubberBand(newHeight, minHeight, maxHeight);
    
    setHeight(newHeight);
    
    e.preventDefault();
    e.stopPropagation();
  }, [isDragging, updateVelocity, applyRubberBand, minHeight, maxHeight, shouldAllowPanelGesture, triggerHaptic]);

  const handleTouchEnd = useCallback(() => {
    // Limpiar el estado sin importar si estábamos arrastrando o no
    gestureStartTarget.current = null;
    
    if (!isDragging || !isDragAllowed.current) {
      isDragAllowed.current = false;
      return;
    }
    
    setIsDragging(false);
    isDragAllowed.current = false;
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    
    const currentVelocity = velocity;
    let targetHeight: number;

    // Check if should close
    if (height < closeThreshold || (currentVelocity < -1 && height < 50)) {
      setIsClosing(true);
      targetHeight = minHeight;
      triggerHaptic('medium');
      setTimeout(() => {
        onClose?.();
      }, 250);
    } else {
      targetHeight = findBestSnapPosition(height, currentVelocity);
      
      // Trigger haptic feedback for snap
      if (Math.abs(targetHeight - height) > 5) {
        triggerHaptic('light');
      }
    }

    // Smooth animation to target height
    const animate = () => {
      setHeight(current => {
        const diff = targetHeight - current;
        const newHeight = current + diff * 0.15; // Easing factor
        
        if (Math.abs(diff) < 0.5) {
          return targetHeight;
        }
        
        animationFrameId.current = requestAnimationFrame(animate);
        return newHeight;
      });
    };
    
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    animate();
    
    // Reset velocity after a delay
    setTimeout(() => {
      setVelocity(0);
      velocityHistory.current = [];
    }, 100);
  }, [isDragging, height, velocity, closeThreshold, minHeight, findBestSnapPosition, onClose, triggerHaptic]);

  // Mouse events for desktop compatibility
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Para mouse, solo permitir si es en la zona de arrastre
    const dragHandle = target.closest(dragHandleSelector);
    if (!dragHandle) {
      console.log("🖱️ Clic de mouse fuera de la zona de arrastre - ignorar");
      return;
    }
    
    const mouseY = e.clientY;
    setIsDragging(true);
    isDragAllowed.current = true;
    dragStartY.current = mouseY;
    dragStartHeight.current = height;
    lastY.current = mouseY;
    lastTime.current = performance.now();
    velocityHistory.current = [];
    
    document.body.style.overflow = 'hidden';
    document.body.style.userSelect = 'none';
    
    console.log("🖱️ Inicio de arrastre con mouse en zona permitida");
  }, [height, dragHandleSelector]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !isDragAllowed.current) return;
    
    const currentY = e.clientY;
    const currentTime = performance.now();
    
    updateVelocity(currentY, currentTime);
    
    const deltaY = dragStartY.current - currentY;
    const viewportHeight = window.innerHeight;
    const heightChange = (deltaY / viewportHeight) * 100;
    
    let newHeight = dragStartHeight.current + heightChange;
    newHeight = applyRubberBand(newHeight, minHeight, maxHeight);
    
    setHeight(newHeight);
  }, [isDragging, updateVelocity, applyRubberBand, minHeight, maxHeight]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !isDragAllowed.current) return;
    
    setIsDragging(false);
    isDragAllowed.current = false;
    document.body.style.overflow = '';
    document.body.style.userSelect = '';
    
    const currentVelocity = velocity;
    let targetHeight: number;

    if (height < closeThreshold || (currentVelocity < -1 && height < 50)) {
      setIsClosing(true);
      targetHeight = minHeight;
      setTimeout(() => {
        onClose?.();
      }, 250);
    } else {
      targetHeight = findBestSnapPosition(height, currentVelocity);
    }

    // Smooth animation to target height
    const animate = () => {
      setHeight(current => {
        const diff = targetHeight - current;
        const newHeight = current + diff * 0.15;
        
        if (Math.abs(diff) < 0.5) {
          return targetHeight;
        }
        
        animationFrameId.current = requestAnimationFrame(animate);
        return newHeight;
      });
    };
    
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    animate();
    
    setTimeout(() => {
      setVelocity(0);
      velocityHistory.current = [];
    }, 100);
  }, [isDragging, height, velocity, closeThreshold, minHeight, findBestSnapPosition, onClose]);

  // Setup mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.userSelect = '';
    };
  }, []);

  return {
    height,
    isDragging,
    velocity,
    isClosing,
    setHeight,
    gestureHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleMouseDown,
    },
  };
};