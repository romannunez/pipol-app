// Initialize Mapbox
import mapboxgl from 'mapbox-gl';

// Ensure there's a valid public key
if (!import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) {
  console.warn('Missing Mapbox access token. Map functionality will be limited.');
}

// Set the access token for Mapbox
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoicm9tYW5waXBvbCIsImEiOiJjbWFiaG1tZzcyYXVoMnBwenJmbTVjamRmIn0.dtOq8JKtV9KwUu9vczQ9Rg';

export const defaultMapConfig = {
  lat: -31.428, // Default to Córdoba, Argentina
  lng: -64.185,
  zoom: 16 // Nivel de zoom mayor para ver mejor los marcadores
};

// Map style options
export enum MapStyle {
  STREETS_2D = 'mapbox://styles/mapbox/streets-v11',
  STREETS_DARK_2D = 'mapbox://styles/mapbox/dark-v11',
  SATELLITE_2D = 'mapbox://styles/mapbox/satellite-streets-v11',
  STANDARD_3D = 'mapbox://styles/mapbox/standard',
  STANDARD_SATELLITE = 'mapbox://styles/mapbox/standard-satellite'
}

// Light presets for different times of day
export enum LightPreset {
  // Eliminado DAY como solicitado
  DAWN = 'dawn',
  DUSK = 'dusk',
  NIGHT = 'night'
}

// Theme options for the standard style
export enum MapTheme {
  DEFAULT = 'default',
  FADED = 'faded',
  MONOCHROME = 'monochrome'
}

// Font options for Mapbox styles
export enum MapFont {
  DEFAULT = 'default',
  // Add other font options when known
}

// Interface for Map configuration options
export interface MapConfigOptions {
  // Visual elements
  showPlaceLabels: boolean;
  showRoadLabels: boolean;
  showPointOfInterestLabels: boolean;
  showTransitLabels: boolean;
  show3dObjects: boolean;
  // Style options
  theme: MapTheme;
  lightPreset: LightPreset;
  font: MapFont;
  // Satellite specific options
  showRoadsAndTransit?: boolean;
  showPedestrianRoads?: boolean;
  // Auto time of day
  useAutoLightPreset: boolean;
}

// Default configuration for the map
export const defaultMapConfig3D: MapConfigOptions = {
  showPlaceLabels: true,
  showRoadLabels: true,
  showPointOfInterestLabels: true,
  showTransitLabels: true,
  show3dObjects: true,
  theme: MapTheme.DEFAULT,
  lightPreset: LightPreset.DAWN, // Usar DAWN en lugar de DAY
  font: MapFont.DEFAULT,
  useAutoLightPreset: true
};

// Get appropriate light preset based on current time
export function getLightPresetByTime(): LightPreset {
  const currentHour = new Date().getHours();
  
  if (currentHour >= 6 && currentHour < 8) {
    // Early morning (6:00 AM - 8:00 AM)
    return LightPreset.DAWN;
  } else if (currentHour >= 8 && currentHour < 18) {
    // Daytime (8:00 AM - 6:00 PM) - Usando DAWN en lugar de DAY como fue solicitado
    return LightPreset.DAWN;
  } else if (currentHour >= 18 && currentHour < 20) {
    // Evening (6:00 PM - 8:00 PM)
    return LightPreset.DUSK;
  } else {
    // Night (8:00 PM - 6:00 AM)
    return LightPreset.NIGHT;
  }
}

// Get 2D map style - always returns regular street view regardless of time
export function get2DMapStyleByTime(): MapStyle {
  // Always return the regular streets style for 2D mode
  return MapStyle.STREETS_2D;
}

