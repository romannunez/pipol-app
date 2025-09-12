import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import BottomNav from "@/components/layout/bottom-nav";
import { MessageSquare, Calendar, Search, Group, User, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, isToday, isTomorrow, isAfter, addDays, parseISO } from "date-fns";
import Chat from "@/components/chat/chat";
import { es } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { getCategoryEmoji } from "@/lib/eventsToGeoJSON";
import EventDetailSheet from "@/components/events/event-detail-sheet";
import { simpleChatService } from "@/components/chat/simple-chat-service";

// Unified type for all events (both attending and created)
interface UnifiedEvent {
  id: number;
  title: string;
  description: string;
  date: string;
  category: string;
  locationName: string;
  mainMediaUrl?: string;
  mainMediaType?: string;
  organizer: {
    id: number;
    name: string;
    username: string;
  };
  isCreatedByUser?: boolean; // true if user is the organizer
  attendeeCount?: number;
}

const Messages = () => {
  const { user, isLoading } = useAuth();
  const [_, navigate] = useLocation();
  const [attendingEvents, setAttendingEvents] = useState<UnifiedEvent[]>([]);
  const [createdEvents, setCreatedEvents] = useState<UnifiedEvent[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState(false);
  const [latestMessages, setLatestMessages] = useState<{ [eventId: number]: any }>({});
  const [unreadCounts, setUnreadCounts] = useState<{ [eventId: number]: number }>({});
  const [activeTab, setActiveTab] = useState('attending');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedEventTitle, setSelectedEventTitle] = useState<string>('');
  const [selectedEventImage, setSelectedEventImage] = useState<string>('');
  const [chatVisible, setChatVisible] = useState(false);
  const [eventDetailVisible, setEventDetailVisible] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<UnifiedEvent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
      return;
    }
    // Fetch events when user is loaded - combined to avoid double effect
    if (user) {
      fetchAllEvents();
    }
  }, [user, isLoading, navigate]);

  // Listen for new messages to update previews in real time
  useEffect(() => {
    if (!user) return;

    const handleNewMessage = (message: any) => {
      // Update latest messages when a new message arrives
      if (message.type === 'new_message' && message.eventId && message.message) {
        console.log('📨 Updating message preview for event:', message.eventId);
        
        setLatestMessages(prev => ({
          ...prev,
          [message.eventId]: {
            id: message.message.id,
            event_id: message.message.eventId,
            sender_id: message.message.senderId,
            content: message.message.content,
            message_type: message.message.messageType,
            created_at: message.message.createdAt,
            sender: message.message.sender
          }
        }));
        
        // Update unread count if message is from someone else
        if (message.message.senderId !== user.id) {
          setUnreadCounts(prev => ({
            ...prev,
            [message.eventId]: (prev[message.eventId] || 0) + 1
          }));
        }
      }
    };

    // Register the message listener
    simpleChatService.onMessage(handleNewMessage);

    // Cleanup function to remove message listener
    return () => {
      simpleChatService.removeMessageListener(handleNewMessage);
    };
  }, [user]);

  // Fetch all events (attending + created) in parallel
  const fetchAllEvents = async () => {
    setIsEventsLoading(true);
    try {
      // Fetch both types of events in parallel
      const [attendingResponse, createdResponse] = await Promise.all([
        fetch('/api/user/events/attending', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch('/api/user/events/created', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      ]);

      // Process attending events
      let processedAttendingEvents: UnifiedEvent[] = [];
      if (attendingResponse.ok) {
        const attendingData = await attendingResponse.json();
        processedAttendingEvents = attendingData.map((item: any) => ({
          id: item.event.id,
          title: item.event.title,
          description: item.event.description,
          date: item.event.date,
          category: item.event.category,
          locationName: item.event.locationName,
          mainMediaUrl: item.event.mainMediaUrl,
          mainMediaType: item.event.mainMediaType,
          organizer: item.event.organizer,
          isCreatedByUser: false,
          attendeeCount: item.event.attendees?.length || 0
        }));
      }

      // Process created events
      let processedCreatedEvents: UnifiedEvent[] = [];
      if (createdResponse.ok) {
        const createdData = await createdResponse.json();
        processedCreatedEvents = createdData.map((event: any) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          date: event.date,
          category: event.category,
          locationName: event.locationName,
          mainMediaUrl: event.mainMediaUrl,
          mainMediaType: event.mainMediaType,
          organizer: {
            id: user!.id,
            name: user!.name || user!.username,
            username: user!.username
          },
          isCreatedByUser: true,
          attendeeCount: event.attendees?.length || 0
        }));
        
        // Add created events to attending events too (organizer always attends)
        processedAttendingEvents.push(...processedCreatedEvents);
      }

      // Remove duplicates from attending events
      const uniqueAttendingEvents = processedAttendingEvents.filter((event, index, self) => 
        index === self.findIndex(e => e.id === event.id)
      );

      // Sort by date (most recent first)
      uniqueAttendingEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      processedCreatedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setAttendingEvents(uniqueAttendingEvents);
      setCreatedEvents(processedCreatedEvents);

      // Fetch latest messages for all events
      const allEventIds = [...uniqueAttendingEvents, ...processedCreatedEvents]
        .map(event => event.id)
        .filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates
      
      if (allEventIds.length > 0) {
        fetchLatestMessages(allEventIds);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsEventsLoading(false);
    }
  };

  // Fetch latest messages for events
  const fetchLatestMessages = async (eventIds: number[]) => {
    try {
      const response = await fetch(`/api/events/latest-messages?eventIds=${eventIds.join(',')}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const messages = await response.json();
        setLatestMessages(messages);
        
        // Initialize unread counts (simulate some unread messages for demo)
        const newUnreadCounts: { [eventId: number]: number } = {};
        Object.keys(messages).forEach(eventIdStr => {
          const eventId = parseInt(eventIdStr);
          const message = messages[eventId];
          
          // Simulate unread messages: if message exists and is from someone else
          if (message && user && message.sender_id !== user.id) {
            // Simulate random unread count between 1-5 for demonstration
            newUnreadCounts[eventId] = Math.floor(Math.random() * 3) + 1;
          }
        });
        setUnreadCounts(newUnreadCounts);
      }
    } catch (error) {
      console.error('Error fetching latest messages:', error);
    }
  };

  // Open chat for any event
  const openEventChat = (event: UnifiedEvent) => {
    setSelectedEventId(event.id);
    setSelectedEventTitle(event.title);
    setSelectedEventImage(event.mainMediaUrl || '');
    // IMPORTANT: Also save the complete event for detail panel access
    setSelectedEventForDetail(event);
    setChatVisible(true);
    
    // Mark messages as read when opening chat (WhatsApp behavior)
    if (unreadCounts[event.id] > 0) {
      setUnreadCounts(prev => ({
        ...prev,
        [event.id]: 0
      }));
    }
  };

  // Close the chat
  const closeChat = () => {
    setChatVisible(false);
  };

  const openEventDetail = async (event: UnifiedEvent) => {
    try {
      // Fetch complete event data with all details (attendees, coordinates, etc.)
      const response = await fetch(`/api/events/${event.id}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const completeEventData = await response.json();
        // Format the complete event data for EventDetailSheet
        const formattedEvent = {
          ...completeEventData,
          latitude: typeof completeEventData.latitude === 'string' ? parseFloat(completeEventData.latitude) : (completeEventData.latitude || 0),
          longitude: typeof completeEventData.longitude === 'string' ? parseFloat(completeEventData.longitude) : (completeEventData.longitude || 0),
          date: completeEventData.date instanceof Date ? completeEventData.date.toISOString() : completeEventData.date
        };
        setSelectedEventForDetail(formattedEvent);
        setEventDetailVisible(true);
      } else {
        console.error('Failed to fetch complete event data');
        // Fallback to basic event data
        setSelectedEventForDetail(event);
        setEventDetailVisible(true);
      }
    } catch (error) {
      console.error('Error fetching complete event data:', error);
      // Fallback to basic event data
      setSelectedEventForDetail(event);
      setEventDetailVisible(true);
    }
  };

  const closeEventDetail = () => {
    setEventDetailVisible(false);
    setSelectedEventForDetail(null);
  };

  // Filter events by search term
  const filterEvents = (events: UnifiedEvent[]) => {
    if (!searchTerm) return events;
    
    return events.filter(event => 
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.locationName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const showEmptyState = () => {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-neutral-100 p-6 rounded-full mb-4">
          <MessageSquare size={48} className="text-neutral-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No hay mensajes todavía</h2>
        <p className="text-neutral-500 text-center mb-6">
          {activeTab === 'attending' 
            ? 'Los chats de los eventos a los que te hayas unido aparecerán aquí.' 
            : 'Los chats de los eventos que has creado aparecerán aquí.'}
        </p>
        <Button 
          className="bg-primary-500 hover:bg-primary-600"
          onClick={() => navigate("/")}
        >
          {activeTab === 'attending' ? 'Explorar Eventos' : 'Crear Evento'}
        </Button>
      </div>
    );
  };

  // Formato amigable para la fecha y hora del evento
  const formatEventDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      
      if (isToday(date)) {
        return `Hoy, ${format(date, 'HH:mm')}`;
      } else if (isTomorrow(date)) {
        return `Mañana, ${format(date, 'HH:mm')}`;
      } else if (isAfter(date, addDays(new Date(), 7))) {
        // Si es más de una semana en el futuro
        return format(date, "d 'de' MMMM, HH:mm", { locale: es });
      } else {
        // Entre 2 y 7 días
        return format(date, "EEEE, HH:mm", { locale: es });
      }
    } catch (error) {
      // Si hay algún error en el formato de fecha
      return "Fecha por confirmar";
    }
  };
  
  // Format message time
  const formatMessageTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'HH:mm');
    } catch (error) {
      return '';
    }
  };

  // Get message preview for event (WhatsApp style)
  const getMessagePreview = (eventId: number) => {
    const message = latestMessages[eventId];
    if (!message) {
      return 'Envía un Mensaje!';
    }
    
    // Check if message is from current user
    const isOwnMessage = user && message.sender_id === user.id;
    const senderPrefix = isOwnMessage ? 'Tú: ' : (message.sender ? `${message.sender.name}: ` : '');
    
    return `${senderPrefix}${message.content}`;
  };

  // Get message time for event
  const getMessageTime = (eventId: number) => {
    const message = latestMessages[eventId];
    return message ? formatMessageTime(message.created_at) : '';
  };

  // Check if event has unread messages
  const hasUnreadMessages = (eventId: number) => {
    return (unreadCounts[eventId] || 0) > 0;
  };

  // Get unread count for event
  const getUnreadCount = (eventId: number) => {
    return unreadCounts[eventId] || 0;
  };

  // Sort events by last message time (most recent first) - WhatsApp style
  const sortEventsByLastMessage = (events: UnifiedEvent[]) => {
    return [...events].sort((a, b) => {
      const messageA = latestMessages[a.id];
      const messageB = latestMessages[b.id];
      
      // If no messages, keep original order
      if (!messageA && !messageB) return 0;
      if (!messageA) return 1; // B has message, A doesn't - B first
      if (!messageB) return -1; // A has message, B doesn't - A first
      
      // Compare message times
      const timeA = new Date(messageA.created_at).getTime();
      const timeB = new Date(messageB.created_at).getTime();
      return timeB - timeA; // Most recent first
    });
  };

  // Render the chat as overlay instead of replacing the entire view

  // Early return for loading state to prevent double render
  if (isLoading) {
    return (
      <div className="bg-white flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b border-neutral-200 flex-shrink-0">
        <h1 className="text-xl font-bold">Mensajes</h1>
      </div>

      {/* Search Bar */}
      <div className="bg-white px-3 py-2 border-b border-neutral-200 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={16} />
          <Input 
            placeholder="Buscar chat" 
            className="bg-neutral-100 pl-10 text-sm rounded-md border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Events List with Tabs */}
      <div className="flex-1 flex flex-col min-h-0">
        <Tabs defaultValue="attending" className="w-full flex flex-col h-full" onValueChange={setActiveTab}>
          <div className="bg-white border-b border-neutral-200 flex-shrink-0">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="attending">
                <Group className="mr-2" size={16} />
                Eventos que Asisto
              </TabsTrigger>
              <TabsTrigger value="created">
                <Star className="mr-2" size={16} />
                Mis Eventos
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="attending" className="mt-0 flex-1 min-h-0">
            {isEventsLoading ? (
              <div className="flex justify-center p-8">
                <LoadingSpinner size="md" />
              </div>
            ) : attendingEvents.length === 0 ? (
              showEmptyState()
            ) : (
              <div className="divide-y divide-neutral-200 bg-white overflow-y-auto h-full pb-24">
                {filterEvents(sortEventsByLastMessage(attendingEvents)).map((event) => (
                  <div 
                    key={event.id}
                    className="p-3 hover:bg-neutral-50 transition cursor-pointer"
                    onClick={() => openEventChat(event)}
                  >
                    <div className="flex">
                      {/* Avatar/Image */}
                      <div className="mr-3 flex items-center">
                        <div className="relative">
                          {/* Always show yellow ring */}
                          <div className="p-0.5 bg-yellow-400 rounded-full">
                            <div className="w-14 h-14 rounded-full overflow-hidden bg-neutral-100 flex items-center justify-center">
                              {event.mainMediaUrl ? (
                                <img 
                                  src={event.mainMediaUrl} 
                                  alt={event.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Group size={26} className="text-primary" />
                              )}
                            </div>
                          </div>
                          {/* Category emoji indicator */}
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
                            <span className="text-xs">{getCategoryEmoji(event.category)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Chat content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className={`${hasUnreadMessages(event.id) ? 'font-bold' : 'font-medium'} text-neutral-900 truncate pr-1`}>
                            {event.title}
                            {event.isCreatedByUser && (
                              <span className="ml-2 text-xs text-primary font-medium">Organizador</span>
                            )}
                          </h3>
                          <span className="text-xs text-neutral-500 whitespace-nowrap ml-2">
                            {getMessageTime(event.id)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center mt-1">
                          <p className={`text-sm ${hasUnreadMessages(event.id) ? 'font-medium text-neutral-800' : 'text-neutral-600'} truncate pr-1`}>
                            {getMessagePreview(event.id)}
                          </p>
                          {hasUnreadMessages(event.id) && (
                            <div className="flex items-center ml-2">
                              <div className="bg-green-500 text-white text-xs min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5">
                                {getUnreadCount(event.id)}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center">
                            <Calendar size={12} className="text-neutral-400 mr-1" />
                            <span className="text-xs text-neutral-500">
                              {formatEventDate(event.date)}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Group size={12} className="text-neutral-400 mr-1" />
                            <span className="text-xs text-neutral-500">
                              {event.attendeeCount || 0} asistentes
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="created" className="mt-0 flex-1 min-h-0">
            {isEventsLoading ? (
              <div className="flex justify-center p-8">
                <LoadingSpinner size="md" />
              </div>
            ) : createdEvents.length === 0 ? (
              showEmptyState()
            ) : (
              <div className="divide-y divide-neutral-200 bg-white overflow-y-auto h-full pb-24">
                {filterEvents(sortEventsByLastMessage(createdEvents)).map((event) => (
                  <div 
                    key={event.id}
                    className="p-3 hover:bg-neutral-50 transition cursor-pointer"
                    onClick={() => openEventChat(event)}
                  >
                    <div className="flex">
                      {/* Avatar/Image */}
                      <div className="mr-3 flex items-center">
                        <div className="relative">
                          {/* Always show yellow ring */}
                          <div className="p-0.5 bg-yellow-400 rounded-full">
                            <div className="w-14 h-14 rounded-full overflow-hidden bg-neutral-100 flex items-center justify-center">
                              {event.mainMediaUrl ? (
                                <img 
                                  src={event.mainMediaUrl} 
                                  alt={event.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Star size={26} className="text-primary" />
                              )}
                            </div>
                          </div>
                          {/* Category emoji indicator */}
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
                            <span className="text-xs">{getCategoryEmoji(event.category)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Chat content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className={`${hasUnreadMessages(event.id) ? 'font-bold' : 'font-medium'} text-neutral-900 truncate pr-1`}>
                            {event.title}
                          </h3>
                          <span className="text-xs text-neutral-500 whitespace-nowrap ml-2">
                            {getMessageTime(event.id)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center mt-1">
                          <p className={`text-sm ${hasUnreadMessages(event.id) ? 'font-medium text-neutral-800' : 'text-neutral-600'} truncate pr-1`}>
                            {getMessagePreview(event.id)}
                          </p>
                          {hasUnreadMessages(event.id) && (
                            <div className="flex items-center ml-2">
                              <div className="bg-green-500 text-white text-xs min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5">
                                {getUnreadCount(event.id)}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center">
                            <Calendar size={12} className="text-neutral-400 mr-1" />
                            <span className="text-xs text-neutral-500">
                              {formatEventDate(event.date)}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Group size={12} className="text-neutral-400 mr-1" />
                            <span className="text-xs text-neutral-500">
                              {event.attendeeCount || 0} asistentes
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
      
      {/* Chat component as overlay */}
      {chatVisible && selectedEventId && (
        <Chat 
          eventId={selectedEventId}
          eventTitle={selectedEventTitle}
          visible={chatVisible}
          onClose={closeChat}
          eventImage={selectedEventImage}
          onHeaderClick={() => {
            const event = [...attendingEvents, ...createdEvents].find(e => e.id === selectedEventId);
            if (event) {
              openEventDetail(event);
            }
          }}
        />
      )}

      {/* Event Detail Sheet */}
      {eventDetailVisible && selectedEventForDetail && (
        <EventDetailSheet
          event={selectedEventForDetail}
          visible={eventDetailVisible}
          onClose={closeEventDetail}
          openedFromChat={true}
        />
      )}
    </div>
  );
};

export default Messages;