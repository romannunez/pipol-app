import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

// Simple in-memory session store for development
const sessionStore = new Map<string, {
  userId: number;
  email: string;
  authenticated: boolean;
  lastActivity: Date;
}>();

// No session timeout - sessions persist until manual logout
export function createSession(userId: number, email: string): string {
  const sessionId = Math.random().toString(36).substr(2, 9);
  sessionStore.set(sessionId, {
    userId,
    email,
    authenticated: true,
    lastActivity: new Date()
  });
  return sessionId;
}

export function getSession(sessionId: string) {
  const session = sessionStore.get(sessionId);
  if (!session) return null;
  
  // Update last activity but don't check for expiration
  session.lastActivity = new Date();
  sessionStore.set(sessionId, session);
  
  return session;
}

export function destroySession(sessionId: string) {
  sessionStore.delete(sessionId);
}

export async function sessionAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // First try session-based authentication
    const sessionId = req.headers['x-session-id'] as string;
    if (sessionId) {
      const session = getSession(sessionId);
      if (session) {
        // Temporarily skip database user lookup
        req.user = {
          id: session.userId,
          email: session.email,
          username: 'user',
          name: 'User',
          password: null,
          bio: null,
          avatar: null,
          supabaseId: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        return next();
      }
    }
    
    // If no session, continue to next middleware (token-based auth)
    next();
  } catch (error) {
    console.error('Session auth error:', error);
    next();
  }
}