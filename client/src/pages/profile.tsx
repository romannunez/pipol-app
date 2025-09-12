import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import BottomNav from "@/components/layout/bottom-nav";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  User, 
  Settings, 
  LogOut, 
  Edit, 
  Star,
  Calendar,
  Camera,
  Check,
  X,
  Ticket
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import LoadingSpinner from "@/components/ui/loading-spinner";

// Categorías de eventos disponibles para intereses
const EVENT_CATEGORIES = [
  'social', 'music', 'spiritual', 'education', 
  'sports', 'food', 'art', 'technology',
  'games', 'outdoor', 'networking', 'workshop',
  'conference', 'party', 'fair', 'exhibition'
];

// Opciones de género disponibles
const GENDER_OPTIONS = [
  { value: 'hombre', label: 'Hombre' },
  { value: 'mujer', label: 'Mujer' },
  { value: 'otro', label: 'Otro' },
  { value: 'no_especificar', label: 'Prefiero no especificar' }
];

const Profile = () => {
  const { user, isLoading, logoutMutation, updateUserMutation } = useAuth();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estado para el diálogo de edición
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    gender: ""
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para la gestión de intereses
  const [isInterestsDialogOpen, setIsInterestsDialogOpen] = useState(false);
  const [selectedInterest, setSelectedInterest] = useState("");

  // Función para manejar la selección de imagen de perfil
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Inicializar el formulario cuando el usuario esté disponible
  useEffect(() => {
    if (user && !isEditDialogOpen) {
      setEditForm({
        name: user.name || "",
        bio: user.bio || "",
        gender: user.gender || ""
      });
    }
  }, [user, isEditDialogOpen]);

  // Función para manejar el logout
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Consulta para obtener eventos a los que asiste el usuario
  const { data: attendingEvents = [] } = useQuery({
    queryKey: ['user', 'events', 'attending'],
    queryFn: async () => {
      const response = await fetch(`/api/user/events/attending`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch attending events');
      }
      return response.json();
    },
    enabled: !!user,
  });

  // Consulta para obtener los intereses del usuario
  const { data: userInterests = [], refetch: refetchInterests } = useQuery({
    queryKey: ['user', 'interests'],
    queryFn: async () => {
      const response = await fetch('/api/user/interests', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch user interests');
      }
      return response.json();
    },
    enabled: !!user,
  });

  // Función para formatear categorías
  const formatCategory = (category: string) => {
    const translations: { [key: string]: string } = {
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

  // Mutación para añadir interés
  const addInterestMutation = useMutation({
    mutationFn: async (category: string) => {
      const response = await fetch("/api/user/interests", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ category }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add interest');
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetchInterests();
      toast({
        title: "Interés añadido",
        description: "El interés ha sido añadido correctamente",
      });
      setSelectedInterest("");
      setIsInterestsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo añadir el interés",
        variant: "destructive",
      });
    },
  });

  // Mutación para eliminar interés
  const removeInterestMutation = useMutation({
    mutationFn: async (interestId: number) => {
      const response = await fetch(`/api/user/interests/${interestId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove interest');
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetchInterests();
      toast({
        title: "Interés eliminado",
        description: "El interés ha sido eliminado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el interés",
        variant: "destructive",
      });
    },
  });

  // Manejar actualización de perfil
  const handleUpdateProfile = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      // Si hay un archivo de avatar, usar FormData
      if (avatarFile) {
        const formData = new FormData();
        formData.append('profileImage', avatarFile);
        formData.append('name', editForm.name);
        formData.append('bio', editForm.bio);
        formData.append('gender', editForm.gender);
        
        updateUserMutation.mutate(formData);
      } else {
        // Si no hay imagen, usar JSON normal
        updateUserMutation.mutate({
          name: editForm.name,
          bio: editForm.bio,
          gender: editForm.gender,
        });
      }
      
      setIsEditDialogOpen(false);
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (error) {
      console.error("Profile update error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo actualizar el perfil",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar añadir interés
  const handleAddInterest = async () => {
    if (!selectedInterest) return;
    addInterestMutation.mutate(selectedInterest);
  };

  // Manejar eliminar interés
  const handleRemoveInterest = (interestId: number) => {
    removeInterestMutation.mutate(interestId);
  };

  // Función para obtener colores de categorías
  const getCategoryColor = (category: string) => {
    const categoryColors: { [key: string]: string } = {
      social: 'bg-blue-100 text-blue-600',
      music: 'bg-purple-100 text-purple-600',
      spiritual: 'bg-indigo-100 text-indigo-600',
      education: 'bg-emerald-100 text-emerald-600',
      sports: 'bg-orange-100 text-orange-600',
      food: 'bg-red-100 text-red-600',
      art: 'bg-pink-100 text-pink-600',
      technology: 'bg-cyan-100 text-cyan-600',
      games: 'bg-yellow-100 text-yellow-600',
      outdoor: 'bg-green-100 text-green-600',
      networking: 'bg-violet-100 text-violet-600',
      workshop: 'bg-amber-100 text-amber-600',
      conference: 'bg-slate-100 text-slate-600',
      party: 'bg-fuchsia-100 text-fuchsia-600',
      fair: 'bg-lime-100 text-lime-600',
      exhibition: 'bg-rose-100 text-rose-600',
    };
    
    return categoryColors[category] || 'bg-gray-100 text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="bg-white flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="bg-neutral-50 flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b border-neutral-200 sticky top-0 z-50">
        <h1 className="text-xl font-bold">Mi Perfil</h1>
      </div>

      {/* Profile Content - Importante: contenedor con scroll */}
      <div className="flex-1 overflow-y-auto pb-36" style={{WebkitOverflowScrolling: 'touch'}}>
        {/* User Info Card */}
        <div className="p-4">
          <Card className="bg-white shadow-sm overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-primary-500 to-primary-400"></div>
            <CardContent className="pt-0 relative p-4">
              <div className="absolute -top-10 left-4">
                <div className="relative group">
                  <Avatar className="h-20 w-20 border-4 border-white rounded-full shadow-md overflow-hidden">
                    <img 
                      src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&size=80&background=random`} 
                      alt={user?.name || "Perfil"} 
                      className="h-full w-full object-cover"
                    />
                  </Avatar>
                  <div 
                    className="absolute inset-0 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                    onClick={() => setIsEditDialogOpen(true)}
                  >
                    <Camera size={20} className="text-white" />
                  </div>
                </div>
              </div>
              
              <div className="mt-14 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{user?.name}</h2>
                  <p className="text-neutral-500">@{user?.username}</p>
                  <p className="text-neutral-600 mt-2">{user?.bio || "Añade una bio para que otros conozcan más sobre ti"}</p>
                  <div className="mt-2 flex items-center">
                    <span className="text-sm text-primary font-medium mr-1">{attendingEvents.length}</span>
                    <span className="text-sm text-neutral-600">Eventos Asistidos</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-1 bg-primary-50 hover:bg-primary-100 text-primary-600"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Edit size={16} />
                  <span>Editar</span>
                </Button>
              </div>

              {/* Interest Tags */}
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-sm">Intereses</h3>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setIsInterestsDialogOpen(true)}
                  >
                    + Añadir
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {userInterests.map((interest: any) => (
                    <span 
                      key={interest.id} 
                      className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer flex items-center ${getCategoryColor(interest.category)}`}
                      onClick={() => handleRemoveInterest(interest.id)}
                    >
                      {formatCategory(interest.category)}
                      <X size={12} className="ml-1" />
                    </span>
                  ))}
                  {userInterests.length === 0 && (
                    <span className="text-neutral-500 text-sm">No hay intereses añadidos</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        

        {/* Action Buttons - Con Tickets, Configuración y Cerrar Sesión */}
        <div className="px-4 space-y-2 mt-2 mb-24">
          <Button
            variant="outline"
            className="w-full justify-start px-4 py-2 text-left bg-white shadow-sm border border-neutral-200"
            onClick={() => navigate("/my-events?tab=created")}
          >
            <Calendar size={18} className="mr-2 text-primary" />
            <span>Mis Eventos</span>
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start px-4 py-2 text-left bg-white shadow-sm border border-neutral-200"
            onClick={() => navigate("/tickets")}
          >
            <Ticket size={18} className="mr-2 text-green-600" />
            <span>Mis Tickets</span>
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start px-4 py-2 text-left bg-white shadow-sm border border-neutral-200"
            onClick={() => navigate("/settings")}
          >
            <Settings size={18} className="mr-2 text-neutral-600" />
            <span>Configuraciones</span>
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start px-4 py-2 text-left text-red-500 bg-white shadow-sm border border-neutral-200"
            onClick={handleLogout}
          >
            <LogOut size={18} className="mr-2" />
            <span>Cerrar Sesión</span>
          </Button>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Avatar upload section */}
            <div className="flex flex-col items-center gap-3 mb-2">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <img 
                    src={avatarPreview || user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&size=80&background=random`} 
                    alt={user?.name || "Perfil"} 
                    className="object-cover"
                  />
                </Avatar>
                <label 
                  htmlFor="avatar-upload" 
                  className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1 cursor-pointer"
                >
                  <Camera size={16} />
                </label>
                <input 
                  type="file" 
                  id="avatar-upload" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
              <span className="text-sm text-neutral-500">Haz clic para cambiar tu foto</span>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bio">Biografía</Label>
              <Textarea
                id="bio"
                rows={3}
                value={editForm.bio || ""}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                placeholder="Cuéntanos un poco sobre ti..."
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="gender">Género</Label>
              <Select 
                value={editForm.gender} 
                onValueChange={(value) => setEditForm({ ...editForm, gender: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona tu género" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button 
              onClick={handleUpdateProfile} 
              disabled={isSubmitting || !editForm.name.trim()}
            >
              {isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Interest Sheet - Compact like notifications */}
      {isInterestsDialogOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsInterestsDialogOpen(false)}
        >
          <div 
            className="absolute right-4 top-20 w-80 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <h3 className="font-semibold text-gray-800">Añadir Interés</h3>
                </div>
                <button 
                  onClick={() => setIsInterestsDialogOpen(false)}
                  className="p-1 hover:bg-white/60 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Elige una categoría que te interese
              </p>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              <Select value={selectedInterest} onValueChange={setSelectedInterest}>
                <SelectTrigger className="w-full h-10 bg-white border border-gray-200 hover:border-blue-300 transition-colors">
                  <SelectValue placeholder="🎯 Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent className="max-h-48 z-[60]">
                  {EVENT_CATEGORIES.filter(category => 
                    !userInterests.some((interest: any) => interest.category === category)
                  ).map((category) => {
                    const categoryEmojis: { [key: string]: string } = {
                      social: '👥', music: '🎵', spiritual: '🙏', education: '📚',
                      sports: '⚽', food: '🍕', art: '🎨', technology: '💻',
                      games: '🎮', outdoor: '🌲', networking: '🤝', workshop: '🔧',
                      conference: '🎤', party: '🎉', fair: '🎪', exhibition: '🖼️'
                    };
                    
                    return (
                      <SelectItem 
                        key={category} 
                        value={category}
                        className="py-2 hover:bg-blue-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{categoryEmojis[category] || '📌'}</span>
                          <span className="text-sm">{formatCategory(category)}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              {selectedInterest && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 text-green-700">
                    <Check className="w-3 h-3" />
                    <span className="text-xs font-medium">
                      {formatCategory(selectedInterest)} seleccionado
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex gap-2">
              <button 
                onClick={() => setIsInterestsDialogOpen(false)}
                className="flex-1 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddInterest} 
                disabled={!selectedInterest || addInterestMutation.isPending}
                className="flex-1 px-3 py-2 text-sm text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {addInterestMutation.isPending ? (
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    <span>Añadiendo...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-3 h-3" />
                    <span>Añadir</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Profile;