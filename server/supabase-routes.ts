import { Router, Request, Response } from 'express';
import { supabase } from './supabase-client';
import { storage } from './storage';
import { isAuthenticatedMiddleware as requireAuth } from './supabase-auth';
import { createSession, destroySession } from './session-auth';
import { z } from 'zod';
import { loginUserSchema, insertUserSchema } from '@shared/schema';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Register endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, username, name } = req.body;
    
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Supabase will handle email uniqueness, skip database checks for now

    // Create user in Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error('Supabase auth error during registration:', authError);
      return res.status(400).json({ message: authError.message });
    }

    if (!authData.user) {
      return res.status(500).json({ message: 'Failed to create user in Supabase' });
    }

    // Create user in our database with Supabase ID
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .insert([{
        email: authData.user.email || email,
        username: username,
        name: name,
        supabase_id: authData.user.id,
        password: null, // Not needed for Supabase auth
        bio: null,
        avatar: null,
        stripe_customer_id: null,
        stripe_subscription_id: null
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Database user creation error:', dbError);
      // Continue with Supabase user data even if DB insert fails
    }

    const newUser = dbUser || {
      id: parseInt(authData.user.id.slice(-8), 16) % 100000,
      email: authData.user.email || email,
      username: username,
      name: name,
      supabaseId: authData.user.id,
    };

    // Return user data and session
    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        name: newUser.name,
      },
      session: authData.session
    });
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Supabase auth error during login:', error);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!data.session || !data.user) {
      return res.status(401).json({ message: 'Authentication failed' });
    }

    // Try to get user from our database first
    const { data: dbUser } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_id', data.user.id)
      .single();

    const user = dbUser || {
      id: parseInt(data.user.id.slice(-8), 16) % 100000,
      email: data.user.email || email,
      username: email.split('@')[0],
      name: email.split('@')[0],
      supabaseId: data.user.id,
    };

    // Create a session with simplified user data
    const sessionId = createSession(user.id, user.email);
    
    // Set session cookie that persists until manual logout
    res.cookie('pipol_session', sessionId, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      // No maxAge set - persists until manual logout
      sameSite: 'lax'
    });

    // IMPORTANT: Set the Express session data so authentication works for subsequent requests
    if (req.session) {
      (req.session as any).authenticated = true;
      (req.session as any).userEmail = user.email;
      (req.session as any).userId = user.id.toString();
      (req.session as any).supabaseUserId = data.user.id;
      (req.session as any).passport = { user: user.id }; // For compatibility with passport middleware
    }

    // Return user data and token
    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
      },
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      sessionId: sessionId
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // Clear session cookie
    const sessionCookie = req.cookies?.pipol_session;
    if (sessionCookie) {
      destroySession(sessionCookie);
      res.clearCookie('pipol_session');
    }

    // Clear express session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });
    }

    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error during Supabase logout:', error);
      return res.status(500).json({ message: error.message });
    }
    
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user endpoint - using token authentication
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Check Authorization header for Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Verify token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        // Try to get user from database
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('supabase_id', user.id)
          .single();
        
        if (dbUser) {
          return res.status(200).json({
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            name: dbUser.name,
            bio: dbUser.bio,
            avatar: dbUser.avatar
          });
        }
        
        // Return basic user info if not in database
        return res.status(200).json({
          id: parseInt(user.id.slice(-8), 16) % 100000,
          email: user.email,
          username: user.email?.split('@')[0] || 'user',
          name: user.email?.split('@')[0] || 'User',
          bio: null,
          avatar: null
        });
      }
    }
    
    // Check session-based auth as fallback
    if (req.session && (req.session as any).authenticated && (req.session as any).userId) {
      const userId = (req.session as any).userId;
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (dbUser) {
        return res.status(200).json({
          id: dbUser.id,
          email: dbUser.email,
          username: dbUser.username,
          name: dbUser.name,
          bio: dbUser.bio,
          avatar: dbUser.avatar
        });
      }
    }
    
    return res.status(401).json({ message: 'Authentication required' });
  } catch (error) {
    console.error('Error getting current user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});



const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'public/uploads/profiles';
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + extension);
  }
});

const profileUpload = multer({ 
  storage: profileStorage,
  fileFilter: (req, file, cb) => {
    // Only allow images for profile pictures
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for profile pictures'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Update user profile endpoint (with image support)
router.put('/update', requireAuth, profileUpload.single('profileImage'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const updateData = req.body;
    const userId = req.user.id;

    // Fix gender mapping from frontend values to database values
    if (updateData.gender) {
      const genderMapping: { [key: string]: string } = {
        'masculino': 'hombre',
        'femenino': 'mujer',
        'hombre': 'hombre', // already correct
        'mujer': 'mujer', // already correct
        'otro': 'otro',
        'no_especificar': 'no_especificar'
      };
      updateData.gender = genderMapping[updateData.gender] || updateData.gender;
    }

    // Handle profile image upload
    if (req.file) {
      // Create the URL for the uploaded file
      const imageUrl = `/uploads/profiles/${req.file.filename}`;
      updateData.avatar = imageUrl;
      
      // Clean up old profile image if it exists
      const existingUser = await storage.getUserById(userId);
      if (existingUser?.avatar && existingUser.avatar !== imageUrl) {
        const oldImagePath = path.join('public', existingUser.avatar);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    // Update user in database
    const updatedUser = await storage.updateUser(userId, updateData);
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ message: 'File upload error: ' + error.message });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user profile endpoint (original, for non-file updates)
router.put('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const updateData = req.body;
    const userId = req.user.id;

    // Fix gender mapping from frontend values to database values
    if (updateData.gender) {
      const genderMapping: { [key: string]: string } = {
        'masculino': 'hombre',
        'femenino': 'mujer',
        'hombre': 'hombre', // already correct
        'mujer': 'mujer', // already correct
        'otro': 'otro',
        'no_especificar': 'no_especificar'
      };
      updateData.gender = genderMapping[updateData.gender] || updateData.gender;
    }

    // Update user in database
    const updatedUser = await storage.updateUser(userId, updateData);
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }
    
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });
    
    if (error) {
      console.error('Error refreshing token:', error);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    
    if (!data.session) {
      return res.status(401).json({ message: 'Failed to refresh session' });
    }
    
    return res.status(200).json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export const supabaseRoutes = router;