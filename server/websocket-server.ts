import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { IncomingMessage } from 'http';
import { storage } from './storage';
import { supabase } from './supabase-client';
import { desc, eq, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';

interface AuthenticatedClient {
  ws: WebSocket;
  userId: number;
  userName: string;
  clientId: string;
}

interface ChatMessage {
  id: number;
  eventId: number;
  senderId: number;
  content: string;
  messageType: string;
  replyToId?: number;
  createdAt: Date;
  sender?: {
    id: number;
    name: string;
    username: string;
  };
}

export class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedClient> = new Map();
  private eventRooms: Map<number, Set<string>> = new Map(); // eventId -> Set of clientIds

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    console.log('💬 Chat WebSocket server initialized on /ws');
  }

  private verifyClient(info: { req: IncomingMessage }) {
    // Accept all connections for now, authentication happens after connection
    return true;
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const clientId = crypto.randomUUID();
    console.log(`🔌 New WebSocket connection: ${clientId}`);

    // Send connection acknowledgment
    this.sendToClient(ws, {
      type: 'connection',
      clientId,
      message: 'Connected to chat server'
    });

    ws.on('message', (data) => this.handleMessage(clientId, ws, data));
    ws.on('close', () => this.handleDisconnection(clientId));
    ws.on('error', (error) => this.handleError(clientId, error));
  }

  private async handleMessage(clientId: string, ws: WebSocket, data: any) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'auth':
          await this.handleAuth(clientId, ws, message);
          break;
        case 'join_event':
          await this.handleJoinEvent(clientId, message);
          break;
        case 'leave_event':
          await this.handleLeaveEvent(clientId, message);
          break;
        case 'send_message':
          await this.handleSendMessage(clientId, message);
          break;
        case 'load_messages':
          await this.handleLoadMessages(clientId, message);
          break;
        case 'typing':
          await this.handleTyping(clientId, message);
          break;
        default:
          console.log(`❓ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`❌ Error handling message from ${clientId}:`, error);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }

  private async handleAuth(clientId: string, ws: WebSocket, message: any) {
    try {
      const { userId, userName } = message;
      
      if (!userId || !userName) {
        this.sendToClient(ws, {
          type: 'auth_error',
          message: 'Missing userId or userName'
        });
        return;
      }

      // Verify user exists in database
      const user = await storage.getUserById(userId);
      if (!user) {
        this.sendToClient(ws, {
          type: 'auth_error',
          message: 'User not found'
        });
        return;
      }

      // Store authenticated client
      this.clients.set(clientId, {
        ws,
        userId,
        userName: user.name || user.username,
        clientId
      });

      console.log(`✅ User authenticated: ${user.name || user.username} (${userId})`);

      this.sendToClient(ws, {
        type: 'auth_success',
        userId,
        userName: user.name || user.username
      });

    } catch (error) {
      console.error('❌ Auth error:', error);
      this.sendToClient(ws, {
        type: 'auth_error',
        message: 'Authentication failed'
      });
    }
  }

  private async handleJoinEvent(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.log(`❌ Client ${clientId} not found for join event`);
      return;
    }

    const { eventId } = message;
    if (!eventId) {
      console.log(`❌ No eventId provided for join event`);
      return;
    }

    try {
      console.log(`🔍 Checking access for user ${client.userId} to event ${eventId}`);
      
      // Verify user has access to this event (is attendee or organizer)
      const hasAccess = await this.verifyEventAccess(client.userId, eventId);
      if (!hasAccess) {
        console.log(`❌ User ${client.userId} denied access to event ${eventId}`);
        this.sendToClient(client.ws, {
          type: 'join_error',
          eventId,
          error: 'Not authorized to join this event'
        });
        return;
      }

      // Leave all previous event rooms for this client
      this.eventRooms.forEach((room, roomEventId) => {
        if (room.has(clientId) && roomEventId !== eventId) {
          console.log(`👋 User ${client.userName} leaving previous event ${roomEventId}`);
          room.delete(clientId);
          if (room.size === 0) {
            this.eventRooms.delete(roomEventId);
          }
          
          // Notify others in the previous room
          this.broadcastToEventRoom(roomEventId, {
            type: 'user_left',
            eventId: roomEventId,
            user: {
              id: client.userId,
              name: client.userName
            }
          }, clientId);
        }
      });

      // Add client to new event room
      if (!this.eventRooms.has(eventId)) {
        this.eventRooms.set(eventId, new Set());
      }
      this.eventRooms.get(eventId)!.add(clientId);

      console.log(`✅ User ${client.userName} joined event ${eventId} successfully`);

      this.sendToClient(client.ws, {
        type: 'joined_event',
        eventId,
        message: `Joined event ${eventId} chat`
      });

      // Notify other users in the room
      this.broadcastToEventRoom(eventId, {
        type: 'user_joined',
        eventId,
        user: {
          id: client.userId,
          name: client.userName
        }
      }, clientId);

    } catch (error) {
      console.error('❌ Error joining event:', error);
      this.sendToClient(client.ws, {
        type: 'join_error',
        eventId,
        error: 'Failed to join event'
      });
    }
  }

  private async handleLeaveEvent(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const { eventId } = message;
    if (!eventId) {
      return;
    }

    // Remove client from event room
    const room = this.eventRooms.get(eventId);
    if (room) {
      room.delete(clientId);
      if (room.size === 0) {
        this.eventRooms.delete(eventId);
      }
    }

    console.log(`👋 User ${client.userName} left event ${eventId}`);

    this.sendToClient(client.ws, {
      type: 'left_event',
      eventId
    });

    // Notify other users in the room
    this.broadcastToEventRoom(eventId, {
      type: 'user_left',
      eventId,
      user: {
        id: client.userId,
        name: client.userName
      }
    }, clientId);
  }

  private async handleSendMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const { eventId, content, replyToId } = message;
    
    if (!eventId || !content || content.trim() === '') {
      this.sendToClient(client.ws, {
        type: 'message_error',
        message: 'Missing eventId or content'
      });
      return;
    }

    try {
      // Verify user has access to this event
      console.log(`🔍 Verifying message access for user ${client.userId} to event ${eventId}`);
      const hasAccess = await this.verifyEventAccess(client.userId, eventId);
      if (!hasAccess) {
        console.log(`❌ User ${client.userId} denied message access to event ${eventId}`);
        this.sendToClient(client.ws, {
          type: 'message_error',
          message: 'No access to this event'
        });
        return;
      }

      // Save message to database using Supabase
      const { data: newMessage, error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          event_id: eventId,
          sender_id: client.userId,
          content: content.trim(),
          message_type: 'text',
          reply_to_id: replyToId || null
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error inserting message:', insertError);
        this.sendToClient(client.ws, {
          type: 'message_error',
          message: 'Failed to save message'
        });
        return;
      }

      // Get complete message with sender info
      const { data: completeMessage, error: fetchError } = await supabase
        .from('chat_messages')
        .select(`
          id,
          event_id,
          sender_id,
          content,
          message_type,
          reply_to_id,
          created_at,
          sender:users!sender_id (
            id,
            name,
            username
          )
        `)
        .eq('id', newMessage.id)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching complete message:', fetchError);
        return;
      }

      if (completeMessage) {
        const messagePayload = {
          type: 'new_message',
          eventId,
          message: {
            id: completeMessage.id,
            eventId: completeMessage.event_id,
            senderId: completeMessage.sender_id,
            content: completeMessage.content,
            messageType: completeMessage.message_type,
            replyToId: completeMessage.reply_to_id,
            createdAt: completeMessage.created_at,
            sender: completeMessage.sender
          }
        };

        // Broadcast to all clients in the event room
        this.broadcastToEventRoom(eventId, messagePayload);
        
        console.log(`💬 Message sent in event ${eventId} by ${client.userName}`);
      }

    } catch (error) {
      console.error('❌ Error sending message:', error);
      this.sendToClient(client.ws, {
        type: 'message_error',
        message: 'Failed to send message'
      });
    }
  }

  private async handleLoadMessages(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const { eventId, limit = 50, offset = 0 } = message;
    
    if (!eventId) {
      return;
    }

    try {
      // Verify user has access to this event
      console.log(`🔍 Verifying load messages access for user ${client.userId} to event ${eventId}`);
      const hasAccess = await this.verifyEventAccess(client.userId, eventId);
      if (!hasAccess) {
        console.log(`❌ User ${client.userId} denied load messages access to event ${eventId}`);
        this.sendToClient(client.ws, {
          type: 'load_messages_error',
          eventId,
          message: 'No access to this event'
        });
        return;
      }

      // Load messages from database using Supabase
      console.log(`🔍 Loading messages for event ${eventId} (type: ${typeof eventId})`);
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          event_id,
          sender_id,
          content,
          message_type,
          reply_to_id,
          created_at,
          sender:users!sender_id (
            id,
            name,
            username
          )
        `)
        .eq('event_id', Number(eventId))
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 100))
        .range(offset, offset + Math.min(limit, 100) - 1);
        
      if (error) {
        console.error('❌ Error loading messages:', error);
        this.sendToClient(client.ws, {
          type: 'load_messages_error',
          eventId,
          message: 'Failed to load messages'
        });
        return;
      }
      const messageList = messages || [];
      console.log(`📊 Found ${messageList.length} messages in database for event ${eventId}`);

      console.log(`📜 Sending ${messageList.length} messages for event ${eventId} to user ${client.userId}`);
      this.sendToClient(client.ws, {
        type: 'messages_loaded',
        eventId,
        messages: messageList.reverse(), // Reverse to show oldest first
        hasMore: messages.length === limit
      });

    } catch (error) {
      console.error('❌ Error loading messages:', error);
      this.sendToClient(client.ws, {
        type: 'load_messages_error',
        eventId,
        message: 'Failed to load messages'
      });
    }
  }

  private async handleTyping(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const { eventId, isTyping } = message;
    
    if (!eventId) {
      return;
    }

    // Broadcast typing status to other users in the room
    this.broadcastToEventRoom(eventId, {
      type: 'user_typing',
      eventId,
      user: {
        id: client.userId,
        name: client.userName
      },
      isTyping
    }, clientId);
  }

  private async verifyEventAccess(userId: number, eventId: number): Promise<boolean> {
    try {
      console.log(`🔍 Verifying access for user ${userId} to event ${eventId}`);
      
      // Check if user is the organizer first - convert eventId to number for comparison
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*, organizer:users!organizer_id(*)')
        .eq('id', Number(eventId))
        .single();

      if (eventError && eventError.code !== 'PGRST116') {
        console.error('❌ Error fetching event for access verification:', eventError);
        return false;
      }

      if (!event) {
        console.log(`❌ Event ${eventId} not found in access verification`);
        return false;
      }

      console.log(`📋 Event found: ${event.title}, organizer: ${event.organizer_id}, user requesting: ${userId}`);
      console.log(`🔍 Comparing organizer ID (${event.organizer_id}) with user ID (${userId})`);
      console.log(`🔍 Types: organizer (${typeof event.organizer_id}) vs user (${typeof userId})`);

      // If user is the organizer, they have access (organizers attend their own events)
      if (Number(event.organizer_id) === Number(userId)) {
        console.log(`✅ User ${userId} is organizer of event ${eventId} - access granted`);
        return true;
      }

      // Check if user is an attendee
      const { data: attendee, error: attendeeError } = await supabase
        .from('event_attendees')
        .select('*')
        .eq('event_id', Number(eventId))
        .eq('user_id', userId)
        .single();

      if (attendeeError && attendeeError.code !== 'PGRST116') {
        console.error('❌ Error checking attendee status:', attendeeError);
      }

      if (attendee) {
        console.log(`✅ User ${userId} is attendee of event ${eventId} - access granted`);
        return true;
      }

      // For development/testing purposes, allow access to all public events
      // In production, you might want to restrict this
      console.log(`⚠️ User ${userId} accessing public event ${eventId} - temporary access granted for development`);
      return true;

    } catch (error) {
      console.error('❌ Error verifying event access:', error);
      return false;
    }
  }

  private handleDisconnection(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`🔌 User ${client.userName} disconnected`);

      // Remove from all event rooms
      for (const [eventId, room] of Array.from(this.eventRooms.entries())) {
        if (room.has(clientId)) {
          room.delete(clientId);
          
          // Notify other users in the room
          this.broadcastToEventRoom(eventId, {
            type: 'user_left',
            eventId,
            user: {
              id: client.userId,
              name: client.userName
            }
          }, clientId);

          if (room.size === 0) {
            this.eventRooms.delete(eventId);
          }
        }
      }

      this.clients.delete(clientId);
    }
  }

  private handleError(clientId: string, error: Error) {
    console.error(`❌ WebSocket error for client ${clientId}:`, error);
    this.handleDisconnection(clientId);
  }

  private sendToClient(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private broadcastToEventRoom(eventId: number, data: any, excludeClientId?: string) {
    const room = this.eventRooms.get(eventId);
    if (!room) {
      return;
    }

    for (const clientId of Array.from(room)) {
      if (excludeClientId && clientId === excludeClientId) {
        continue;
      }

      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client.ws, data);
      }
    }
  }

  public getStats() {
    return {
      connectedClients: this.clients.size,
      activeRooms: this.eventRooms.size,
      totalRoomConnections: Array.from(this.eventRooms.values()).reduce(
        (total, room) => total + room.size, 
        0
      )
    };
  }
}