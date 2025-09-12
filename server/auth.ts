import { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "./supabase-client";
import { storage } from "./storage";
import { type User as SchemaUser } from "@shared/schema";

// Declare types for Express
declare global {
  namespace Express {
    interface User extends Omit<SchemaUser, 'password'> {}
    
    // Add user property to Request
    interface Request {
      user?: User;
    }
  }
}

// Middleware to check if the user is authenticated using either Supabase JWT or session
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // First, check if there's already a user in the session (legacy auth)
    if ((req as any).user && typeof (req as any).user === 'object') {
      req.user = (req as any).user;
      return next();
    }
    
    // Check for session-based auth first (passport/express-session)
    if ((req as any).session && (req as any).session.passport && (req as any).session.passport.user) {
      try {
        const userId = (req as any).session.passport.user;
        const dbUser = await storage.getUserById(userId);
        if (dbUser) {
          req.user = dbUser;
          return next();
        }
      } catch (sessionError) {
        console.log('Session auth failed:', sessionError);
      }
    }
    
    // Fall back to JWT token verification
    const authHeader = req.headers.authorization;
    const token = authHeader?.split('Bearer ')[1];
    
    if (!token) {
      // No token present, user is not authenticated
      req.user = undefined;
      return next();
    }
    
    // Debug token verification
    console.log(`Verifying token for ${req.method} ${req.path}: ${token.substring(0, 20)}...`);
    
    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log('Token verification failed:', error?.message || 'User not found');
      
      // Try to refresh the session if the token is expired
      try {
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        if (session?.user && !refreshError) {
          console.log('Session refreshed successfully');
          // Get the user data from our database using the refreshed Supabase ID
          const dbUser = await storage.getUserBySupabaseId(session.user.id);
          if (dbUser) {
            req.user = dbUser;
            return next();
          }
        }
      } catch (refreshError) {
        console.log('Session refresh failed:', refreshError);
      }
      
      req.user = undefined;
      return next();
    }
    
    // Get the user data from our database using the Supabase ID
    const dbUser = await storage.getUserBySupabaseId(user.id);
    
    if (dbUser) {
      console.log(`Authentication successful for user: ${dbUser.email}`);
      req.user = dbUser;
    } else {
      console.log('User not found in database for Supabase ID:', user.id);
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    next(error);
  }
}

// Check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  // Log authentication status for debugging
  if (req.path.startsWith('/api/')) {
    console.log(`Auth check for ${req.method} ${req.path}: ${req.user ? 'Authenticated' : 'Not authenticated'}`);
  }
  
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  next();
}

export function setupAuth(app: Express) {
  console.log("Setting up authentication...");

  // Trust first proxy - needed for secure cookies behind a proxy/load balancer
  app.set("trust proxy", 1);
  
  // Add the authentication middleware to every request
  app.use(authMiddleware);
  
  // Middleware to check if a user is authenticated (for logging purposes)
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Log authentication status for debugging
    if (req.path.startsWith('/api/')) {
      console.log(`Auth check for ${req.method} ${req.path}: ${req.user ? 'Authenticated' : 'Not authenticated'}`);
    }
    next();
  });
  
  console.log("Authentication setup complete");
}