import { createServer, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { supabase } from './supabase-client';
import { storage } from './storage';
import crypto from 'crypto';

interface ChatClient {
  ws: WebSocket;
  userId: number;
  userName: string;
}

/**
 * Sets up a WebSocket server with Supabase Realtime integration
 * 
 * This implementation bridges traditional WebSockets with Supabase Realtime
 * for backward compatibility during the migration
 */
export function setupRealtimeWS(server: HttpServer): WebSocketServer {
  // Set up WebSocket server for client connections
  const wss = new WebSocketServer({ 
    server, 
    path: '/ws' 
  });
  
  // Track active connections
  const clients = new Map<string, ChatClient>();
  
  // Subscribe to Supabase realtime and forward events to WebSocket clients
  setupSupabaseRealtimeSubscription(clients);
  
  // Handle WebSocket connections
  wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');
    
    // Generate client ID
    const clientId = crypto.randomUUID();
    
    // Handle messages from clients
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle authentication
        if (data.type === 'auth') {
          const { userId, userName } = data;
          clients.set(clientId, { ws, userId, userName });
          console.log(`Client authenticated: ${userName} (${userId})`);
          
          // Send confirmation to the client
          ws.send(JSON.stringify({
            type: 'auth_success',
            userId,
            userName
          }));
          
          return;
        }
        
        // Handle chat messages - only logged in users
        if (data.type === 'message' && clients.has(clientId)) {
          const { eventId, content } = data;
          const sender = clients.get(clientId)!;
          
          // Validate data
          if (!eventId || !content || content.trim() === '') {
            return;
          }
          
          // Create message payload
          const messageData = {
            type: 'chat',
            eventId,
            message: content,
            sender: {
              id: sender.userId,
              name: sender.userName
            },
            timestamp: new Date().toISOString()
          };
          
          // Insert message into Supabase
          try {
            const { data, error } = await supabase
              .from('event_messages')
              .insert({
                event_id: eventId,
                sender_id: sender.userId,
                sender_name: sender.userName,
                content: content,
                created_at: new Date().toISOString()
              });
              
            if (error) {
              console.error('Error inserting message into Supabase:', error);
            }
            
            // Broadcast to all clients
            // Supabase will trigger a realtime update that will be caught by the subscription
            broadcastMessage(clients, messageData);
          } catch (error) {
            console.error('Error processing chat message:', error);
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      clients.delete(clientId);
    });
  });
  
  console.log('WebSocket server initialized with Supabase Realtime integration');
  return wss;
}

/**
 * Set up a Supabase Realtime subscription for chat messages
 */
function setupSupabaseRealtimeSubscription(clients: Map<string, ChatClient>) {
  // Subscribe to chat messages from the event_messages table
  try {
    supabase
      .channel('event_messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'event_messages' 
      }, (payload) => {
        console.log('Received realtime message from Supabase:', payload);
        
        // Forward the message to WebSocket clients
        const message = {
          type: 'chat',
          eventId: payload.new.event_id,
          message: payload.new.content,
          sender: {
            id: payload.new.sender_id,
            name: payload.new.sender_name
          },
          timestamp: payload.new.created_at
        };
        
        broadcastMessage(clients, message);
      })
      .subscribe((status) => {
        console.log('Supabase realtime subscription status:', status);
      });
      
    console.log('Supabase realtime subscription initialized');
  } catch (error) {
    console.error('Error setting up Supabase realtime subscription:', error);
  }
}

/**
 * Broadcast a message to all connected WebSocket clients
 */
function broadcastMessage(clients: Map<string, ChatClient>, data: any) {
  const message = JSON.stringify(data);
  
  clients.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
  
  console.log(`Broadcasted ${data.type} message to ${clients.size} clients`);
}