// Initialize map in a container element with appropriate style based on mode and time of day
export function initializeMap(container: string | HTMLElement, use3D = true): mapboxgl.Map {
  const map = new mapboxgl.Map({
    container,
    style: use3D ? MapStyle.STANDARD_3D : get2DMapStyleByTime(),
    center: [defaultMapConfig.lng, defaultMapConfig.lat],
    zoom: defaultMapConfig.zoom,
    pitch: use3D ? 45 : 0, // Add pitch for 3D effect
    attributionControl: false, // Hide attribution control
    logoPosition: 'bottom-right' as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  });

  // Do not add any navigation controls to keep them completely hidden

  // Si estamos en modo 3D, aplicar iluminación apropiada inmediatamente al cargar el estilo
  if (use3D) {
    const currentLightPreset = getLightPresetByTime();
    console.log(`Aplicando iluminación inicial en initializeMap: ${currentLightPreset}`);
    
    // Aplicar configuración de iluminación cuando el estilo se termine de cargar
    map.once('style.load', () => {
      try {
        // Forzar la configuración de iluminación
        map.setConfigProperty('basemap', 'lightPreset', currentLightPreset);
        console.log(`Iluminación aplicada en initializeMap: ${currentLightPreset}`);
      } catch (err) {
        console.error('Error al aplicar iluminación en initializeMap:', err);
      }
    });
  }
  
  return map;
}

// Set map to 3D style with Standard style and 3D buildings, landmarks, etc.
export function enable3DMap(map: mapboxgl.Map): void {
  // Guardar estado actual del mapa
  const center = map.getCenter();
  const zoom = map.getZoom();
  const bearing = map.getBearing();
  
  // Obtener el preset de iluminación actual antes de cambiar el estilo
  const currentLightPreset = getLightPresetByTime();
  console.log(`[MODO 3D] Aplicando iluminación: ${currentLightPreset}`);
  
  // Si el mapa ya tiene un estilo 3D, verificamos si la iluminación es correcta sin cambiar
  const isAlready3D = map.getStyle().name?.includes("Standard");
  if (isAlready3D) {
    console.log("[MODO 3D] El mapa ya está en 3D, verificando iluminación");
    try {
      const currentPreset = map.getConfigProperty('basemap', 'lightPreset');
      if (currentPreset !== currentLightPreset) {
        console.log(`[MODO 3D] Actualizando iluminación de ${currentPreset} a ${currentLightPreset}`);
        map.setConfigProperty('basemap', 'lightPreset', currentLightPreset);
      } else {
        console.log(`[MODO 3D] Iluminación ya correcta: ${currentPreset}`);
      }
      return; // No necesitamos cambiar el estilo
    } catch (err) {
      console.error('[MODO 3D] Error al verificar iluminación actual:', err);
      // Continuamos con el cambio de estilo para resolver el problema
    }
  }
  
  // Crear un sistema de varios intentos
  const maxRetries = 3;
  let retryCount = 0;
  
  // Función para aplicar configuración con reintentos
  const applySettings = () => {
    try {
      console.log(`[MODO 3D] Intento ${retryCount + 1}/${maxRetries} de aplicar configuración`);
      
      // IMPORTANTE: Primero restaurar posición
      map.setCenter(center);
      map.setZoom(zoom);
      map.setBearing(bearing);
      map.setPitch(45); // Garantizar vista inclinada
      
      // 1. Garantizar que se muestran objetos 3D
      map.setConfigProperty('basemap', 'show3dObjects', true);
      
      // 2. IMPORTANTE: Forzar la aplicación del preset de iluminación según la hora actual
      map.setConfigProperty('basemap', 'lightPreset', currentLightPreset);
      
      // 3. Configurar para que la iluminación se actualice automáticamente
      map.setConfigProperty('basemap', 'useAutoLightPreset', true);
      
      console.log(`[MODO 3D] Iluminación ${currentLightPreset} aplicada correctamente`);
      
      // Programar verificación
      scheduleVerification();
    } catch (err) {
      console.error('[MODO 3D] Error al aplicar configuración:', err);
      
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`[MODO 3D] Reintentando en 300ms (${retryCount}/${maxRetries})`);
        setTimeout(applySettings, 300);
      }
    }
  };
  
  // Función para verificar y corregir
  const scheduleVerification = () => {
    // Verificar después de un retraso
    setTimeout(() => {
      try {
        if (!map.isStyleLoaded()) {
          console.log('[MODO 3D] Estilo aún no cargado en verificación, esperando');
          return scheduleVerification(); // Reprogramar
        }
        
        const appliedPreset = map.getConfigProperty('basemap', 'lightPreset');
        console.log(`[MODO 3D] Verificando preset aplicado: ${appliedPreset}`);
        
        // Si no coincide, forzar de nuevo
        if (appliedPreset !== currentLightPreset) {
          console.log(`[MODO 3D] Corrigiendo preset de ${appliedPreset} a ${currentLightPreset}`);
          map.setConfigProperty('basemap', 'lightPreset', currentLightPreset);
          
          // Programar una verificación final
          setTimeout(() => {
            try {
              const finalPreset = map.getConfigProperty('basemap', 'lightPreset');
              console.log(`[MODO 3D] Verificación final: ${finalPreset}`);
            } catch (e) {
              console.error('[MODO 3D] Error en verificación final:', e);
            }
          }, 500);
        } else {
          console.log(`[MODO 3D] Iluminación verificada correctamente: ${appliedPreset}`);
        }
      } catch (err) {
        console.error('[MODO 3D] Error en verificación de iluminación:', err);
        
        if (retryCount < maxRetries) {
          retryCount++;
          applySettings(); // Intentar de nuevo
        }
      }
    }, 500);
  };
  
  // Cambiar a estilo 3D
  console.log('[MODO 3D] Cambiando estilo a 3D Standard');
  map.setStyle(MapStyle.STANDARD_3D);
  
  // Esperar a que el estilo se cargue para aplicar configuración
  map.once('style.load', () => {
    console.log('[MODO 3D] Evento style.load detectado');
    // Pequeño retraso para asegurar que todo está listo
    setTimeout(applySettings, 100);
  });
}

