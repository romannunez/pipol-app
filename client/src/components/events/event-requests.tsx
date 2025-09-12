import React, { useState, useEffect } from 'react';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';
import { Button } from '../ui/button';
import { useAuth } from '../../hooks/use-auth';

type JoinRequest = {
  id: number;
  eventId: number;
  userId: number;
  status: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    username: string;
    avatar?: string;
  };
};

type EventRequestsProps = {
  eventId: number;
  onStatusChange: () => void;
};

export function EventRequests({ eventId, onStatusChange }: EventRequestsProps) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    fetchRequests();
  }, [eventId, user]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('GET', `/api/events/${eventId}/requests`);
      if (!res.ok) {
        throw new Error('No se pudieron cargar las solicitudes');
      }
      const data = await res.json();
      setRequests(data);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las solicitudes para este evento',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (attendeeId: number) => {
    try {
      setProcessingId(attendeeId);
      const res = await apiRequest(
        'POST', 
        `/api/events/${eventId}/requests/${attendeeId}/approve`
      );
      
      if (!res.ok) {
        throw new Error('No se pudo aprobar la solicitud');
      }
      
      // Remove approved request from the list
      setRequests(requests.filter(r => r.userId !== attendeeId));
      
      toast({
        title: 'Solicitud aprobada',
        description: 'El usuario ha sido añadido al evento',
      });
      
      // Notify parent component about the status change
      onStatusChange();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: 'Error',
        description: 'No se pudo aprobar la solicitud',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (attendeeId: number) => {
    try {
      setProcessingId(attendeeId);
      const res = await apiRequest(
        'POST', 
        `/api/events/${eventId}/requests/${attendeeId}/reject`
      );
      
      if (!res.ok) {
        throw new Error('No se pudo rechazar la solicitud');
      }
      
      // Remove rejected request from the list
      setRequests(requests.filter(r => r.userId !== attendeeId));
      
      toast({
        title: 'Solicitud rechazada',
        description: 'La solicitud ha sido rechazada',
      });
      
      // Notify parent component about the status change
      onStatusChange();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: 'Error',
        description: 'No se pudo rechazar la solicitud',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Cargando solicitudes...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-4 text-neutral-500">
        No hay solicitudes pendientes para este evento
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Solicitudes pendientes ({requests.length})</h3>
      
      <div className="space-y-3">
        {requests.map((request) => (
          <div 
            key={request.id} 
            className="bg-white rounded-lg p-4 shadow-sm border border-neutral-100 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neutral-200 overflow-hidden flex-shrink-0">
                <img 
                  src={request.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.user.name)}`}
                  alt={request.user.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="font-medium">{request.user.name}</p>
                <p className="text-sm text-neutral-500">@{request.user.username}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => handleReject(request.user.id)}
                disabled={processingId === request.user.id}
              >
                Rechazar
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleApprove(request.user.id)}
                disabled={processingId === request.user.id}
              >
                Aprobar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventRequests;