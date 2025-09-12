/**
 * Token Management Utility
 * Provides centralized token storage and retrieval with error handling
 */

export class TokenManager {
  private static readonly TOKEN_KEY = 'pipol_auth_token';
  private static readonly USER_KEY = 'pipol_user_data';

  static setToken(token: string): void {
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
      console.log('Token stored successfully');
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  static getToken(): string | null {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      console.log('Token retrieved:', token ? `exists (${token.substring(0, 20)}...)` : 'not found');
      return token;
    } catch (error) {
      console.error('Failed to retrieve token:', error);
      return null;
    }
  }

  static setUser(user: any): void {
    try {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      console.log('User data stored successfully');
    } catch (error) {
      console.error('Failed to store user data:', error);
    }
  }

  static getUser(): any | null {
    try {
      const userData = localStorage.getItem(this.USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Failed to retrieve user data:', error);
      return null;
    }
  }

  static removeToken(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      console.log('Token removed successfully');
    } catch (error) {
      console.error('Failed to remove token:', error);
    }
  }

  static clearAuth(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      console.log('Authentication data cleared');
    } catch (error) {
      console.error('Failed to clear authentication data:', error);
    }
  }

  static hasValidToken(): boolean {
    const token = this.getToken();
    return !!token && token.length > 0;
  }

  static createAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }
}