// Set map to 2D style with standard street style (no time-based changes in 2D)
export function enable2DMap(map: mapboxgl.Map): void {
  // Guardar el centro y zoom actuales
  const center = map.getCenter();
  const zoom = map.getZoom();
  
  console.log('Cambiando a modo 2D, guardando configuración actual');
  
  // Always use standard streets style for 2D mode
  map.setStyle(MapStyle.STREETS_2D);
  map.setPitch(0); // Reset pitch for 2D view
  
  // Cuando el estilo esté cargado, restaurar la posición
  map.once('style.load', () => {
    try {
      map.setCenter(center);
      map.setZoom(zoom);
      console.log('Estilo 2D cargado, posición restaurada');
    } catch (err) {
      console.error('Error al restaurar posición en modo 2D:', err);
    }
  });
}

// Get current user location and center map to it
export function getUserLocation(map: mapboxgl.Map): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.flyTo({
          center: [longitude, latitude],
          zoom: 14,
          essential: true
        });
        resolve(position);
      },
      (error) => {
        console.error('Error getting location:', error);
        reject(error);
      }
    );
  });
}

// Add a marker to the map
export function addMarker(
  map: mapboxgl.Map, 
  longitude: number, 
  latitude: number,
  element?: HTMLElement
): mapboxgl.Marker {
  const marker = new mapboxgl.Marker(element)
    .setLngLat([longitude, latitude])
    .addTo(map);
  
  return marker;
}

// Get address from coordinates using Mapbox Geocoding API
export async function reverseGeocode(longitude: number, latitude: number): Promise<string> {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxgl.accessToken}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to geocode location');
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      return data.features[0].place_name;
    }
    
    return 'Unknown location';
  } catch (error) {
    console.error('Geocoding error:', error);
    return 'Unknown location';
  }
}

