import { supabase } from './supabase-client';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  password: string;
  username: string;
  name: string;
}

interface User {
  id: number;
  email: string;
  username: string;
  name: string;
  avatar?: string;
}

// Service to handle authentication with Supabase
class AuthService {
  private user: User | null = null;
  private token: string | null = null;

  constructor() {
    // Initialize from localStorage
    this.loadSession();
  }

  // Load session from localStorage
  private loadSession() {
    try {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');
      
      if (storedUser && storedToken) {
        this.user = JSON.parse(storedUser);
        this.token = storedToken;
      }
    } catch (error) {
      console.error('Error loading session:', error);
      this.clearSession();
    }
  }

  // Save session to localStorage
  private saveSession(user: User, token: string) {
    this.user = user;
    this.token = token;
    
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
  }

  // Clear session from localStorage
  private clearSession() {
    this.user = null;
    this.token = null;
    
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }

  // Get current user
  getUser(): User | null {
    return this.user;
  }

  // Get auth token
  getToken(): string | null {
    return this.token;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.user && !!this.token;
  }

  // Register a new user
  async register(credentials: RegisterCredentials): Promise<User> {
    try {
      // Call API to register user
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      
      const data = await response.json();
      
      // Save user session
      this.saveSession(data.user, data.token);
      
      return data.user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Login user
  async login(credentials: LoginCredentials): Promise<User> {
    try {
      // Call API to login user
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }
      
      const data = await response.json();
      
      // Save user session
      this.saveSession(data.user, data.token);
      
      return data.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      // Call API to logout
      if (this.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        });
      }
      
      // Try to sign out from Supabase directly
      await supabase.auth.signOut();
      
      // Clear session
      this.clearSession();
    } catch (error) {
      console.error('Logout error:', error);
      // Clear session regardless of API error
      this.clearSession();
      throw error;
    }
  }

  // Get current user from API
  async fetchCurrentUser(): Promise<User | null> {
    try {
      if (!this.token) {
        console.log('No authenticated user found');
        return null;
      }
      
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });
      
      console.log('User fetch status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          console.log('No authenticated user found');
          this.clearSession();
          return null;
        }
        
        throw new Error('Failed to fetch user');
      }
      
      const user = await response.json();
      
      // Update stored user
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));
      
      return user;
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  }
}

// Create and export singleton instance
export const authService = new AuthService();

export default authService;