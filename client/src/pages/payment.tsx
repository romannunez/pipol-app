import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import LoadingSpinner from "@/components/ui/loading-spinner";

// Payment page - Ahora redirecciona al inicio y muestra un mensaje
export default function PaymentPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  // Cuando el componente se monta, redirigir al inicio y mostrar mensaje
  useEffect(() => {
    toast({
      title: "Funcionalidad de pagos desactivada",
      description: "Los pagos no están disponibles actualmente. Todos los eventos son gratuitos.",
      variant: "destructive",
    });
    
    navigate("/");
  }, [navigate, toast]);
  
  return (
    <div className="flex items-center justify-center h-screen">
      <LoadingSpinner size="xl" />
    </div>
  );
}