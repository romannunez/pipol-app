import { supabase } from './supabase-client';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { getSession } from './session-auth';
import { users } from '@shared/schema';

// Extend Express Request to include user and session
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        name: string;
        bio: string | null;
        avatar: string | null;
        supabaseId: string | null;
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
    }
    interface Session {
      userId?: string;
      supabaseUserId?: string;
      authenticated?: boolean;
      userEmail?: string;
    }
    interface SessionData {
      userId?: string;
      supabaseUserId?: string;
      authenticated?: boolean;
      userEmail?: string;
    }
  }
}

/**
 * Middleware to check if the user is authenticated
 * Uses session-based authentication with token fallback
 */
export async function isAuthenticatedMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if user is already authenticated via the auth middleware
    if (req.user) {
      return next();
    }

    // Check express session-based authentication (passport style)
    if ((req as any).session && (req as any).session.passport && (req as any).session.passport.user) {
      try {
        const userId = (req as any).session.passport.user;
        // Temporarily skip database user lookup
        req.user = {
          id: userId,
          email: 'user@example.com',
          username: 'user',
          name: 'User',
          bio: null,
          avatar: null,
          supabaseId: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        console.log(`Session auth successful for user ${userId}`);
        return next();
      } catch (sessionError) {
        console.log('Session auth failed:', sessionError);
      }
    }

    // Check for session ID in cookies and find matching session
    if (req.cookies && req.cookies['connect.sid']) {
      try {
        // Session middleware should have already populated req.session
        // Let's check if there's session data available
        console.log('Checking session data:', {
          sessionExists: !!req.session,
          sessionId: req.sessionID,
          cookieExists: !!req.cookies['connect.sid'],
          passportSession: !!(req as any).session?.passport,
          passportUser: (req as any).session?.passport?.user,
          authenticated: (req.session as any)?.authenticated,
          userEmail: (req.session as any)?.userEmail,
          userId: (req.session as any)?.userId
        });
        
        // If session exists but no passport data, check if we stored user info directly
        if (req.session && (req.session as any).userId) {
          const userId = (req.session as any).userId;
          const user = await storage.getUserById(parseInt(userId));
          if (user) {
            req.user = user;
            console.log(`✅ Direct session auth successful for user ${user.id} (${user.email})`);
            return next();
          }
        }
        
        // Check for authenticated session flag
        if (req.session && (req.session as any).authenticated && (req.session as any).userEmail) {
          const user = await storage.getUserByEmail((req.session as any).userEmail);
          if (user) {
            req.user = user;
            console.log(`✅ Session email auth successful for user ${user.id} (${user.email})`);
            return next();
          }
        }
      } catch (sessionError) {
        console.log('Cookie session check failed:', sessionError);
      }
    }

    // Check cookie-based session
    const sessionCookie = req.cookies?.pipol_session;
    if (sessionCookie) {
      const session = getSession(sessionCookie);
      if (session) {
        const sessionUser = await storage.getUserByEmail(session.email);
        if (sessionUser) {
          req.user = sessionUser;
          return next();
        }
      }
    }

    // Then check express session-based authentication
    if (req.session && (req.session as any).authenticated && (req.session as any).userEmail) {
      const user = await storage.getUserByEmail((req.session as any).userEmail);
      if (user) {
        req.user = user;
        return next();
      }
    }
    
    // Fall back to token-based authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      console.error('Auth error:', error);
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Get the user from the database
    const user = await storage.getUserByEmail(data.user.email || '');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Store in session for future requests
    if (req.session) {
      (req.session as any).authenticated = true;
      (req.session as any).userEmail = user.email;
      (req.session as any).userId = user.id.toString();
      (req.session as any).supabaseUserId = data.user.id;
    }
    
    // Set user on request object
    req.user = user;
    
    next();
  } catch (err) {
    console.error('Error in auth middleware:', err);
    return res.status(401).json({ message: 'Authentication required' });
  }
}

/**
 * Register a new user
 */
export async function registerUser(email: string, password: string | null, username: string, name: string) {
  try {
    // Create user in Supabase Auth
    // Ensure we have a valid password
    if (!password) {
      throw new Error("Password is required");
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (authError) {
      console.error('Error creating user in Supabase Auth:', authError);
      throw new Error(authError.message);
    }
    
    if (!authData.user) {
      throw new Error('Failed to create user');
    }
    
    // Create user in our database
    const newUser = await storage.insertUser({
      email,
      username,
      password: 'supabase-auth', // We don't store passwords anymore
      name,
      supabaseId: authData.user.id,
    });
    
    return newUser;
  } catch (error) {
    console.error('Error in registerUser:', error);
    throw error;
  }
}

/**
 * Login a user
 */
export async function loginUser(email: string, password: string | null) {
  try {
    // Ensure we have a valid password
    if (!password) {
      throw new Error("Password is required");
    }
    
    // Login with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Error logging in with Supabase Auth:', error);
      throw new Error(error.message);
    }
    
    if (!data.user) {
      throw new Error('Failed to login');
    }
    
    // Get user from database
    const user = await storage.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found in database');
    }
    
    return {
      user,
      session: data.session,
    };
  } catch (error) {
    console.error('Error in loginUser:', error);
    throw error;
  }
}

/**
 * Logout a user
 */
export async function logoutUser(token: string) {
  try {
    const { error } = await supabase.auth.signOut({
      scope: 'local'
    });
    
    if (error) {
      console.error('Error logging out with Supabase Auth:', error);
      throw new Error(error.message);
    }
    
    return true;
  } catch (error) {
    console.error('Error in logoutUser:', error);
    throw error;
  }
}

/**
 * Get the current user
 */
export async function getCurrentUser(token: string) {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return null;
    }
    
    // Get user from database
    const user = await storage.getUserByEmail(data.user.email || '');
    return user;
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
}