export interface EventGeoJSON {
  id: string;
  title: string;
  lat: number;
  lng: number;
  category?: string;
  emoji?: string;
  creatorAvatar?: string;
}

export function eventsToGeoJSON(events: EventGeoJSON[]) {
  return {
    type: "FeatureCollection" as const,
    features: events.map((ev) => ({
      type: "Feature" as const,
      properties: { 
        id: ev.id, 
        title: ev.title,
        category: ev.category,
        emoji: ev.emoji,
        creatorAvatar: ev.creatorAvatar
      },
      geometry: { 
        type: "Point" as const, 
        coordinates: [ev.lng, ev.lat] 
      }
    }))
  };
}

// Obtener emoji por categoría
export function getCategoryEmoji(category?: string): string {
  const normalizedCategory = category?.toLowerCase().trim();
  
  const emojiMap: Record<string, string> = {
    // Sports variations
    sports: "⚽",
    sport: "⚽",
    deportes: "⚽",
    deporte: "⚽",
    futbol: "⚽",
    football: "⚽",
    soccer: "⚽",
    
    // Games variations
    games: "🎮",
    game: "🎮",
    gaming: "🎮",
    juegos: "🎮",
    juego: "🎮",
    
    // Music variations
    music: "🎵",
    musica: "🎵",
    música: "🎵",
    concierto: "🎵",
    concert: "🎵",
    
    // Food variations
    food: "🍽️",
    comida: "🍽️",
    restaurante: "🍽️",
    restaurant: "🍽️",
    dining: "🍽️",
    
    // Nightlife variations
    nightlife: "🌙",
    "vida nocturna": "🌙",
    night: "🌙",
    noche: "🌙",
    bar: "🌙",
    club: "🌙",
    
    // Outdoors variations
    outdoors: "🌲",
    "aire libre": "🌲",
    outdoor: "🌲",
    nature: "🌲",
    naturaleza: "🌲",
    hiking: "🌲",
    
    // Social variations
    social: "👥",
    meetup: "👥",
    reunion: "👥",
    "reunión": "👥",
    networking: "👥",
    
    // Business variations
    business: "💼",
    negocio: "💼",
    negocios: "💼",
    trabajo: "💼",
    work: "💼",
    
    // Education variations
    education: "📚",
    educacion: "📚",
    educación: "📚",
    workshop: "📚",
    taller: "📚",
    curso: "📚",
    course: "📚",
    
    // Health variations
    health: "💪",
    salud: "💪",
    fitness: "💪",
    gym: "💪",
    ejercicio: "💪",
    yoga: "💪",
    
    // Art variations
    art: "🎨",
    arte: "🎨",
    cultura: "🎨",
    cultural: "🎨",
    gallery: "🎨",
    museo: "🎨",
    
    // Technology variations
    technology: "💻",
    tecnologia: "💻",
    tecnología: "💻",
    tech: "💻",
    programming: "💻",
    coding: "💻"
  };
  
  return emojiMap[normalizedCategory || ""] || "👥"; // Default to social emoji instead of pin
}