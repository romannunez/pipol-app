import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Calendar, Mail, MessageSquare, UserPlus, UserCheck, Star } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/contexts/user-profile-context';
import { formatDate } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export default function UserProfilePanel() {
  const { selectedUser, isProfileOpen, hideUserProfile } = useUserProfile();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [isLoadingInterests, setIsLoadingInterests] = useState(false);
  const [userAura, setUserAura] = useState<{ aura: number; count: number } | null>(null);
  const [canRate, setCanRate] = useState<{ canRate: boolean; reason?: string } | null>(null);
  const [isRating, setIsRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        hideUserProfile();
      }
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen, hideUserProfile]);

  // Fetch user data when profile opens
  useEffect(() => {
    if (isProfileOpen && selectedUser) {
      fetchUserInterests();
      fetchUserAura();
      if (!isOwnProfile) {
        checkCanRate();
      }
    }
  }, [isProfileOpen, selectedUser]);

  const fetchUserInterests = async () => {
    if (!selectedUser) return;
    
    try {
      setIsLoadingInterests(true);
      const response = await apiRequest("GET", `/api/users/${selectedUser.id}/interests`);
      if (response.ok) {
        const data = await response.json();
        setUserInterests(data.interests || []);
      }
    } catch (error) {
      console.error('Error fetching user interests:', error);
    } finally {
      setIsLoadingInterests(false);
    }
  };

  const handleSendMessage = () => {
    // TODO: Implementar funcionalidad de enviar mensaje
    toast({
      title: "Próximamente",
      description: "La función de mensajes se implementará pronto",
    });
  };

  const fetchUserAura = async () => {
    if (!selectedUser) return;
    
    try {
      const response = await apiRequest("GET", `/api/users/${selectedUser.id}/aura`);
      if (response.ok) {
        const data = await response.json();
        setUserAura(data);
      }
    } catch (error) {
      console.error('Error fetching user aura:', error);
    }
  };

  const checkCanRate = async () => {
    if (!selectedUser) return;
    
    try {
      const response = await apiRequest("GET", `/api/users/${selectedUser.id}/can-rate`);
      if (response.ok) {
        const data = await response.json();
        setCanRate(data);
      }
    } catch (error) {
      console.error('Error checking rating eligibility:', error);
    }
  };

  const handleRateUser = async (rating: number) => {
    if (!selectedUser || isRating) return;
    
    try {
      setIsRating(true);
      const response = await apiRequest("POST", `/api/users/${selectedUser.id}/rate`, {
        rating
      });
      
      if (response.ok) {
        toast({
          title: "Rating enviado",
          description: `Has dado ${rating}/10 aura a ${selectedUser.name}`,
        });
        
        // Refresh aura and can rate status
        fetchUserAura();
        checkCanRate();
        setSelectedRating(0);
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "No se pudo enviar el rating",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al enviar el rating",
        variant: "destructive",
      });
    } finally {
      setIsRating(false);
    }
  };

  const handleAddFriend = () => {
    // TODO: Implementar funcionalidad de agregar amigo
    toast({
      title: "Próximamente", 
      description: "La función de amigos se implementará pronto",
    });
  };

  // Función para traducir categorías al español
  const translateCategory = (category: string): string => {
    const translations: Record<string, string> = {
      social: 'Social',
      music: 'Música',
      spiritual: 'Espiritual',
      education: 'Educación',
      sports: 'Deportes',
      food: 'Comida',
      art: 'Arte',
      technology: 'Tecnología',
      games: 'Juegos',
      outdoor: 'Aire libre',
      networking: 'Networking',
      workshop: 'Talleres',
      conference: 'Conferencias',
      party: 'Fiestas',
      fair: 'Ferias',
      exhibition: 'Exposiciones'
    };
    return translations[category] || category;
  };

  if (!selectedUser) return null;

  const isOwnProfile = currentUser?.id === selectedUser.id;

  return (
    <AnimatePresence>
      {isProfileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
        >
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl border border-white/20 pointer-events-auto"
          >
            {/* Header with glassy effect */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5"
            >
              <h2 className="text-xl font-semibold text-white">Perfil de Usuario</h2>
              <button
                onClick={hideUserProfile}
                className="p-2 hover:bg-white/20 rounded-full transition-all duration-200 text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>

            {/* Profile Content */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {/* Avatar and Basic Info */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="flex flex-col items-center text-center space-y-4"
              >
                <Avatar className="w-24 h-24 border-4 border-white/20">
                  {selectedUser.avatar ? (
                    <img
                      src={selectedUser.avatar}
                      alt={selectedUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Avatar>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">{selectedUser.name}</h3>
                  {selectedUser.username && (
                    <p className="text-white/70">@{selectedUser.username}</p>
                  )}
                  {selectedUser.bio && (
                    <p className="text-white/80 text-sm max-w-xs mx-auto">
                      {selectedUser.bio}
                    </p>
                  )}
                </div>
              </motion.div>

              {/* User Details */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="space-y-3"
              >
                {selectedUser.bio && (
                  <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                    <p className="text-white/90 text-sm text-center italic">
                      "{selectedUser.bio}"
                    </p>
                  </div>
                )}
                
                {selectedUser.createdAt && (
                  <div className="flex items-center justify-center space-x-2 text-white/60">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs">
                      Miembro desde {formatDate(selectedUser.createdAt)}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Aura Section */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.3 }}
                className="bg-white/10 rounded-lg p-4 border border-white/20 text-center"
              >
                <h4 className="text-lg font-semibold text-white mb-2 flex items-center justify-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  Aura
                </h4>
                {userAura ? (
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-yellow-400">
                      {userAura.aura > 0 
                        ? `${userAura.aura % 1 === 0 ? userAura.aura : userAura.aura.toFixed(1)}/10` 
                        : "N/A"
                      }
                    </div>
                    <div className="text-xs text-white/60">
                      {userAura.count > 0 
                        ? `Basado en ${userAura.count} ${userAura.count === 1 ? 'rating' : 'ratings'}`
                        : "Sin ratings aún"
                      }
                    </div>
                  </div>
                ) : (
                  <div className="animate-pulse">
                    <div className="w-16 h-8 bg-white/20 rounded mx-auto mb-2"></div>
                    <div className="w-24 h-3 bg-white/10 rounded mx-auto"></div>
                  </div>
                )}
              </motion.div>

              {/* Rating Section */}
              {!isOwnProfile && canRate && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                  className="bg-white/10 rounded-lg p-4 border border-white/20"
                >
                  {canRate.canRate ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-white text-center">
                        Dar Aura a {selectedUser.name}
                      </h4>
                      <div className="flex justify-center space-x-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                          <button
                            key={rating}
                            onClick={() => setSelectedRating(rating)}
                            className={`w-6 h-6 text-xs rounded-full border transition-all duration-200 ${
                              selectedRating >= rating
                                ? 'bg-yellow-400 text-black border-yellow-400'
                                : 'bg-white/20 text-white/70 border-white/30 hover:border-yellow-400 hover:text-yellow-400'
                            }`}
                            disabled={isRating}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                      {selectedRating > 0 && (
                        <div className="flex justify-center">
                          <Button
                            onClick={() => handleRateUser(selectedRating)}
                            disabled={isRating}
                            className="bg-yellow-500 hover:bg-yellow-600 text-black text-sm px-4 py-2"
                          >
                            {isRating ? 'Enviando...' : `Dar ${selectedRating}/10`}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-white/70 text-sm">
                        {canRate.reason}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* User Interests */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="space-y-3"
              >
                <h4 className="text-lg font-semibold text-white">Intereses</h4>
                {isLoadingInterests ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  </div>
                ) : userInterests.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {userInterests.map((interest, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-white/20 text-white text-xs rounded-full border border-white/30"
                      >
                        {translateCategory(interest)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/60 text-sm">No hay intereses disponibles</p>
                )}
              </motion.div>

              {/* Action Buttons */}
              {!isOwnProfile && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                  className="flex space-x-3"
                >
                  <Button
                    onClick={handleSendMessage}
                    className="flex-1 bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-all duration-200"
                    variant="outline"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Mensaje
                  </Button>
                  <Button
                    onClick={handleAddFriend}
                    className="flex-1 bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-all duration-200"
                    variant="outline"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Seguir
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}