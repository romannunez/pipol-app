import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { motion, AnimatePresence } from "framer-motion";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import MyEvents from "@/pages/my-events";
import Messages from "@/pages/messages";
import Profile from "@/pages/profile";
import Payment from "@/pages/payment";
import AuthPage from "@/pages/auth";
import AuthTest from "@/pages/auth-test";
import Tickets from "@/pages/tickets";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { NavigationProvider } from "@/contexts/navigation-context";
import { UserProfileProvider } from "@/contexts/user-profile-context";
import { ZIndexProvider } from "@/contexts/z-index-context";
import { MapProvider } from "@/contexts/MapContext";
import UserProfilePanel from "@/components/users/user-profile-panel";

// Import components
import EditEventPage from "@/pages/edit-event";
import TestEditPanel from "@/pages/test-edit-panel";

// Page transition variants - Volver a anterior pero mejorado
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  in: {
    opacity: 1,
    y: 0,
    scale: 1
  },
  out: {
    opacity: 0,
    y: -20,
    scale: 1.05
  }
};

const pageTransition = {
  type: "tween",
  ease: "easeInOut", 
  duration: 0.3
};

// Animated page wrapper - Forzar estado inicial invisible
function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      key={`page-${Date.now()}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 1.05 }}
      transition={{
        type: "tween",
        ease: "easeInOut",
        duration: 0.3
      }}
      className="w-full h-full min-h-screen bg-white"
    >
      {children}
    </motion.div>
  );
}

function Router() {
  const [location] = useLocation();
  
  return (
    <div className="min-h-screen bg-white">
      <AnimatePresence mode="wait" initial={false}>
        <Switch key={location}>
        <Route path="/">
          <ProtectedRoute>
            <AnimatedPage>
              <Home />
            </AnimatedPage>
          </ProtectedRoute>
        </Route>
        <Route path="/tickets">
          <ProtectedRoute>
            <AnimatedPage>
              <Tickets />
            </AnimatedPage>
          </ProtectedRoute>
        </Route>
        <Route path="/my-events">
          <ProtectedRoute>
            <AnimatedPage>
              <MyEvents />
            </AnimatedPage>
          </ProtectedRoute>
        </Route>
        <Route path="/my-events/:eventId/edit">
          <ProtectedRoute>
            <AnimatedPage>
              <EditEventPage />
            </AnimatedPage>
          </ProtectedRoute>
        </Route>
        <Route path="/test-edit-panel">
          <ProtectedRoute>
            <AnimatedPage>
              <TestEditPanel />
            </AnimatedPage>
          </ProtectedRoute>
        </Route>
        <Route path="/messages">
          <ProtectedRoute>
            <AnimatedPage>
              <Messages />
            </AnimatedPage>
          </ProtectedRoute>
        </Route>
        <Route path="/profile">
          <ProtectedRoute>
            <AnimatedPage>
              <Profile />
            </AnimatedPage>
          </ProtectedRoute>
        </Route>
        <Route path="/payment/:eventId">
          <ProtectedRoute>
            <AnimatedPage>
              <Payment />
            </AnimatedPage>
          </ProtectedRoute>
        </Route>
        <Route path="/auth">
          <AnimatedPage>
            <AuthPage />
          </AnimatedPage>
        </Route>
        <Route path="/auth-test">
          <AnimatedPage>
            <AuthTest />
          </AnimatedPage>
        </Route>
        <Route path="/login">
          {() => {
            window.location.replace("/auth");
            return null;
          }}
        </Route>
        <Route>
          <AnimatedPage>
            <NotFound />
          </AnimatedPage>
        </Route>
      </Switch>
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ZIndexProvider>
          <MapProvider>
            <NavigationProvider>
              <UserProfileProvider>
                <Router />
                <UserProfilePanel />
                <Toaster />
              </UserProfileProvider>
            </NavigationProvider>
          </MapProvider>
        </ZIndexProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
