import React, { createContext, useContext, useRef, useCallback, ReactNode } from 'react';
import mapboxgl from 'mapbox-gl';

interface CameraState {
  center: mapboxgl.LngLat;
  zoom: number;
  bearing: number;
  pitch: number;
}

interface MapContextType {
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  savedCameraState: React.MutableRefObject<CameraState | null>;
  saveCameraState: () => void;
  restoreCameraState: () => void;
  setMapInstance: (map: mapboxgl.Map) => void;
  clearMapInstance: () => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const savedCameraState = useRef<CameraState | null>(null);

  const setMapInstance = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;
    console.log("🗺️ MAP: Instancia del mapa configurada en el contexto");
    console.log("🗺️ MAP: mapRef.current ahora es:", mapRef.current);
  }, []);

  // Limpiar referencias cuando el componente se desmonte
  const clearMapInstance = useCallback(() => {
    mapRef.current = null;
    savedCameraState.current = null;
    console.log("🗺️ MAP: Referencias del mapa limpiadas del contexto");
  }, []);

  const saveCameraState = useCallback(() => {
    console.log("🚨 DEBUG: saveCameraState() EJECUTÁNDOSE");
    console.log("🚨 DEBUG: mapRef.current =", mapRef.current);
    if (!mapRef.current) {
      console.warn("⚠️ CAMERA: No hay instancia del mapa para guardar el estado");
      return;
    }

    const currentState: CameraState = {
      center: mapRef.current.getCenter(),
      zoom: mapRef.current.getZoom(),
      bearing: mapRef.current.getBearing(),
      pitch: mapRef.current.getPitch()
    };

    savedCameraState.current = currentState;
    console.log("🎥 CAMERA: Estado de cámara guardado:", currentState);
  }, []);

  const restoreCameraState = useCallback(() => {
    console.log("🚨 DEBUG: restoreCameraState() EJECUTÁNDOSE");
    console.log("🚨 DEBUG: mapRef.current =", mapRef.current);
    console.log("🚨 DEBUG: savedCameraState.current =", savedCameraState.current);
    console.log("🔄 RESTORE: Intentando restaurar cámara...");
    
    if (!mapRef.current) {
      console.error("❌ RESTORE: No hay instancia del mapa");
      return;
    }

    if (!savedCameraState.current) {
      console.warn("⚠️ RESTORE: No hay estado guardado de la cámara");
      return;
    }

    console.log("🔄 RESTORE: Ejecutando flyTo con estado:", savedCameraState.current);
    
    mapRef.current.flyTo({
      center: savedCameraState.current.center,
      zoom: savedCameraState.current.zoom,
      bearing: savedCameraState.current.bearing,
      pitch: savedCameraState.current.pitch,
      duration: 1200,
      essential: true
    });

    console.log("🔄 RESTORE: flyTo ejecutado exitosamente");
    
    // Limpiar el estado guardado después de la restauración
    savedCameraState.current = null;
    console.log("🔄 RESTORE: Estado guardado limpiado");
  }, []);

  const value: MapContextType = {
    mapRef,
    savedCameraState,
    saveCameraState,
    restoreCameraState,
    setMapInstance,
    clearMapInstance
  };

  return (
    <MapContext.Provider value={value}>
      {children}
    </MapContext.Provider>
  );
};

export const useMap = (): MapContextType => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMap debe ser usado dentro de un MapProvider');
  }
  return context;
};