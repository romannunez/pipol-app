import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { simpleChatService } from "./simple-chat-service";
import { useNavigation } from "@/contexts/navigation-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useUserProfile } from "@/contexts/user-profile-context";
import { useZIndex } from "@/contexts/z-index-context";
import { usePanelGestures } from "@/hooks/use-panel-gestures";

type Message = {
  userId: number;
  userName: string;
  content: string;
  timestamp: string;
  isMine?: boolean;
};

type ChatProps = {
  eventId: number;
  eventTitle: string;
  visible: boolean;
  onClose: () => void;
  eventImage?: string; // URL de la imagen principal del evento
  onHeaderClick?: () => void;
  parentZIndex?: number; // Z-index del panel padre si se abre desde otro panel
};

export default function Chat({
  eventId,
  eventTitle,
  visible,
  onClose,
  eventImage,
  onHeaderClick,
  parentZIndex,
}: ChatProps) {
  const { user } = useAuth();
  const { hideNavigation, showNavigation } = useNavigation();
  const { showUserProfile } = useUserProfile();
  const { getNextZIndex } = useZIndex();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [currentZIndex, setCurrentZIndex] = useState(100);
  const [hasAnimated, setHasAnimated] = useState(false);
  // Advanced gesture system for professional mobile app experience
  const { height: panelHeight, isDragging, gestureHandlers } = usePanelGestures({
    minHeight: 25,
    maxHeight: 95,
    snapPositions: [30, 60, 90],
    velocityThreshold: 0.8,
    closeThreshold: 35,
    onClose,
    enableRubberBanding: true,
    hapticFeedback: true,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollControls = useAnimation();
  const connectionControls = useAnimation();
  const panelControls = useAnimation();


  // Control navigation visibility and z-index with smooth animations
  useEffect(() => {
    if (visible && !hasAnimated) {
      hideNavigation();
      setHasAnimated(true);
      
      // Si se abre desde un panel padre, usar su z-index + 20 para aparecer encima
      if (parentZIndex) {
        const newZIndex = parentZIndex + 20;
        setCurrentZIndex(newZIndex);
        console.log(`🎯 Chat panel opened with z-index: ${newZIndex} (parent: ${parentZIndex})`);
      } else {
        // Si se abre independientemente, obtener nuevo z-index
        const newZIndex = getNextZIndex();
        setCurrentZIndex(newZIndex);
        console.log(`🎯 Chat panel opened with z-index: ${newZIndex}`);
      }
    } else if (!visible && hasAnimated) {
      showNavigation();
      setHasAnimated(false);
    }
    
    // Cleanup: show navigation when component unmounts
    return () => {
      if (hasAnimated) {
        showNavigation();
      }
    };
  }, [visible, hasAnimated, hideNavigation, showNavigation, getNextZIndex, parentZIndex]);

  // Smooth scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
      // Trigger scroll animation
      scrollControls.start({
        y: [5, 0],
        opacity: [0.8, 1],
        transition: { duration: 0.3, ease: "easeOut" }
      });
    }
  }, [messages, scrollControls]);

  // Simple chat initialization with better reconnection
  useEffect(() => {
    if (!user || !visible) return;

    console.log(`🚀 Initializing simple chat for event ${eventId}`);
    
    // Reset connection state when reinitialized
    setIsConnected(false);
    setLoadingMessages(true);
    
    // Set up message listener
    const handleMessage = (data: any) => {
      console.log("📨 Simple chat message:", data.type, data);
      
      switch (data.type) {
        case 'connection':
          console.log('📡 Simple chat connection acknowledged');
          break;
          
        case 'auth_success':
          console.log('🔐 Simple chat authenticated');
          setIsConnected(true);
          // Animate connection status
          connectionControls.start({
            scale: [0.8, 1.1, 1],
            opacity: [0, 1],
            transition: { duration: 0.5, ease: "backOut" }
          });
          break;
          
        case 'joined_event':
          console.log('👥 Simple chat joined event:', data.eventId);
          break;
          
        case 'messages_loaded':
          if (data.eventId === eventId) {
            console.log('📜 Simple chat messages loaded:', data.messages?.length || 0);
            setLoadingMessages(false);
            if (data.messages && data.messages.length > 0) {
              const loadedMessages = data.messages.map((msg: any) => ({
                userId: msg.sender_id || msg.senderId,
                userName: msg.sender?.name || msg.sender?.username || "Unknown",
                content: msg.content,
                timestamp: msg.created_at || msg.createdAt || new Date().toISOString(),
                isMine: (msg.sender_id || msg.senderId) === user.id,
              }));
              setMessages(loadedMessages);
            } else {
              setMessages([]);
            }
          }
          break;
          
        case 'new_message':
          if (data.eventId === eventId && data.message) {
            console.log('💬 Simple chat new message');
            const msg = data.message;
            const newMsg = {
              userId: msg.sender_id || msg.senderId,
              userName: msg.sender?.name || msg.sender?.username || "Unknown",
              content: msg.content,
              timestamp: msg.created_at || msg.createdAt || new Date().toISOString(),
              isMine: (msg.sender_id || msg.senderId) === user.id,
            };

            setMessages((prevMessages) => [...prevMessages, newMsg]);
          }
          break;
          
        case 'typing':
          if (data.eventId === eventId && data.user.id !== user.id) {
            if (data.isTyping) {
              setTypingUsers((prev) => new Set(prev).add(data.user.name));
            } else {
              setTypingUsers((prev) => {
                const newSet = new Set(prev);
                newSet.delete(data.user.name);
                return newSet;
              });
            }
          }
          break;
          
        case 'error':
        case 'load_messages_error':
          console.error('❌ Simple chat error:', data.message || data.error);
          setLoadingMessages(false);
          break;
      }
    };

    // Add message listener
    simpleChatService.onMessage(handleMessage);
    
    // Initialize chat with improved connection handling
    setLoadingMessages(true);
    
    // Initialize chat with proper connection handling
    const initializeChat = async () => {
      try {
        // Check connection status
        if (!simpleChatService.isConnected()) {
          console.log("🔄 Chat not connected, establishing connection...");
          simpleChatService.disconnect();
          simpleChatService.connect();
          
          // Wait for connection to be established
          await new Promise(resolve => {
            const checkConnection = () => {
              if (simpleChatService.isConnected()) {
                resolve(true);
              } else {
                setTimeout(checkConnection, 100);
              }
            };
            setTimeout(checkConnection, 200);
          });
        }
        
        console.log("🚀 Starting chat initialization sequence...");
        
        await simpleChatService.initChat(eventId, {
          id: user.id,
          name: user.name || user.username || 'User'
        });
        
        console.log('✅ Simple chat initialized successfully');
        setIsConnected(true);
        setLoadingMessages(false);
      } catch (error) {
        console.error('❌ Simple chat init failed:', error);
        setLoadingMessages(false);
        setIsConnected(false);
      }
    };
    
    // Small delay to ensure component is fully mounted
    setTimeout(initializeChat, 100);

    // Cleanup
    return () => {
      console.log('🧹 Simple chat cleanup');
      simpleChatService.removeMessageListener(handleMessage);
      simpleChatService.leaveEvent(eventId);
    };
  }, [user, visible, eventId]);

  // Send message
  const sendMessage = () => {
    console.log("🔤 Attempting to send message:", { 
      message: newMessage.trim(), 
      eventId, 
      isConnected, 
      user: user?.id 
    });
    
    if (!newMessage.trim()) {
      console.warn("⚠️ Cannot send empty message");
      return;
    }
    
    if (!isConnected) {
      console.warn("⚠️ Cannot send message - not connected");
      return;
    }

    const success = simpleChatService.sendMessage(eventId, newMessage.trim());
    console.log("📤 Simple chat send message result:", success);
    
    if (success) {
      console.log("✅ Message sent successfully, clearing input");
      setNewMessage("");
      // Stop typing indicator
      if (isTyping) {
        setIsTyping(false);
        simpleChatService.sendTyping(eventId, false);
      }
    } else {
      console.error("❌ Failed to send message");
    }
  };

  // Handle typing
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      simpleChatService.sendTyping(eventId, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        simpleChatService.sendTyping(eventId, false);
      }
    }, 2000);
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };


  if (!visible || !user) return null;

  return (
    <>
      {/* Semi-transparent background overlay with backdrop blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        style={{ zIndex: currentZIndex - 1 }}
        onClick={onClose}
      />

      {/* Chat panel - unified design with professional animations */}
      <motion.div
        initial={{ y: "100%", opacity: 0, scale: 0.95 }}
        animate={{ 
          y: parentZIndex ? ["-10px", "0px"] : ["-5px", "0px"],
          opacity: 1,
          scale: 1,
          transition: {
            duration: parentZIndex ? 0.7 : 0.6,
            times: parentZIndex ? [0, 1] : [0, 1],
            ease: [0.23, 1, 0.32, 1]
          }
        }}
        exit={{ 
          y: "100%", 
          opacity: 0, 
          scale: 0.95,
          transition: {
            duration: 0.4,
            ease: [0.4, 0, 0.6, 1]
          }
        }}
        ref={panelRef}
        className="fixed inset-x-0 bottom-0 bg-white/5 backdrop-blur-lg rounded-t-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ease-out"
        style={{ 
          zIndex: currentZIndex,
          height: `${panelHeight}vh`,
          maxHeight: '95vh'
        }}
        {...gestureHandlers}
      >
        {/* Header - Style similar to event detail sheet with drag handle */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="bg-gradient-to-r from-yellow-300 to-yellow-500 p-4 flex items-center rounded-t-3xl cursor-grab active:cursor-grabbing relative"
        >
          {/* Drag handle indicator */}
          <div className={`absolute top-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-white/30 rounded-full transition-all duration-150 ${isDragging ? 'scale-110 bg-white/50' : ''}`}></div>
          <button
            onClick={onClose}
            className="p-1 text-white hover:bg-white/20 rounded-full mr-3 transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div 
            className="flex items-center flex-1 cursor-pointer hover:bg-white/10 rounded-lg p-2 -m-2 transition-colors"
            onClick={onHeaderClick}
          >
            <div className="w-12 h-12 rounded-full overflow-hidden mr-3 border-2 border-white/30">
              {eventImage ? (
                <img
                  src={eventImage}
                  alt={eventTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">💬</span>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium text-white text-sm leading-tight">
                {eventTitle}
              </h3>
              <p className="text-white/80 text-xs">Chat del Evento · Toca para ver detalles</p>
            </div>
          </div>
        </motion.div>

        {/* Messages - Fully transparent background with intense blur */}
        <motion.div 
          animate={scrollControls}
          className="flex-1 bg-transparent backdrop-blur-xl relative overflow-hidden"
        >
          <ScrollArea className="h-full" style={{ touchAction: isDragging ? 'none' : 'pan-y' }}>
            <div className="p-4 space-y-2">
              <AnimatePresence mode="popLayout">
                {loadingMessages ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="h-40 flex items-center justify-center text-white"
                  >
                    <motion.div
                      animate={{ 
                        rotate: 360,
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                        scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
                      }}
                      className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full mr-3"
                    />
                    <p className="text-sm">Cargando mensajes...</p>
                  </motion.div>
                ) : messages.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.4, ease: "backOut" }}
                    className="h-40 flex flex-col items-center justify-center text-white text-center"
                  >
                    <motion.div
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-3"
                    >
                      <span className="text-yellow-500 text-2xl">💬</span>
                    </motion.div>
                    <p className="text-sm font-medium">No hay mensajes aún</p>
                    <p className="text-xs text-white/70">
                      ¡Inicia la conversación!
                    </p>
                  </motion.div>
                ) : (
                  messages.map((message, index) => (
                    <motion.div
                      key={`${message.timestamp}-${index}`}
                      layout
                      initial={{ 
                        opacity: 0, 
                        y: 50,
                        scale: 0.8
                      }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        scale: 1
                      }}
                      exit={{ 
                        opacity: 0, 
                        y: -20,
                        scale: 0.9
                      }}
                      transition={{
                        type: "spring",
                        damping: 20,
                        stiffness: 300,
                        delay: index * 0.05
                      }}
                      whileHover={{ 
                        scale: 1.02,
                        transition: { duration: 0.2 }
                      }}
                      className={`flex mb-3 items-end ${message.isMine ? "justify-end" : "justify-start"}`}
                    >
                    {/* Avatar for other users (left side) */}
                    {!message.isMine && (
                      <div 
                        className="w-8 h-8 rounded-full overflow-hidden mr-2 mb-1 flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                        onClick={() => showUserProfile({
                          id: message.userId,
                          name: message.userName,
                          email: `${message.userName}@example.com`, // Fallback email
                        })}
                      >
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {message.userName?.charAt(0)?.toUpperCase() || "U"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Message bubbles with WhatsApp-style design */}
                    <div
                      className={`relative max-w-[75%] ${
                        message.isMine
                          ? "bg-blue-500 text-white rounded-2xl rounded-br-sm"
                          : "bg-white/90 text-gray-800 rounded-2xl rounded-bl-sm"
                      } px-4 py-3 shadow-lg backdrop-blur-sm border ${message.isMine ? "border-blue-400/50" : "border-gray-200/50"}`}
                    >
                      {/* Message content */}
                      <div className="space-y-1">
                        {!message.isMine && (
                          <p className="text-xs font-medium text-blue-600 mb-1">
                            {message.userName}
                          </p>
                        )}
                        <p
                          className={`text-sm leading-relaxed ${message.isMine ? "text-white" : "text-gray-800"}`}
                        >
                          {message.content}
                        </p>
                        <p
                          className={`text-xs ${message.isMine ? "text-blue-100" : "text-gray-500"} text-right mt-1`}
                        >
                          {(() => {
                            try {
                              const date = new Date(message.timestamp);
                              if (isNaN(date.getTime())) {
                                return "Ahora";
                              }
                              return format(date, "HH:mm");
                            } catch (error) {
                              console.error("Error formatting timestamp:", message.timestamp, error);
                              return "Ahora";
                            }
                          })()}
                        </p>
                      </div>
                    </div>

                    {/* Avatar for my messages (right side) */}
                    {message.isMine && (
                      <div className="w-8 h-8 rounded-full overflow-hidden ml-2 mb-1 flex-shrink-0">
                        {user?.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name || user.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {user?.name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || "Y"}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                  ))
                )}
              </AnimatePresence>
              <motion.div 
                ref={messagesEndRef} 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            </div>
          </ScrollArea>
        </motion.div>

        {/* Input area */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="bg-white/10 backdrop-blur-md border-t border-white/20 p-4"
        >
          <div className="flex items-center space-x-3">
            <Input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleTyping}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-white/20 backdrop-blur-sm border-white/30 text-black placeholder-white/70 rounded-2xl px-4 py-3"
              disabled={!isConnected}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || !isConnected}
              className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-full p-3 shadow-lg"
            >
              <Send size={20} />
            </Button>
          </div>

          {/* Typing indicator */}
          <AnimatePresence>
            {typingUsers.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 text-xs text-white/70 flex items-center"
              >
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ 
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-2 h-2 bg-white/50 rounded-full mr-2"
                />
                <span>{Array.from(typingUsers).join(", ")} escribiendo...</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!isConnected && (
              <motion.div
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 text-xs text-red-300 flex items-center"
              >
                <motion.div
                  animate={{ 
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{ 
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-2 h-2 bg-red-400 rounded-full mr-2"
                />
                <span>Desconectado - Reintentando...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
}
