import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Building, Calendar } from "lucide-react";
import { GOOGLE_MAPS_API_KEY, libraries } from "@/lib/google-maps";
import { useLoadScript } from "@react-google-maps/api";
import LoadingSpinner from "@/components/ui/loading-spinner";

// Tipo para sugerencias de lugares de Google
type GooglePlaceSuggestion = {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // Un par de coordenadas [longitud, latitud]
  properties: {
    category: string;
  };
};

type GooglePlacesSearchProps = {
  onSearch?: (term: string) => void;
  onPlaceSelect?: (place: {
    latitude: number;
    longitude: number;
    locationName: string;
    locationAddress: string;
  }) => void;
  onEventSelect?: (event: any) => void;
  placeholder?: string;
  className?: string;
};

const GooglePlacesSearch = ({ 
  onSearch, 
  onPlaceSelect, 
  onEventSelect,
  placeholder = "Buscar lugares...", 
  className = "" 
}: GooglePlacesSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [eventSuggestions, setEventSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const dummyElRef = useRef<HTMLDivElement | null>(null);

  // Cargar la API de Google Maps
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Inicializar servicios de Google Maps cuando la API está cargada
  useEffect(() => {
    if (isLoaded && !autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      
      // Necesitamos un elemento HTML para el PlacesService
      if (!dummyElRef.current) {
        dummyElRef.current = document.createElement('div');
      }
      
      placesServiceRef.current = new google.maps.places.PlacesService(dummyElRef.current);
      console.log('Servicios de Google Places inicializados correctamente');
    }
  }, [isLoaded]);

  // Manejar clic fuera de las sugerencias para cerrarlas
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Buscar eventos
  const fetchEventSuggestions = async (term: string) => {
    if (term.trim().length < 2) {
      setEventSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/events?search=${encodeURIComponent(term)}`);
      if (response.ok) {
        const events = await response.json();
        setEventSuggestions(events.slice(0, 5)); // Limitar a 5 eventos
      }
    } catch (error) {
      console.error('Error buscando eventos:', error);
      setEventSuggestions([]);
    }
  };

  // Buscar lugares cuando el usuario escribe
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!isLoaded || !autocompleteServiceRef.current || searchTerm.trim().length < 3) {
        setSuggestions([]);
        setEventSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        // Obtener la ubicación actual para biasing
        let locationBias = undefined;
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            });
          });
          
          if (position && position.coords) {
            locationBias = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              radius: 50000 // 50km
            };
            console.log('Usando ubicación actual para mejorar resultados:', locationBias);
          }
        } catch (locError) {
          console.log('No se pudo obtener ubicación para biasing:', locError);
        }

        // Configurar opciones para la búsqueda
        const request: google.maps.places.AutocompletionRequest = {
          input: searchTerm,
          language: 'es',
          componentRestrictions: { country: 'ar' },  // Restringir a Argentina
          types: ['geocode', 'establishment']        // Tipos de resultados
        };

        // Agregar location bias si está disponible
        if (locationBias) {
          request.locationBias = {
            radius: locationBias.radius,
            center: { lat: locationBias.lat, lng: locationBias.lng }
          };
        }

        // Usar el proxy del servidor en lugar de la API directa de Google
        try {
          const proxyUrl = new URLSearchParams({
            input: searchTerm,
            language: 'es',
            components: 'country:ar'
          });
          
          if (locationBias) {
            proxyUrl.append('location', `${locationBias.lat},${locationBias.lng}`);
            proxyUrl.append('radius', locationBias.radius.toString());
          }
          
          const response = await fetch(`/api/google-proxy/place/autocomplete/json?${proxyUrl.toString()}`);
          const data = await response.json();
          
          if (data.status === 'OK' && data.predictions) {
            console.log('Google Places Autocomplete resultados via proxy:', data.predictions.length);
            
            // Convertir predicciones al formato requerido
            const formattedSuggestions = data.predictions.map((prediction: any) => ({
              id: prediction.place_id,
              place_name: prediction.description,
              text: prediction.structured_formatting?.main_text || prediction.description,
              center: [0, 0] as [number, number],
              properties: {
                category: prediction.types?.[0] || 'place'
              }
            }));
            
            setSuggestions(formattedSuggestions);
          } else {
            console.log('No se encontraron sugerencias o error:', data.error_message || data.status);
            setSuggestions([]);
          }
        } catch (proxyError) {
          console.error('Error usando proxy para Places API:', proxyError);
          setSuggestions([]);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error en Google Places Autocomplete:', error);
        setSuggestions([]);
        setIsLoading(false);
      }
    };

    const fetchAllSuggestions = async () => {
      await Promise.all([
        fetchSuggestions(),
        fetchEventSuggestions(searchTerm)
      ]);
    };

    // Debounce para no hacer demasiadas solicitudes
    const timeoutId = setTimeout(fetchAllSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, isLoaded]);

  // Función para obtener detalles completos de un lugar usando proxy
  const getPlaceDetails = async (placeId: string): Promise<{
    latitude: number;
    longitude: number;
    locationName: string;
    locationAddress: string;
  } | null> => {
    try {
      const response = await fetch(`/api/google-proxy/place/details/json?place_id=${placeId}&language=es&fields=name,formatted_address,geometry,place_id`);
      const data = await response.json();
      
      if (data.status === 'OK' && data.result) {
        const result = data.result;
        if (result.geometry?.location) {
          const lat = result.geometry.location.lat;
          const lng = result.geometry.location.lng;
          
          return {
            latitude: lat,
            longitude: lng,
            locationName: result.name || 'Lugar seleccionado',
            locationAddress: result.formatted_address || 'Dirección no disponible'
          };
        }
      }
      
      console.error('No se pudieron obtener los detalles del lugar');
      return null;
    } catch (error) {
      console.error('Error obteniendo detalles del lugar via proxy:', error);
      return null;
    }
  };

  // Manejar la selección de un lugar
  const handlePlaceSelect = async (suggestion: GooglePlaceSuggestion) => {
    try {
      setIsLoading(true);
      const placeDetails = await getPlaceDetails(suggestion.id);
      setIsLoading(false);
      
      if (placeDetails && onPlaceSelect) {
        // Usar el texto de la búsqueda como nombre del lugar si está disponible
        // Esto preserva el nombre que el usuario vio y seleccionó
        const enhancedPlaceDetails = {
          ...placeDetails,
          // Usar el texto del resultado seleccionado como nombre del lugar
          // en lugar del nombre de la calle que devuelve la API de geocodificación
          locationName: suggestion.text || placeDetails.locationName
        };
        
        console.log('Lugar seleccionado (Google Places):', enhancedPlaceDetails);
        onPlaceSelect(enhancedPlaceDetails);
        setSearchTerm(enhancedPlaceDetails.locationName);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error obteniendo detalles del lugar:', error);
      setIsLoading(false);
    }
  };

  // Manejar la selección de un evento
  const handleEventSelect = (event: any) => {
    if (onEventSelect) {
      console.log('Evento seleccionado:', event);
      onEventSelect(event);
      setSearchTerm(event.title);
      setShowSuggestions(false);
    }
  };

  // Manejar cambios en el input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowSuggestions(value.trim().length > 0);
    
    if (onSearch) {
      onSearch(value);
    }
  };

  // Focus en el input
  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  // Manejar click en la barra
  const handleBarClick = () => {
    setShowSuggestions(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  return (
    <div className={`relative w-full google-places-search ${className}`}>
      <div className="relative">
        <div 
          className="w-full bg-white rounded-full border border-gray-200 shadow-sm px-4 py-3 cursor-text flex items-center"
          onClick={handleBarClick}
        >
          <Search className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
          <div className="flex-1">
            {!searchTerm && !showSuggestions ? (
              <div className="flex flex-col">
                <div className="text-sm font-medium text-gray-900">
                  ¿De qué quieres participar hoy?
                </div>
                <div className="text-xs text-gray-500">
                  Cualquier evento, plan o actividad
                </div>
              </div>
            ) : (
              <Input
                ref={inputRef}
                type="text"
                placeholder="Buscar eventos o lugares..."
                value={searchTerm}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                className="border-none p-0 h-auto bg-transparent focus:ring-0 focus:border-none shadow-none text-sm"
                style={{ outline: 'none', boxShadow: 'none' }}
              />
            )}
          </div>
          {isLoading && (
            <div className="ml-2 flex-shrink-0">
              <LoadingSpinner size={16} />
            </div>
          )}
        </div>
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <div 
          ref={suggestionRef}
          className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm border border-gray-200"
        >
          {/* Mostrar eventos primero */}
          {eventSuggestions.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-gray-100">
                Eventos
              </div>
              {eventSuggestions.map((event) => (
                <div
                  key={`event-${event.id}`}
                  className="cursor-pointer flex items-center px-4 py-2 hover:bg-gray-100"
                  onClick={() => handleEventSelect(event)}
                >
                  <div className="mr-2">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{event.title}</span>
                    <span className="text-xs text-gray-500 line-clamp-1">
                      {event.locationName} • {new Date(event.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
          
          {/* Mostrar lugares después */}
          {suggestions.length > 0 && (
            <>
              {eventSuggestions.length > 0 && (
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-gray-100">
                  Lugares
                </div>
              )}
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="cursor-pointer flex items-center px-4 py-2 hover:bg-gray-100"
                  onClick={() => handlePlaceSelect(suggestion)}
                >
                  <div className="mr-2">
                    {suggestion.properties.category === 'address' || 
                    suggestion.properties.category === 'street_address' ? (
                      <MapPin className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Building className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{suggestion.text}</span>
                    <span className="text-xs text-gray-500 line-clamp-1">
                      {suggestion.place_name}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
          
          {/* Mensaje cuando no hay resultados */}
          {suggestions.length === 0 && eventSuggestions.length === 0 && (
            <div className="px-4 py-2 text-sm text-gray-500">
              {isLoading ? "Buscando..." : "No se encontraron resultados"}
            </div>
          )}
        </div>
      )}
      
      {/* Elemento invisible para PlacesService */}
      <div ref={dummyElRef} style={{ display: 'none' }}></div>
    </div>
  );
};

export default GooglePlacesSearch;