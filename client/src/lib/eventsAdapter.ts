import { getCategoryEmoji } from './eventsToGeoJSON';

// Adaptador para convertir los eventos de la API al formato del mapa 3D
export function adaptEventsForMap3D(events: any[]) {
  return events.map(event => ({
    id: event.id.toString(),
    title: event.title,
    lat: typeof event.latitude === 'string' ? parseFloat(event.latitude) : event.latitude,
    lng: typeof event.longitude === 'string' ? parseFloat(event.longitude) : event.longitude,
    category: event.category,
    emoji: getCategoryEmoji(event.category),
    creatorAvatar: event.organizer?.avatar || event.creator_avatar
  }));
}