import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Calendar,
  MessageSquare,
  User,
  Home,
  Ticket,
  Bell,
} from "lucide-react";
import { useNavigation } from "@/contexts/navigation-context";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import NotificationsPanel from "@/components/notifications/notifications-panel";

export function BottomNav() {
  const [location] = useLocation();
  const { isNavigationVisible } = useNavigation();
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Debug: log navigation visibility state
  console.log("🎯 BottomNav: isNavigationVisible =", isNavigationVisible);

  // Map routes to determine which tab is active
  const isTicketsActive = location.startsWith("/tickets");
  const isEventsActive = location.startsWith("/my-events");
  const isHomeActive = location === "/" || location.startsWith("/explore"); // Centro - Inicio
  const isChatsActive = location.startsWith("/messages");
  const isProfileActive = location.startsWith("/profile");

  // Fetch notification count periodically
  useEffect(() => {
    if (user) {
      const fetchNotificationCount = async () => {
        try {
          const response = await apiRequest("GET", "/api/notifications/count");
          if (response.ok) {
            const data = await response.json();
            setNotificationCount(data.count || 0);
          }
        } catch (error) {
          console.error("Error fetching notification count:", error);
        }
      };

      fetchNotificationCount();
      
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotificationCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <>
      <div 
        className={`fixed bottom-0 left-0 right-0 z-50 px-5 pb-[45px] transition-transform duration-200 ease-out ${!isNavigationVisible ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}
      >
        <div className="bg-white/2 backdrop-blur-lg rounded-[25px] shadow-lg shadow-black/15 mx-auto border border-gray-200/30">
          <div className="flex justify-around items-center px-2 py-1 h-[58px]">
          {/* Tickets */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Link
              href="/tickets"
              className="flex flex-col items-center py-2 px-3 min-w-0"
            >
              <motion.div
                animate={{ 
                  color: isTicketsActive ? "#eab308" : "#4b5563",
                  scale: isTicketsActive ? 1.1 : 1
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="p-1"
              >
                <Ticket size={20} />
              </motion.div>
              <motion.span
                animate={{ 
                  color: isTicketsActive ? "#eab308" : "#4b5563",
                  fontWeight: isTicketsActive ? 600 : 500
                }}
                transition={{ duration: 0.3 }}
                className="text-xs mt-1"
              >
                Tickets
              </motion.span>
            </Link>
          </motion.div>

          {/* Events */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Link
              href="/my-events"
              className="flex flex-col items-center py-2 px-3 min-w-0"
            >
              <motion.div
                animate={{ 
                  color: isEventsActive ? "#eab308" : "#4b5563",
                  scale: isEventsActive ? 1.1 : 1
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="p-1"
              >
                <Calendar size={20} />
              </motion.div>
              <motion.span
                animate={{ 
                  color: isEventsActive ? "#eab308" : "#4b5563",
                  fontWeight: isEventsActive ? 600 : 500
                }}
                transition={{ duration: 0.3 }}
                className="text-xs mt-1"
              >
                Eventos
              </motion.span>
            </Link>
          </motion.div>

          {/* Home - Centro (Inicio) - Always Yellow/Active like in the image */}
          <motion.div
            whileHover={{ scale: 1.15, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Link
              href="/"
              className="flex flex-col items-center py-2 px-3 min-w-0"
            >
              <motion.div 
                whileHover={{ 
                  boxShadow: "0 0 20px rgba(234, 179, 8, 0.6)",
                  scale: 1.05 
                }}
                transition={{ duration: 0.2 }}
                className="bg-yellow-500 rounded-full p-2"
              >
                <motion.div
                  animate={{ rotate: isHomeActive ? 0 : 0 }}
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                >
                  <Compass size={20} className="text-black" />
                </motion.div>
              </motion.div>
              <motion.span 
                animate={{ scale: isHomeActive ? 1.05 : 1 }}
                className="text-xs mt-1 text-yellow-500 font-semibold"
              >
                Inicio
              </motion.span>
            </Link>
          </motion.div>

          {/* Chats */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Link
              href="/messages"
              className="flex flex-col items-center py-2 px-3 min-w-0"
            >
              <motion.div
                animate={{ 
                  color: isChatsActive ? "#eab308" : "#4b5563",
                  scale: isChatsActive ? 1.1 : 1
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="p-1"
              >
                <MessageSquare size={20} />
              </motion.div>
              <motion.span
                animate={{ 
                  color: isChatsActive ? "#eab308" : "#4b5563",
                  fontWeight: isChatsActive ? 600 : 500
                }}
                transition={{ duration: 0.3 }}
                className="text-xs mt-1"
              >
                Chats
              </motion.span>
            </Link>
          </motion.div>

          {/* Profile */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Link
              href="/profile"
              className="flex flex-col items-center py-2 px-3 min-w-0"
            >
              <motion.div
                animate={{ 
                  color: isProfileActive ? "#eab308" : "#4b5563",
                  scale: isProfileActive ? 1.1 : 1
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="p-1"
              >
                <User size={20} />
              </motion.div>
              <motion.span
                animate={{ 
                  color: isProfileActive ? "#eab308" : "#4b5563",
                  fontWeight: isProfileActive ? 600 : 500
                }}
                transition={{ duration: 0.3 }}
                className="text-xs mt-1"
              >
                Perfil
              </motion.span>
            </Link>
          </motion.div>
          </div>
        </div>
      </div>
      
      {/* Notifications Panel */}
      <NotificationsPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />
    </>
  );
}

export default BottomNav;
