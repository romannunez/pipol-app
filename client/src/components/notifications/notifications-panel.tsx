import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, XCircle, Clock, User, Calendar, MapPin, MessageSquare } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserProfile } from '@/contexts/user-profile-context';

interface EventRequest {
  id: number;
  eventId: number;
  userId: number;
  status: string;
  createdAt: string;
  applicationAnswers?: Record<string, string>;
  user: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
  };
  event: {
    id: number;
    title: string;
    date: string;
    privateAccessType?: string;
    applicationQuestions?: Record<string, string>;
  };
}

interface UserNotification {
  type: 'user_notification';
  id: number;
  notificationType: string;
  title: string;
  message: string;
  eventId?: number;
  requestId?: number;
  isRead: boolean;
  createdAt: string;
  event?: {
    title: string;
  };
}

interface PendingRequest {
  type: 'pending_request';
  id: number;
  eventId: number;
  userId: number;
  status: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
  };
  event: {
    id: number;
    title: string;
    date: string;
  };
}

type NotificationItem = UserNotification | PendingRequest;

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ isOpen, onClose }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  const { showUserProfile } = useUserProfile();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAllNotifications();
      markAllAsRead();
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const fetchAllNotifications = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", "/api/notifications/all");
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las notificaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: number) => {
    try {
      setProcessing(prev => ({ ...prev, [requestId]: true }));
      
      const response = await apiRequest("POST", "/api/events/approve-attendee", {
        requestId
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(notif => 
          notif.type === 'pending_request' ? notif.id !== requestId : true
        ));
        toast({
          title: "Solicitud aprobada",
          description: "El usuario ha sido agregado al evento",
        });
      } else {
        throw new Error('Failed to approve request');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: "No se pudo aprobar la solicitud",
        variant: "destructive",
      });
    } finally {
      setProcessing(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      setProcessing(prev => ({ ...prev, [requestId]: true }));
      
      const response = await apiRequest("POST", "/api/events/reject-attendee", {
        requestId
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(notif => 
          notif.type === 'pending_request' ? notif.id !== requestId : true
        ));
        toast({
          title: "Solicitud rechazada",
          description: "La solicitud ha sido rechazada",
        });
      } else {
        throw new Error('Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Error",
        description: "No se pudo rechazar la solicitud",
        variant: "destructive",
      });
    } finally {
      setProcessing(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await apiRequest("POST", "/api/notifications/mark-all-read");
      if (response.ok) {
        // Update local state to mark all user notifications as read
        setNotifications(prev => 
          prev.map(notif => 
            notif.type === 'user_notification' 
              ? { ...notif, isRead: true }
              : notif
          )
        );
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      // Don't show error toast for this - it's not critical to user experience
    }
  };

  const getAccessTypeLabel = (accessType: string) => {
    switch (accessType) {
      case 'request': return 'Por solicitud';
      case 'application': return 'Por postulación';
      case 'paid': return 'Solo de pago';
      default: return accessType;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Semi-transparent background overlay with backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999]"
            onClick={onClose}
          />

          {/* Notifications panel with glassy effect */}
          <motion.div
            ref={panelRef}
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ 
              type: "spring",
              damping: 25,
              stiffness: 300,
              duration: 0.3
            }}
            className="fixed inset-0 flex items-center justify-center z-[99999] p-4 pointer-events-none"
          >
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl border border-white/20 pointer-events-auto">
              {/* Header with glassy effect */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5"
              >
                <h2 className="text-xl font-semibold text-white">Notificaciones</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-full transition-all duration-200 text-white/80 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.div>

              {/* Content area with enhanced glassy effect */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="overflow-y-auto max-h-[calc(80vh-120px)] bg-white/5 backdrop-blur-xl"
              >
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin w-8 h-8 border-4 border-white/30 border-t-white rounded-full" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center p-8 text-white/80">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-white/50" />
                    <p>No tienes notificaciones pendientes</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {notifications.map((notification, index) => (
                      <motion.div
                        key={`${notification.type}-${notification.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index, duration: 0.3 }}
                        className="p-6 hover:bg-white/5 transition-colors duration-200"
                      >
                        {notification.type === 'pending_request' ? (
                          // Pending request from organizer's perspective
                          <div className="flex items-start gap-4">
                            <div 
                              className="flex-shrink-0 cursor-pointer hover:scale-105 transition-transform duration-200"
                              onClick={() => showUserProfile({
                                id: notification.user.id,
                                name: notification.user.name,
                                email: notification.user.email,
                                avatar: notification.user.avatar
                              })}
                            >
                              {notification.user.avatar ? (
                                <img
                                  src={notification.user.avatar}
                                  alt={notification.user.name}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-white/20 hover:border-white/40 transition-colors"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/20 hover:border-white/40 hover:bg-white/30 transition-colors">
                                  <User className="w-6 h-6 text-white/70" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 
                                  className="font-medium text-white cursor-pointer hover:text-blue-300 transition-colors"
                                  onClick={() => showUserProfile({
                                    id: notification.user.id,
                                    name: notification.user.name,
                                    email: notification.user.email,
                                    avatar: notification.user.avatar
                                  })}
                                >
                                  {notification.user.name}
                                </h3>
                                <span className="text-sm text-white/70">
                                  solicita unirse a tu evento
                                </span>
                              </div>

                              <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2 text-sm text-white/80">
                                  <Calendar className="w-4 h-4" />
                                  <span className="font-medium">{notification.event.title}</span>
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm text-white/60">
                                  <Clock className="w-4 h-4" />
                                  <span>{formatDate(notification.event.date)}</span>
                                </div>
                              </div>

                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleApprove(notification.id)}
                                  disabled={processing[notification.id]}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600/80 backdrop-blur text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  {processing[notification.id] ? 'Aprobando...' : 'Aprobar'}
                                </button>
                                
                                <button
                                  onClick={() => handleReject(notification.id)}
                                  disabled={processing[notification.id]}
                                  className="flex items-center gap-2 px-4 py-2 bg-red-600/80 backdrop-blur text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                >
                                  <XCircle className="w-4 h-4" />
                                  {processing[notification.id] ? 'Rechazando...' : 'Rechazar'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // User notifications (approvals, rejections, etc.)
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 bg-green-500/20 backdrop-blur rounded-full flex items-center justify-center border-2 border-green-500/30">
                                <CheckCircle className="w-6 h-6 text-green-400" />
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-medium text-white">{notification.title}</h3>
                                {!notification.isRead && (
                                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                )}
                              </div>

                              <p className="text-sm text-white/80 mb-2">{notification.message}</p>

                              {notification.event && (
                                <div className="flex items-center gap-2 text-sm text-white/60 mb-2">
                                  <Calendar className="w-4 h-4" />
                                  <span>{notification.event.title}</span>
                                </div>
                              )}

                              <div className="flex items-center gap-2 text-xs text-white/50">
                                <Clock className="w-3 h-3" />
                                <span>{formatDate(notification.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}