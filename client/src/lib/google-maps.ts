// Google Maps utils
import { useLoadScript, Libraries } from '@react-google-maps/api';

// Using environment variable for Google Maps API key
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Libraries necesarias
export const libraries: Libraries = ["places"];

// Hook para cargar Google Maps 
export function useGoogleMaps() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });
  
  return { isLoaded, loadError };
}

// Configuración por defecto del mapa
export const defaultMapConfig = {
  center: {
    lat: 19.4326, // Ciudad de México por defecto
    lng: -99.1332
  },
  zoom: 11,
  mapContainerStyle: {
    width: '100%',
    height: '100%',
  },
  options: {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  },
};

// Función para geocodificar en reversa (obtener dirección a partir de coordenadas) usando proxy
// Versión optimizada para mayor velocidad
export async function reverseGeocode(lng: number, lat: number): Promise<string> {
  try {
    // Validar que las coordenadas sean números válidos
    if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
      console.error("Coordenadas inválidas para geocodificación:", lat, lng);
      return "Coordenadas inválidas";
    }
    
    // Usar el proxy del servidor para evitar problemas de CORS
    // Limitamos los resultados a 1 para mayor velocidad
    const response = await fetch(
      `/api/google-proxy/geocode/json?latlng=${lat},${lng}&language=es&region=ar&result_type=street_address|route|premise|point_of_interest&location_type=ROOFTOP|GEOMETRIC_CENTER`
    );
    
    if (!response.ok) {
      console.error("Error en respuesta HTTP de geocodificación inversa:", response.status);
      throw new Error(`Error HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      return result.formatted_address || "Dirección no encontrada";
    }
    
    return "Dirección no encontrada";
  } catch (error) {
    console.error("Error en geocodificación inversa:", error);
    return "Error al obtener dirección";
  }
}

// Función para buscar establecimientos cercanos a una ubicación (versión optimizada)
export async function findNearbyPlaces(lat: number, lng: number, radius: number = 100): Promise<any[]> {
  try {
    // Validar que las coordenadas sean números válidos
    if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
      console.error("Coordenadas inválidas para búsqueda de lugares cercanos:", lat, lng);
      return [];
    }
    
    // Construir URL más optimizada, limitando el número de resultados y filtrando por tipos relevantes
    const url = `/api/google-proxy/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&rankby=prominence&key=${GOOGLE_MAPS_API_KEY}`;
    
    // Usar AbortController para limitar tiempo de espera
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 segundos máximo
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      
      clearTimeout(timeoutId); // Limpiar timeout si la respuesta fue exitosa
      
      if (!response.ok) {
        console.error("Error en la respuesta del servidor para lugares cercanos:", response.status);
        return [];
      }
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.results) {
        return data.results.slice(0, 5); // Limitar a 5 resultados para mayor velocidad
      }
      
      return [];
    } catch (fetchError: any) {
      if (fetchError?.name === 'AbortError') {
        console.log('Búsqueda de lugares cercanos cancelada por timeout');
      } else {
        console.error("Error en búsqueda de lugares cercanos:", fetchError);
      }
      return [];
    }
  } catch (error) {
    console.error("Error en búsqueda de lugares cercanos:", error);
    return [];
  }
}

// Función para buscar lugares
export async function searchPlaces(query: string): Promise<any[]> {
  try {
    // Intentar obtener la ubicación actual para mejorar la búsqueda
    let locationParam = '';
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      
      if (position && position.coords) {
        locationParam = `&location=${position.coords.latitude},${position.coords.longitude}&radius=50000`;
        console.log('Usando ubicación actual para mejorar resultados de búsqueda');
      }
    } catch (locError) {
      console.log('No se pudo obtener la ubicación actual para la búsqueda:', locError);
    }
    
    // Construir URL con parámetros adicionales para mejorar resultados
    const url = `/api/google-proxy/place/textsearch/json?query=${encodeURIComponent(query)}${locationParam}&key=${GOOGLE_MAPS_API_KEY}`;
    console.log('Realizando búsqueda en Google Places:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("Error en la respuesta del servidor:", response.status);
      return [];
    }
    
    const data = await response.json();
    console.log('Respuesta de Google Places:', data.status, data.results?.length || 0, 'resultados');
    
    if (data.status === 'OK' && data.results) {
      // Mapear resultados al formato requerido por la aplicación
      return data.results.map((place: any) => ({
        id: place.place_id,
        place_name: place.formatted_address,
        text: place.name,
        center: [place.geometry.location.lng, place.geometry.location.lat],
        properties: {
          category: place.types?.[0] || 'place'
        }
      }));
    }
    
    if (data.status !== 'OK') {
      console.error('Error en la respuesta de Google Places:', data.status, data.error_message || 'Sin mensaje de error');
    }
    
    return [];
  } catch (error) {
    console.error("Error en búsqueda de lugares:", error);
    return [];
  }
}