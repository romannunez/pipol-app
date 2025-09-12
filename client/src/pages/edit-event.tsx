import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import EditEventForm from '@/components/events/edit-event-form';
import LoadingSpinner from '@/components/ui/loading-spinner';

const EditEventPage = () => {
  const params = useParams<{ eventId: string }>();
  const eventId = parseInt(params.eventId, 10);
  const [_, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [formVisible, setFormVisible] = useState(false);
  const [error500, setError500] = useState(false);

  console.log("Iniciando EditEventPage con eventId:", eventId);

  // Fetch event details
  const { data: event, isLoading, error } = useQuery({
    queryKey: [`/api/events/${eventId}`],
    queryFn: async () => {
      try {
        console.log("Fetching event data for ID:", eventId);
        const response = await fetch(`/api/events/${eventId}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          console.error("Error fetching event data:", response.status, response.statusText);
          if (response.status === 500) {
            setError500(true);
          }
          throw new Error(`Failed to fetch event details: ${response.status}`);
        }
        const data = await response.json();
        console.log("Event data fetched successfully:", data);
        return data;
      } catch (err) {
        console.error("Error in queryFn:", err);
        throw err;
      }
    },
    enabled: !!eventId && !isNaN(eventId),
    retry: 1,
  });

  // Check authentication
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      toast({
        title: 'Autenticación Requerida',
        description: 'Por favor inicia sesión para editar eventos',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }
  }, [user, authLoading, toast, navigate]);

  // Check authorization when event is loaded
  useEffect(() => {
    if (!event || !user) return;
    
    // Check if event has organizerId (should be more reliable than event.organizer)
    if (!event.organizerId) {
      // Log error and redirect
      console.error('Error: El evento no tiene ID de organizador válido', event);
      toast({
        title: 'Error de Datos',
        description: 'No se pudo verificar el organizador del evento',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }
    
    // En caso de que event.organizer no esté presente pero sí tengamos organizerId
    if (!event.organizer) {
      console.log('Advertencia: event.organizer no existe, pero sí existe organizerId:', event.organizerId);
    }
    
    // Check if user is the organizer (usando prioritariamente organizerId)
    const organizerId = event.organizerId || (event.organizer && event.organizer.id);
    
    if (organizerId !== user.id) {
      console.log(`Usuario ${user.id} intentó editar evento del organizador ${organizerId}`);
      toast({
        title: 'No Autorizado',
        description: 'Solo el organizador puede editar este evento',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }
    
    // If authenticated and authorized, show the form
    setFormVisible(true);
  }, [event, user, toast, navigate]);
  
  // Handle form close
  const handleClose = () => {
    navigate('/my-events');
  };

  // Loading state
  if ((isLoading || authLoading) && !formVisible) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error && !formVisible) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center p-4">
          <h2 className="text-lg font-semibold mb-2">Error al cargar el evento</h2>
          <p className="text-neutral-500">No se pudo cargar la información del evento</p>
          <button 
            className="mt-4 bg-primary text-white px-4 py-2 rounded-lg"
            onClick={() => navigate('/my-events')}
          >
            Volver a Mis Eventos
          </button>
        </div>
      </div>
    );
  }

  // Handle errors from the server
  if (error500) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center p-4">
          <h2 className="text-lg font-semibold mb-2">Error del servidor</h2>
          <p className="text-neutral-500">Hubo un problema procesando tu solicitud</p>
          <button 
            className="mt-4 bg-primary text-white px-4 py-2 rounded-lg"
            onClick={() => navigate('/my-events')}
          >
            Volver a Mis Eventos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="w-full max-w-4xl mx-auto pt-4 pb-24 flex-grow">
        {event && formVisible && (
          <div className="edit-event-container px-4">
            <EditEventForm
              eventId={eventId}
              event={event}
              visible={true}
              onClose={handleClose}
            />
          </div>
        )}
        {!event && !isLoading && !error && (
          <div className="flex h-screen items-center justify-center">
            <div className="text-center p-4">
              <h2 className="text-lg font-semibold mb-2">No se encontró el evento</h2>
              <p className="text-neutral-500">El evento que buscas no existe o no tienes acceso</p>
              <button 
                className="mt-4 bg-primary text-white px-4 py-2 rounded-lg"
                onClick={() => navigate('/my-events')}
              >
                Volver a Mis Eventos
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditEventPage;
