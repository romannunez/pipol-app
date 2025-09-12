import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUserProfile } from "@/contexts/user-profile-context";

type EventDetailProps = {
  params: {
    id: string;
  };
};

export default function EventDetail({ params }: EventDetailProps) {
  const { id } = params;
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const { showUserProfile } = useUserProfile();

  // Fetch event details
  const { data: event, isLoading: isEventLoading, error: eventError } = useQuery({
    queryKey: [`/api/events/${id}`],
    retry: 1
  });

  // Fetch current user
  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
    refetchOnWindowFocus: false
  });

  // Check if user is attending
  const { data: attendanceStatus, isLoading: isAttendanceLoading } = useQuery({
    queryKey: [`/api/events/${id}/attendance`],
    enabled: !!user,
    retry: false
  });

  // Join event mutation
  const joinEventMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/events/${id}/join`, {});
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to join event");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/attendance`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/events/attending'] });
      toast({
        title: "Success!",
        description: "You have successfully joined the event",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to join event",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Leave event mutation
  const leaveEventMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/events/${id}/leave`, {});
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to leave event");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/attendance`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/events/attending'] });
      toast({
        title: "Success!",
        description: "You have left the event",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to leave event",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleJoinEvent = () => {
    if (!user) {
      setLocation("/login");
      return;
    }
    
    joinEventMutation.mutate();
  };

  const handleLeaveEvent = () => {
    leaveEventMutation.mutate();
  };

  // Show loading state
  if (isEventLoading) {
    return (
      <div className="container mx-auto py-10 px-4 text-center">
        <p>Loading event details...</p>
      </div>
    );
  }

  // Show error state
  if (eventError || !event) {
    return (
      <div className="container mx-auto py-10 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Event not found</h2>
        <p className="text-gray-600 mb-6">The event you're looking for doesn't exist or has been removed</p>
        <Link to="/events">
          <Button>Browse Events</Button>
        </Link>
      </div>
    );
  }

  // Type guard to ensure event has required properties
  const eventData = event as any;
  const eventDate = new Date(eventData.date);
  const isOrganizerView = user && user.id === eventData.organizer?.id;
  const isAttending = attendanceStatus && attendanceStatus.isAttending;
  const isFull = eventData.maxCapacity && eventData.attendees && eventData.attendees.length >= eventData.maxCapacity;

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-6 flex justify-between items-center">
        <Link to="/events">
          <Button variant="ghost" className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Events
          </Button>
        </Link>
        {isOrganizerView && (
          <Link to={`/events/${id}/edit`}>
            <Button variant="outline">Edit Event</Button>
          </Link>
        )}
      </div>

      {eventData.mainMediaUrl && (
        <div className="w-full aspect-video overflow-hidden rounded-lg mb-8 bg-gray-100">
          <img 
            src={eventData.mainMediaUrl} 
            alt={eventData.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold mb-2">{eventData.title}</h1>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-800">
              {eventData.category.charAt(0).toUpperCase() + eventData.category.slice(1)}
            </span>
            {eventData.privacyType === 'private' && (
              <span className="text-sm font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                Private Event
              </span>
            )}
          </div>

          <div className="prose max-w-none mb-8">
            <p>{eventData.description}</p>
          </div>

          <Separator className="my-8" />

          {/* Going Section - Horizontal Profile Pictures */}
          {eventData.attendees && eventData.attendees.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-700">Going</h2>
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                  {eventData.attendees.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {eventData.attendees.slice(0, 10).map((attendee: any, index: number) => (
                  <div
                    key={attendee.id || index}
                    className="relative group"
                    title={attendee.user?.name || `Attendee ${index + 1}`}
                  >
                    <div 
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 p-0.5 hover:scale-110 transition-transform cursor-pointer"
                      onClick={() => attendee.user && showUserProfile({
                        id: attendee.user.id,
                        name: attendee.user.name,
                        email: attendee.user.email || `${attendee.user.name}@example.com`,
                        avatar: attendee.user.avatar
                      })}
                    >
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                        {attendee.user?.avatar ? (
                          <img 
                            src={attendee.user.avatar} 
                            alt={attendee.user.name} 
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">
                            {attendee.user?.name?.charAt(0) || 'U'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {eventData.attendees.length > 10 && (
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">
                      +{eventData.attendees.length - 10}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Date & Time</h3>
                <p>{eventDate.toLocaleDateString(undefined, { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p>{eventDate.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Location</h3>
                <p>{eventData.locationName}</p>
                <p className="text-gray-600">{eventData.locationAddress}</p>
              </div>

              {eventData.maxCapacity && (
                <div>
                  <h3 className="font-semibold mb-2">Capacity</h3>
                  <p>{eventData.attendees?.length || 0} / {eventData.maxCapacity} attendees</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Organized by</h3>
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-200 mr-2 flex items-center justify-center">
                    {eventData.organizer?.avatar ? (
                      <img 
                        src={eventData.organizer.avatar} 
                        alt={eventData.organizer.name} 
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-gray-600">
                        {eventData.organizer?.name?.charAt(0) || 'O'}
                      </span>
                    )}
                  </div>
                  <span>{eventData.organizer?.name || 'Organizer'}</span>
                </div>
              </div>

              {!isOrganizerView && (
                <div className="pt-4">
                  {isAttending ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full">Leave Event</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You will no longer be attending this event. You can rejoin later if there's still space available.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleLeaveEvent}>Leave Event</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button 
                      className="w-full" 
                      disabled={isFull} 
                      onClick={handleJoinEvent}
                    >
                      {isFull ? "Event is Full" : "Join Event"}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}