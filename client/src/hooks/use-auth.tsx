import { createContext, ReactNode, useContext, useState, useEffect } from 'react';
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from '@tanstack/react-query';
import { User } from '@shared/schema';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { TokenManager } from '@/lib/token-manager';

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  username: string;
  email: string;
  password: string;
  name: string;
};

type UpdateUserData = {
  name?: string;
  bio?: string;
  avatar?: string;
  gender?: string;
};

type UpdateUserFormData = UpdateUserData | FormData;

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  isLoggedIn: boolean;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  updateUserMutation: UseMutationResult<User, Error, UpdateUserFormData>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [hasStoredToken, setHasStoredToken] = useState(() => {
    return !!localStorage.getItem('pipol_auth_token');
  });

  // Fetch current user using session-based authentication
  const {
    data: user,
    error,
    isLoading,
    refetch: refetchUser
  } = useQuery({
    queryKey: ['user', 'current'],
    queryFn: async () => {
      try {
        console.log("Fetching current user...");
        
        // Use session-based authentication with credentials
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Requested-With': 'XMLHttpRequest'
          },
          cache: 'no-store'
        });
        
        console.log("User fetch status:", res.status);
        
        if (res.ok) {
          const userData = await res.json();
          console.log("Current user data:", userData);
          setHasStoredToken(true);
          return userData;
        }
        
        if (res.status === 401) {
          // Authentication failed, clear stored tokens
          console.log("Authentication failed, clearing tokens");
          localStorage.removeItem('pipol_auth_token');
          localStorage.removeItem('pipol_refresh_token');
          setHasStoredToken(false);
          return null;
        }
        
        console.error(`Authentication failed: ${res.status}`);
        setHasStoredToken(false);
        return null;
      } catch (error) {
        console.error('Error fetching user:', error);
        setHasStoredToken(false);
        return null;
      }
    },
    enabled: true,
    retry: false,
    retryDelay: 0,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    staleTime: 5000
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("Attempting login with:", credentials.email, "password length:", credentials.password.length);
      
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(credentials),
        });

        console.log("Login response status:", res.status);
        
        if (!res.ok) {
          const errorData = await res.json();
          console.log("Login error data:", errorData);
          throw new Error(errorData.message || 'Login failed');
        }

        const data = await res.json();
        console.log("Login success data:", data);
        
        // Store token if provided (for compatibility)
        if (data.token) {
          localStorage.setItem('pipol_auth_token', data.token);
          TokenManager.setToken(data.token);
        }
        
        // Store user data
        if (data.user) {
          localStorage.setItem('pipol_user_data', JSON.stringify(data.user));
        }
        
        setHasStoredToken(true);
        return data.user;
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      }
    },
    onSuccess: (userData: User) => {
      console.log("Login successful, user data:", userData);
      queryClient.setQueryData(['user', 'current'], userData);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.name}!`,
      });
      
      setLocation('/');
    },
    onError: (error: Error) => {
      console.error("Login failed:", error);
      toast({
        title: "Login failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      console.log("Attempting registration...");
      
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(userData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await res.json();
      
      // Store token if provided
      if (data.token) {
        localStorage.setItem('pipol_auth_token', data.token);
        TokenManager.setToken(data.token);
      }
      
      return data.user;
    },
    onSuccess: (userData: User) => {
      queryClient.setQueryData(['user', 'current'], userData);
      refetchUser();
      
      setLocation('/');
      
      toast({
        title: "Registration successful",
        description: `Welcome to Pipol, ${userData.name}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please try again with different credentials.",
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (updateData: UpdateUserFormData) => {
      // Check if it's FormData (file upload) or regular JSON
      const isFormData = updateData instanceof FormData;
      
      const fetchOptions: RequestInit = {
        method: 'PUT',
        credentials: 'include',
      };

      if (isFormData) {
        // For file uploads, don't set Content-Type, let browser set it with boundary
        fetchOptions.body = updateData;
      } else {
        // For regular updates
        fetchOptions.headers = {
          'Content-Type': 'application/json',
        };
        fetchOptions.body = JSON.stringify(updateData);
      }

      const res = await fetch('/api/auth/update', fetchOptions);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Update failed');
      }

      return res.json();
    },
    onSuccess: (updatedUser: User) => {
      queryClient.setQueryData(['user', 'current'], updatedUser);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        const res = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          console.log("Logout request failed, but continuing with cleanup");
        }
      } catch (error) {
        console.log("Logout request error, but continuing with cleanup:", error);
      }
      
      // Clear all stored data regardless of server response
      localStorage.removeItem('pipol_auth_token');
      localStorage.removeItem('pipol_refresh_token');
      localStorage.removeItem('pipol_user_data');
      TokenManager.removeToken();
    },
    onSuccess: () => {
      queryClient.setQueryData(['user', 'current'], null);
      queryClient.clear();
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      
      setLocation('/');
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message || "Failed to logout properly.",
        variant: "destructive",
      });
    },
  });

  // Derive isLoggedIn from user data
  const isLoggedIn = !!user && !isLoading;

  const value: AuthContextType = {
    user: user || null,
    isLoading,
    error: error as Error | null,
    isLoggedIn,
    loginMutation,
    logoutMutation,
    registerMutation,
    updateUserMutation,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}