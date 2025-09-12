// Simple unified chat service that works consistently from anywhere
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

interface User {
  id: number;
  name: string;
}

class SimpleChatService {
  private socket: WebSocket | null = null;
  private isReady = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  // Event listeners
  private messageListeners: Set<(message: any) => void> = new Set();
  private connectionListeners: Set<() => void> = new Set();
  private errorListeners: Set<(error: any) => void> = new Set();

  constructor() {
    this.connect();
  }

  // Connection management
  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      console.log('📡 WebSocket already connected/connecting');
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('🔗 Simple chat connecting:', wsUrl);
      
      this.socket = new WebSocket(wsUrl);
      
      this.socket.addEventListener('open', () => {
        console.log('✅ Simple chat connected');
        this.isReady = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionListeners();
      });
      
      this.socket.addEventListener('close', () => {
        console.log('🔌 Simple chat disconnected');
        this.isReady = false;
        this.handleReconnection();
      });
      
      this.socket.addEventListener('error', (event) => {
        console.error('❌ Simple chat error:', event);
        this.notifyErrorListeners(event);
      });
      
      this.socket.addEventListener('message', (event) => {
        this.handleMessage(event.data);
      });
      
    } catch (error) {
      console.error('❌ Failed to connect simple chat:', error);
      this.handleReconnection();
    }
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);
      this.notifyMessageListeners(message);
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  }

  private handleReconnection() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`🔄 Simple chat reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    }
  }

  // Event listeners
  onMessage(handler: (message: any) => void) {
    this.messageListeners.add(handler);
  }

  removeMessageListener(handler: (message: any) => void) {
    this.messageListeners.delete(handler);
  }

  onConnect(handler: () => void) {
    this.connectionListeners.add(handler);
    if (this.isReady) {
      handler(); // Call immediately if already connected
    }
  }

  onError(handler: (error: any) => void) {
    this.errorListeners.add(handler);
  }

  private notifyMessageListeners(message: any) {
    this.messageListeners.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('❌ Error in message handler:', error);
      }
    });
  }

  private notifyConnectionListeners() {
    this.connectionListeners.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('❌ Error in connection handler:', error);
      }
    });
  }

  private notifyErrorListeners(error: any) {
    this.errorListeners.forEach(handler => {
      try {
        handler(error);
      } catch (error) {
        console.error('❌ Error in error handler:', error);
      }
    });
  }

  // Core chat operations
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN && this.isReady;
  }

  disconnect() {
    console.log('🔌 Disconnecting simple chat');
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isReady = false;
    this.reconnectAttempts = 0;
  }

  send(data: any): boolean {
    if (!this.isConnected()) {
      console.warn('⚠️ Cannot send - not connected');
      return false;
    }

    try {
      this.socket!.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      return false;
    }
  }

  // Simplified chat operations - no complex state management
  initChat(eventId: number, user: User): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let authReceived = false;
      let joinReceived = false;
      let timeoutId: NodeJS.Timeout;
      
      const initialize = () => {
        console.log(`🚀 Simple chat init for event ${eventId}, user: ${user.name}`);
        
        // Set up a temporary message listener for the initialization sequence
        const initMessageHandler = (data: any) => {
          console.log(`🔄 Init sequence - received: ${data.type}`);
          
          if (data.type === 'auth_success') {
            console.log('🔐 Auth success, joining event...');
            authReceived = true;
            
            // Now join the event
            this.send({
              type: 'join_event',
              eventId
            });
          } else if (data.type === 'joined_event' && data.eventId === eventId) {
            console.log('👥 Joined event, loading messages...');
            joinReceived = true;
            
            // Now load messages
            this.send({
              type: 'load_messages',
              eventId,
              limit: 20,
              offset: 0
            });
          } else if (data.type === 'messages_loaded' && data.eventId === eventId) {
            console.log('📜 Messages loaded, initialization complete');
            // Clean up
            this.removeMessageListener(initMessageHandler);
            if (timeoutId) clearTimeout(timeoutId);
            resolve(true);
          } else if (data.type === 'error' || data.type === 'load_messages_error') {
            console.error('❌ Initialization error:', data);
            this.removeMessageListener(initMessageHandler);
            if (timeoutId) clearTimeout(timeoutId);
            reject(new Error(data.message || 'Initialization failed'));
          }
        };
        
        // Add the temporary listener
        this.onMessage(initMessageHandler);
        
        // Set timeout for initialization
        timeoutId = setTimeout(() => {
          console.warn('⏰ Chat initialization timed out');
          this.removeMessageListener(initMessageHandler);
          resolve(true); // Resolve anyway to continue
        }, 10000); // 10 second timeout
        
        // Start the sequence with authentication
        console.log('🔑 Sending authentication...');
        this.send({
          type: 'auth',
          userId: user.id,
          userName: user.name
        });
      };

      if (this.isConnected()) {
        initialize();
      } else {
        console.log('🔌 Not connected, waiting for connection...');
        this.onConnect(initialize);
      }
    });
  }

  sendMessage(eventId: number, content: string): boolean {
    return this.send({
      type: 'send_message',
      eventId,
      content: content.trim()
    });
  }

  sendTyping(eventId: number, isTyping: boolean): boolean {
    return this.send({
      type: 'typing',
      eventId,
      isTyping
    });
  }

  leaveEvent(eventId: number): boolean {
    return this.send({
      type: 'leave_event',
      eventId
    });
  }
}

// Create singleton
export const simpleChatService = new SimpleChatService();
export default simpleChatService;