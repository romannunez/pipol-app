import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Settings, MapPin, Building } from "lucide-react";
import { searchPlaces } from "@/lib/google-maps";
import { searchLocations } from "@/lib/mapbox";
import LoadingSpinner from "@/components/ui/loading-spinner";

// Definición del tipo para las sugerencias de lugares
type PlaceSuggestion = {
  id: string;
  place_name: string;
  center: [number, number];
  text: string;
  properties: {
    category?: string;
  };
};

type SearchBarProps = {
  onSearch: (term: string) => void;
  onFilterClick: () => void;
  onPlaceSelect?: (place: {
    latitude: number;
    longitude: number;
    locationName: string;
    locationAddress: string;
  }) => void;
  hideSettings?: boolean; // Ocultar botón Settings cuando el panel está abierto
};

const SearchBar = ({ onSearch, onFilterClick, onPlaceSelect, hideSettings = false }: SearchBarProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions when user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.trim().length < 3) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        // Usar Google Places API para buscar lugares
        const results = await searchPlaces(searchTerm);
        console.log('Google Places results:', results);
        
        if (results && results.length > 0) {
          setSuggestions(results);
        } else {
          // Si Google Places no devuelve resultados, usar MapBox como fallback
          console.log('No se encontraron resultados con Google Places, usando MapBox como fallback');
          const mapboxResults = await searchLocations(searchTerm, [
            'address', 
            'poi', 
            'poi.landmark', 
            'place'
          ]);
          setSuggestions(mapboxResults);
        }
      } catch (error) {
        console.error("Error fetching suggestions from Google Places:", error);
        
        // Si hay un error con Google Places, usar MapBox como fallback
        try {
          console.log('Error con Google Places, usando MapBox como fallback');
          const mapboxResults = await searchLocations(searchTerm, [
            'address', 
            'poi', 
            'poi.landmark', 
            'place'
          ]);
          setSuggestions(mapboxResults);
        } catch (mapboxError) {
          console.error("Error con MapBox fallback:", mapboxError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce to avoid too many API calls
    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch(value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: PlaceSuggestion) => {
    setSearchTerm(suggestion.place_name);
    setShowSuggestions(false);
    onSearch(suggestion.place_name);

    // If onPlaceSelect is provided, call it with the selected place data
    if (onPlaceSelect) {
      onPlaceSelect({
        latitude: suggestion.center[1],
        longitude: suggestion.center[0],
        locationName: suggestion.text || suggestion.place_name.split(',')[0],
        locationAddress: suggestion.place_name
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1" ref={suggestionRef}>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          <Search size={18} />
        </div>
        <Input
          type="text"
          placeholder="¿De qué quieres participar hoy? Cualquier evento, plan o actividad"
          className="w-full py-4 pl-10 pr-4 rounded-full border-0 focus:outline-none text-sm bg-transparent"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => searchTerm.length >= 3 && setShowSuggestions(true)}
        />

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-white rounded-xl shadow-lg border border-neutral-200 max-h-72 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <div 
                key={suggestion.id} 
                className="px-4 py-3 cursor-pointer hover:bg-neutral-50 flex items-start gap-2 border-b border-neutral-100 last:border-0"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="text-primary mt-1">
                  {suggestion.properties?.category === "poi" ? (
                    <Building size={16} />
                  ) : (
                    <MapPin size={16} />
                  )}
                </div>
                <div>
                  <div className="font-medium">{suggestion.text}</div>
                  <div className="text-xs text-neutral-500">{suggestion.place_name}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <LoadingSpinner size={16} />
          </div>
        )}
      </div>
      {!hideSettings && (
        <button 
          className="p-3 rounded-xl text-neutral-700"
          onClick={onFilterClick}
        >
          <Settings size={18} />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