// Search for locations with Mapbox Geocoding API
export async function searchLocations(query: string, types?: string[]): Promise<any[]> {
  try {
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}`;
    
    // Add types filter if specified (e.g., 'poi' for points of interest, 'address' for addresses)
    if (types && types.length > 0) {
      url += `&types=${types.join(',')}`;
    }
    
    // Add autocomplete parameter for better suggestions
    url += `&autocomplete=true`;
    
    // Add language parameter for Spanish results
    url += `&language=es`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to search locations');
    }
    
    const data = await response.json();
    return data.features || [];
  } catch (error) {
    console.error('Location search error:', error);
    return [];
  }
}

// Configurar actualizaciones automáticas de iluminación basadas en tiempo
export function setupAutoLightingUpdates(map: mapboxgl.Map): () => void {
  console.log('Configurando actualizaciones automáticas de iluminación');
  
  // Aplicar iluminación inicial
  const initialPreset = getLightPresetByTime();
  console.log(`Preset inicial a aplicar: ${initialPreset}`);
  
  // Función para aplicar la iluminación con múltiples intentos
  const applyLightingWithRetry = (preset: LightPreset, retryCount = 0, maxRetries = 3) => {
    try {
      if (!map || !map.isStyleLoaded()) {
        console.log('Mapa no listo, esperando evento style.load');
        
        // Si el mapa no está listo, esperar a que lo esté
        const styleLoadHandler = () => {
          console.log('Evento style.load detectado, intentando aplicar iluminación');
          setTimeout(() => applyLightingWithRetry(preset, 0, maxRetries), 200);
        };
        
        map.once('style.load', styleLoadHandler);
        return;
      }
      
      // Intentar aplicar la configuración
      map.setConfigProperty('basemap', 'lightPreset', preset);
      console.log(`Iluminación ${preset} aplicada correctamente en intento ${retryCount + 1}`);
      
      // Verificar después de un momento
      setTimeout(() => {
        try {
          const appliedPreset = map.getConfigProperty('basemap', 'lightPreset');
          if (appliedPreset !== preset) {
            console.log(`Verificación falló: ${appliedPreset} != ${preset}, reintentando`);
            if (retryCount < maxRetries) {
              applyLightingWithRetry(preset, retryCount + 1, maxRetries);
            } else {
              console.error(`No se pudo aplicar ${preset} después de ${maxRetries} intentos`);
            }
          } else {
            console.log(`Verificación exitosa: iluminación ${preset} aplicada correctamente`);
          }
        } catch (err) {
          console.error('Error en verificación de iluminación:', err);
        }
      }, 300);
    } catch (err) {
      console.error(`Error al aplicar iluminación ${preset}:`, err);
      
      // Reintentar si no se ha alcanzado el límite
      if (retryCount < maxRetries) {
        console.log(`Reintentando aplicar ${preset} en 500ms (intento ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => applyLightingWithRetry(preset, retryCount + 1, maxRetries), 500);
      }
    }
  };
  
  // Aplicar iluminación inicial
  applyLightingWithRetry(initialPreset);
  
  // Función para actualizar la iluminación basada en la hora actual
  const updateLighting = () => {
    const currentTimePreset = getLightPresetByTime();
    console.log(`Verificando actualización de iluminación a: ${currentTimePreset}`);
    
    // Comprobar si el preset actual es diferente al que debería ser según la hora
    try {
      if (map && map.isStyleLoaded()) {
        const currentAppliedPreset = map.getConfigProperty('basemap', 'lightPreset');
        
        if (currentAppliedPreset !== currentTimePreset) {
          console.log(`Actualizando iluminación de ${currentAppliedPreset} a ${currentTimePreset}`);
          applyLightingWithRetry(currentTimePreset);
        } else {
          console.log(`Iluminación ya correcta: ${currentTimePreset}`);
        }
      }
    } catch (err) {
      console.error('Error al comprobar preset actual:', err);
      // En caso de error, intentar aplicar de todos modos
      applyLightingWithRetry(currentTimePreset);
    }
  };
  
  // Configurar intervalo para actualizar la iluminación cada 2 minutos
  const intervalId = setInterval(updateLighting, 2 * 60 * 1000); // 2 minutos
  
  // También actualizar cuando cambie la visualización del mapa
  map.on('style.load', () => {
    console.log('Evento style.load detectado, actualizando iluminación');
    setTimeout(updateLighting, 300); // Pequeño retraso para asegurar que el estilo está completamente cargado
  });
  
  // Devolver función para limpiar el intervalo y eventos cuando sea necesario
  return () => {
    console.log('Deteniendo actualizaciones automáticas de iluminación');
    clearInterval(intervalId);
    // Eliminar listeners si es necesario
    map.off('style.load', updateLighting);
  };
}

