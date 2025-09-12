import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { simpleChatService as chatService } from '@/components/chat/simple-chat-service';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

// Tipo de evento
export type Event = {
  id: number;
  title: string;
  description: string;
  category: string;
  date: string;
  latitude: string | number;
  longitude: string | number;
  locationName: string;
  locationAddress: string;
  paymentType: string;
  price?: string | number;
  maxCapacity?: number;
  privacyType: string;
  organizerId: number;
  organizer: {
    id: number;
    name: string;
    avatar?: string;
  };
  attendees: Array<{
    id: number;
    user: {
      id: number;
      name: string;
      avatar?: string;
    };
  }>;
};

/**
 * Hook personalizado para gestionar eventos con actualizaciones en tiempo real
 */
export function useEvents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Consulta para obtener todos los eventos
  const eventsQuery = useQuery({
    queryKey: ['/api/events'],
    queryFn: async () => {
      // Use session-based authentication instead of token-based
      const response = await fetch('/api/events', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.status === 401) {
        // Session expired, redirect to login
        console.log('Session expired, redirecting to login');
        localStorage.removeItem('pipol_auth_token');
        localStorage.removeItem('pipol_user_data');
        window.location.reload();
        throw new Error('Authentication expired');
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      
      return response.json();
    },
    enabled: !!user, // Solo ejecutar si hay usuario autenticado
    refetchOnWindowFocus: true,
    retry: 3, // Reintentar hasta 3 veces
    retryDelay: 1000, // Esperar 1 segundo entre intentos
    staleTime: 60000, // Datos permanecen "frescos" por 60 segundos
    refetchInterval: 60000, // Actualizar automáticamente cada 60 segundos
  });

  // Función para actualizar un evento en todas las cachés
  const updateEventInCache = useCallback((updatedEvent: Event) => {
    // 1. Actualizar la lista general de eventos
    const currentEvents = queryClient.getQueryData<Event[]>(['/api/events']) || [];
    const updatedEvents = currentEvents.map(event => 
      event.id === updatedEvent.id ? updatedEvent : event
    );
    queryClient.setQueryData(['/api/events'], updatedEvents);
    
    // 2. Actualizar la caché de detalles del evento individual
    queryClient.setQueryData([`/api/events/${updatedEvent.id}`], updatedEvent);
    
    // 3. Actualizar eventos creados por el usuario
    const createdEvents = queryClient.getQueryData<Event[]>(['/api/user/events/created']) || [];
    if (createdEvents.length > 0) {
      const updatedCreatedEvents = createdEvents.map(event => 
        event.id === updatedEvent.id ? updatedEvent : event
      );
      queryClient.setQueryData(['/api/user/events/created'], updatedCreatedEvents);
    }
    
    // 4. Actualizar eventos a los que asiste el usuario
    const attendingEvents = queryClient.getQueryData<Event[]>(['/api/user/events/attending']) || [];
    if (attendingEvents.length > 0) {
      const updatedAttendingEvents = attendingEvents.map(event => 
        event.id === updatedEvent.id ? updatedEvent : event
      );
      queryClient.setQueryData(['/api/user/events/attending'], updatedAttendingEvents);
    }
    
    // 5. Emitir un evento DOM personalizado para componentes que no usan react-query
    const eventUpdateEvent = new CustomEvent('event-updated', { 
      detail: { eventId: updatedEvent.id, data: updatedEvent } 
    });
    window.dispatchEvent(eventUpdateEvent);
    
    console.log('Todas las cachés de eventos actualizadas automáticamente');
  }, [queryClient]);

  // Setup WebSocket connection when user is available
  useEffect(() => {
    if (user && user.id) {
      // Setup message handler for event updates
      const handleMessage = (message: any) => {
        // Handle event updates
        if (message.type === 'event_updated') {
          console.log('Event updated received via WebSocket:', message.event);
          
          // Update tanstack query cache
          updateEventInCache(message.event);
          
          // Show update notification (only if not the user who made the change)
          if (user?.id !== message.event.updatedBy) {
            toast({
              title: "Event updated!",
              description: `The event "${message.event.title}" has been updated.`,
              duration: 3000
            });
          }
        }
        
        // Handle media updates
        if (message.type === 'event_media_updated') {
          console.log('Event media updated received via WebSocket:', message.eventId);
          
          // Invalidate cache to force reload
          queryClient.invalidateQueries({
            queryKey: [`/api/events/${message.eventId}`]
          });
          
          // Also invalidate general list to ensure updates everywhere
          queryClient.invalidateQueries({
            queryKey: ['/api/events']
          });
          
          // Dispatch custom event for components listening to media changes
          const mediaUpdateEvent = new CustomEvent('event-media-updated', { 
            detail: { eventId: message.eventId } 
          });
          window.dispatchEvent(mediaUpdateEvent);
        }
      };

      // Register the message handler
      chatService.onMessage(handleMessage);
      
      // Cleanup function to remove the message handler
      return () => {
        chatService.removeMessageListener(handleMessage);
      };
    }
  }, [user, updateEventInCache, toast]);

  return {
    events: eventsQuery.data as Event[] || [],
    isLoading: eventsQuery.isLoading,
    error: eventsQuery.error,
    refetch: eventsQuery.refetch
  };
}