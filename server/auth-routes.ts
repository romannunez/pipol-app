import express, { Request, Response } from 'express';
import { loginUserSchema, insertUserSchema } from '@shared/schema';
// import { registerUser, loginUser, logoutUser, getCurrentUser, isAuthenticatedMiddleware } from './supabase-auth';

// Temporary auth functions for local development
const registerUser = async () => ({ success: false, message: "Auth disabled for local dev" });
const loginUser = async () => ({ success: false, message: "Auth disabled for local dev" });
const logoutUser = async () => ({ success: true });
const getCurrentUser = async () => null;
const isAuthenticatedMiddleware = (req: any, res: any, next: any) => { next(); };

const router = express.Router();

/**
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    console.log("Registration attempt with data:", { 
      email: req.body.email,
      username: req.body.username,
      name: req.body.name
    });
    
    // Validate all input data
    const validationResult = insertUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      
      return res.status(400).json({ 
        message: `Invalid input data: ${errorMessage}` 
      });
    }

    const { email, password, username, name } = validationResult.data;
    
    // Register user with Supabase
    const newUser = await registerUser(email, password, username, name);
    
    // Return success with user data and token
    return res.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        name: newUser.name
      }
    });
  } catch (error: any) {
    console.error("Error during registration:", error);
    
    // Handle specific Supabase errors
    if (error.message.includes('email already exists')) {
      return res.status(400).json({ message: "Email already in use" });
    }
    
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    console.log("Login attempt with email:", req.body.email);
    
    // Validate login data
    const validationResult = loginUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Invalid login data" 
      });
    }
    
    const { email, password } = validationResult.data;
    
    // Login with Supabase
    const { user, session } = await loginUser(email, password);
    
    // Store user in session for session-based authentication
    if (req.session) {
      (req.session as any).userId = user.id.toString();
      (req.session as any).userEmail = user.email;
      (req.session as any).authenticated = true;
      (req.session as any).supabaseUserId = session.user?.id;
      console.log(`Session stored for user ${user.id} (${user.email})`);
    }
    
    // Return success with user data and token
    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name
      },
      token: session.access_token,
      refresh_token: session.refresh_token
    });
  } catch (error: any) {
    console.error("Error during login:", error);
    
    // Handle specific Supabase errors
    if (error.message.includes('Invalid login credentials')) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Logout user
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({ message: "Logout successful" });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Logout from Supabase
    await logoutUser(token || '');
    
    // Return success
    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get current user
 */
router.get('/me', isAuthenticatedMiddleware, (req: Request, res: Response) => {
  // User will be set by the middleware
  return res.status(200).json({
    user: req.user
  });
});

/**
 * Refresh authentication token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // For now, return a simple response indicating refresh is not needed
    // as we're handling session persistence differently
    return res.status(200).json({
      message: "Session management handled client-side"
    });
  } catch (error) {
    console.error("Error in refresh endpoint:", error);
    return res.status(401).json({ message: "Token refresh failed" });
  }
});

/**
 * Check auth status
 */
router.get('/session', async (req: Request, res: Response) => {
  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({ 
        authenticated: false 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Get current user
    const user = await getCurrentUser(token || '');
    
    return res.status(200).json({
      authenticated: !!user,
      user: user || null
    });
  } catch (error) {
    console.error("Error checking session:", error);
    return res.status(200).json({ authenticated: false });
  }
});

export { router as authRoutes };