// Apply map configuration settings
export function applyMapConfig(map: mapboxgl.Map, config: Partial<MapConfigOptions>): void {
  if (!map) return;

  // Make sure the style is loaded
  const applySettings = () => {
    try {
      // Verificar si el estilo actual es satelital para manejo especial
      const style = map.getStyle();
      const styleJson = JSON.stringify(style).toLowerCase();
      const isSatelliteStyle = styleJson.includes('satellite');
      
      // Apply each configuration property if it exists
      if (config.showPlaceLabels !== undefined)
        map.setConfigProperty('basemap', 'showPlaceLabels', config.showPlaceLabels);
      
      if (config.showRoadLabels !== undefined)
        map.setConfigProperty('basemap', 'showRoadLabels', config.showRoadLabels);
      
      if (config.showPointOfInterestLabels !== undefined)
        map.setConfigProperty('basemap', 'showPointOfInterestLabels', config.showPointOfInterestLabels);
      
      if (config.showTransitLabels !== undefined)
        map.setConfigProperty('basemap', 'showTransitLabels', config.showTransitLabels);
      
      if (config.show3dObjects !== undefined)
        map.setConfigProperty('basemap', 'show3dObjects', config.show3dObjects);
      
      if (config.theme !== undefined)
        map.setConfigProperty('basemap', 'theme', config.theme);
      
      // Light preset configuration is especially important to persist
      if (config.lightPreset !== undefined) {
        // Apply the light preset configuration
        map.setConfigProperty('basemap', 'lightPreset', config.lightPreset);
        
        // Add a small delay to ensure the configuration is properly applied
        setTimeout(() => {
          try {
            const currentValue = map.getConfigProperty('basemap', 'lightPreset');
            
            // Try to apply again if it doesn't match the expected value
            if (currentValue !== config.lightPreset) {
              map.setConfigProperty('basemap', 'lightPreset', config.lightPreset);
            }
          } catch (e) {
            console.warn('Error verifying light preset configuration');
          }
        }, 100);
      }
      
      if (config.font !== undefined)
        map.setConfigProperty('basemap', 'font', config.font);
      
      // Satellite specific options
      if (config.showRoadsAndTransit !== undefined)
        map.setConfigProperty('basemap', 'showRoadsAndTransit', config.showRoadsAndTransit);
      
      if (config.showPedestrianRoads !== undefined)
        map.setConfigProperty('basemap', 'showPedestrianRoads', config.showPedestrianRoads);
      
      // Map configuration successfully applied
    } catch (err) {
      console.error('Error applying map configuration');
    }
  };

  // If the style is already loaded, apply settings immediately
  if (map.isStyleLoaded()) {
    applySettings();
  } else {
    // Otherwise, wait for the style to load
    map.once('style.load', applySettings);
  }
}



