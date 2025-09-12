import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { ComponentType, ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/ui/loading-spinner';

// For routes with component prop (Wouter style)
type ProtectedRouteComponentProps = {
  component: ComponentType<any>;
  path?: string;
  [key: string]: any;
};

// For routes with children prop (children wrapper style)
type ProtectedRouteChildrenProps = {
  children: ReactNode;
};

type ProtectedRouteProps = ProtectedRouteComponentProps | ProtectedRouteChildrenProps;

/**
 * ProtectedRoute Component
 * 
 * Wraps routes that should only be accessible to authenticated users.
 * Redirects to the login page if the user is not authenticated.
 * 
 * Works with both Wouter's component pattern and children pattern.
 */
export function ProtectedRoute(props: ProtectedRouteProps) {
  const { user, isLoading, isLoggedIn } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    // If authentication check is complete and user is not logged in
    if (!isLoading && !isLoggedIn) {
      console.log('Access denied: Redirecting to login');
      // Small delay to prevent flash
      setTimeout(() => {
        setLocation('/auth');
      }, 50);
    }
  }, [isLoading, isLoggedIn, setLocation]);

  // Show loading state while checking authentication - Simplified
  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-neutral-500">
          Verificando sesión...
        </p>
      </div>
    );
  }

  // Don't render anything if not authenticated (during redirect)
  if (!isLoggedIn || !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-sm text-neutral-500">Redirigiendo...</div>
        </div>
      </div>
    );
  }

  // Check which pattern we're using (component or children)
  if ('component' in props) {
    const { component: Component, ...rest } = props;
    return <Component {...rest} />;
  } else {
    // Children pattern
    return <>{props.children}</>;
  }
}