// Enable satellite map view in either 2D or 3D mode
export function enableSatelliteMap(map: mapboxgl.Map, use3D: boolean = false): void {
  // Guardar estado actual del mapa
  const center = map.getCenter();
  const zoom = map.getZoom();
  const bearing = map.getBearing();
  
  // Obtener el preset de iluminación actual antes de cambiar el estilo
  const currentLightPreset = getLightPresetByTime();
  console.log(`[SATÉLITE] Aplicando iluminación: ${currentLightPreset}, Modo 3D: ${use3D}`);
  
  // Choose between 3D satellite or 2D satellite style
  const satelliteStyle = use3D ? MapStyle.STANDARD_SATELLITE : MapStyle.SATELLITE_2D;
  
  // Verificar si ya estamos en el modo correcto
  const currentStyle = map.getStyle();
  const isSatelliteStyle = currentStyle.name?.includes("Satellite") || false;
  const isCurrently3D = currentStyle.name?.includes("Standard") || false;
  
  if (isSatelliteStyle && ((use3D && isCurrently3D) || (!use3D && !isCurrently3D))) {
    console.log(`[SATÉLITE] Ya estamos en modo satélite ${use3D ? '3D' : '2D'}, solo verificando configuración`);
    
    if (use3D) {
      try {
        const currentAppliedPreset = map.getConfigProperty('basemap', 'lightPreset');
        if (currentAppliedPreset !== currentLightPreset) {
          console.log(`[SATÉLITE] Actualizando iluminación de ${currentAppliedPreset} a ${currentLightPreset}`);
          map.setConfigProperty('basemap', 'lightPreset', currentLightPreset);
        } else {
          console.log(`[SATÉLITE] Iluminación ya correcta: ${currentAppliedPreset}`);
        }
      } catch (err) {
        console.error('[SATÉLITE] Error al verificar iluminación actual:', err);
      }
      return; // No hace falta cambiar el estilo
    }
  }
  
  // Cambiar estilo
  console.log(`[SATÉLITE] Cambiando a estilo satélite ${use3D ? '3D' : '2D'}`);
  map.setStyle(satelliteStyle);
  
  // Set appropriate pitch
  map.setPitch(use3D ? 45 : 0);
  
  // Crear un sistema de varios intentos para configurar iluminación en 3D
  const maxRetries = 3;
  let retryCount = 0;
  
  // Función para aplicar configuración con reintentos
  const applySatelliteSettings = () => {
    try {
      // Restaurar posición
      map.setCenter(center);
      map.setZoom(zoom);
      map.setBearing(bearing);
      
      if (use3D) {
        console.log(`[SATÉLITE] Intento ${retryCount + 1}/${maxRetries} de aplicar configuración 3D`);
        
        // 1. Forzar la aplicación del preset de iluminación según la hora actual
        map.setConfigProperty('basemap', 'lightPreset', currentLightPreset);
        
        // 2. Garantizar que se muestran objetos 3D
        map.setConfigProperty('basemap', 'show3dObjects', true);
        
        // 3. Configurar para que la iluminación se actualice automáticamente
        map.setConfigProperty('basemap', 'useAutoLightPreset', true);
        
        console.log(`[SATÉLITE] Iluminación ${currentLightPreset} aplicada correctamente en modo 3D`);
        
        // Programar verificación
        setTimeout(verifySatelliteSettings, 500);
      }
    } catch (err) {
      console.error('[SATÉLITE] Error al aplicar configuración:', err);
      
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`[SATÉLITE] Reintentando en 300ms (${retryCount}/${maxRetries})`);
        setTimeout(applySatelliteSettings, 300);
      }
    }
  };
  
  // Función para verificar y corregir
  const verifySatelliteSettings = () => {
    if (!use3D) return; // Solo verificar en modo 3D
    
    try {
      // Verificar si se aplicó correctamente
      const appliedPreset = map.getConfigProperty('basemap', 'lightPreset');
      console.log(`[SATÉLITE] Verificando preset aplicado: ${appliedPreset}`);
      
      // Si no coincide, forzar de nuevo
      if (appliedPreset !== currentLightPreset) {
        console.log(`[SATÉLITE] Corrigiendo preset de ${appliedPreset} a ${currentLightPreset}`);
        map.setConfigProperty('basemap', 'lightPreset', currentLightPreset);
        
        // Verificación final
        setTimeout(() => {
          try {
            const finalPreset = map.getConfigProperty('basemap', 'lightPreset');
            console.log(`[SATÉLITE] Verificación final: ${finalPreset}`);
          } catch (e) {
            console.error('[SATÉLITE] Error en verificación final:', e);
          }
        }, 500);
      } else {
        console.log(`[SATÉLITE] Iluminación verificada correctamente: ${appliedPreset}`);
      }
    } catch (err) {
      console.error('[SATÉLITE] Error en verificación:', err);
      
      // Un último intento si falla la verificación
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(() => {
          try {
            map.setConfigProperty('basemap', 'lightPreset', currentLightPreset);
            console.log(`[SATÉLITE] Intento final de configuración aplicado`);
          } catch (retryErr) {
            console.error('[SATÉLITE] Error en intento final:', retryErr);
          }
        }, 800);
      }
    }
  };
  
  // Esperar a que el estilo se cargue para aplicar configuración
  map.once('style.load', () => {
    console.log(`[SATÉLITE] Estilo satélite ${use3D ? '3D' : '2D'} cargado`);
    // Pequeño retraso para asegurar que todo está listo
    setTimeout(applySatelliteSettings, 100);
  });
}

export default {
  initializeMap,
  getUserLocation,
  addMarker,
  reverseGeocode,
  searchLocations,
  defaultMapConfig,
  defaultMapConfig3D,
  enable3DMap,
  enable2DMap,
  enableSatelliteMap,
  applyMapConfig,
  MapStyle,
  MapTheme,
  MapFont,
  getLightPresetByTime,
  LightPreset,
  get2DMapStyleByTime,
  setupAutoLightingUpdates
};
