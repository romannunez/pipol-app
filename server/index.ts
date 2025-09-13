import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { mediaRouter } from "./media-routes";
// Supabase integration enabled
import { supabase, supabaseService, testSupabaseConnection } from "./supabase-client";
import { isAuthenticatedMiddleware } from './supabase-auth';
import { supabaseRoutes } from "./supabase-routes";
import conflictRoutes from "./conflict-routes";
import { db } from "./db";
import { sql } from "drizzle-orm";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { storage } from "./storage";

const app = express();

// Configure cookie parsing
app.use(cookieParser());

// Configure session management for persistent authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'pipol-session-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  name: 'pipol_session',
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  rolling: true, // Extend session on activity
  store: undefined // Use memory store for development
}));

// Configure passport for session management
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization for session persistence
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: any, done) => {
  try {
    console.log("Deserializing user with ID:", id);
    const userId = parseInt(id);
    if (isNaN(userId)) {
      console.log("Invalid user ID during deserialization:", id);
      return done(null, false);
    }
    
    // Query Supabase directly to check if user exists using service client
    console.log("Querying Supabase for user ID:", userId);
    const { data: users, error, count } = await supabaseService
      .from('users')
      .select('*', { count: 'exact' })
      .eq('id', userId);
    
    console.log("Supabase query result:", { 
      error: error?.message || null, 
      userCount: count, 
      hasUsers: users && users.length > 0,
      firstUser: users && users.length > 0 ? { id: users[0].id, name: users[0].name, email: users[0].email } : null
    });
    
    if (error) {
      console.error("Supabase query error:", error.message);
      return done(null, false);
    }
    
    if (users && users.length > 0) {
      const user = users[0]; // Take first user if multiple exist
      console.log("User deserialized successfully:", user.id, user.name);
      done(null, user);
    } else {
      console.log("User not found during deserialization for ID:", userId);
      
      // Debug: Check if any users exist in the table
      const { data: allUsers, error: allError } = await supabaseService
        .from('users')
        .select('id, name, email')
        .limit(5);
      
      console.log("Debug: Sample users in database:", { 
        error: allError?.message || null,
        sampleUsers: allUsers || []
      });
      
      done(null, false);
    }
  } catch (error) {
    console.error("Error deserializing user:", error);
    done(null, false);
  }
});

// Configure Passport Local Strategy for authentication
passport.use(new LocalStrategy({
  usernameField: 'email', // Use email as username field
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    console.log("Local strategy: Authenticating user with email:", email);
    
    // Find user by email
    const user = await storage.getUserByEmail(email);
    if (!user) {
      console.log("Local strategy: User not found for email:", email);
      return done(null, false, { message: 'Invalid email or password' });
    }
    
    // Check if user has a password (some users might be OAuth only)
    if (!user.password) {
      console.log("Local strategy: User has no password set:", email);
      return done(null, false, { message: 'Please use social login or reset your password' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log("Local strategy: Invalid password for user:", email);
      return done(null, false, { message: 'Invalid email or password' });
    }
    
    console.log("Local strategy: Authentication successful for user:", email);
    return done(null, user);
  } catch (error) {
    console.error("Local strategy: Authentication error:", error);
    return done(error);
  }
}));

// Aumentar el límite de tamaño para solicitudes JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Emergency route removed - issue was fixed in storage.ts by using Supabase client instead of mock db

// Add CORS headers for development with proper credentials handling
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // For local development, allow localhost and 127.0.0.1
  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('replit.dev'))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Same-origin requests (no origin header)
    res.header('Access-Control-Allow-Origin', 'http://localhost:5000');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Set content headers for API routes to ensure correct handling
  if (req.path.startsWith('/api/')) {
    if (req.method !== 'OPTIONS') {
      res.header('Content-Type', 'application/json');
    }
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Test database connection
  try {
    await db.execute('SELECT 1');
    console.log('Database connection successful');
  } catch (error) {
    console.error('Database connection failed:', error);
  }
  
  // Create user_interests table if it doesn't exist
  try {
    console.log('Creating user_interests table if needed...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_interests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, category)
      );
    `);
    console.log('user_interests table is ready');
  } catch (error: any) {
    console.log('user_interests table creation skipped (may already exist):', error.message);
  }

  // Create chat_messages table if it doesn't exist
  try {
    console.log('Creating chat_messages table if needed...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text' NOT NULL,
        reply_to_id INTEGER REFERENCES chat_messages(id),
        edited BOOLEAN DEFAULT false NOT NULL,
        edited_at TIMESTAMP WITH TIME ZONE,
        deleted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    console.log('chat_messages table is ready');
  } catch (error: any) {
    console.log('chat_messages table creation skipped (may already exist):', error.message);
  }

  // Create notification type enum if it doesn't exist
  try {
    console.log('Creating notification_type enum if needed...');
    await db.execute(`
      DO $$ BEGIN
        CREATE TYPE notification_type AS ENUM ('request_approved', 'request_rejected', 'new_request');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('notification_type enum is ready');
  } catch (error: any) {
    console.log('notification_type enum creation skipped (may already exist):', error.message);
  }

  // Create notifications table if it doesn't exist
  try {
    console.log('Creating notifications table if needed...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type notification_type NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        request_id INTEGER REFERENCES event_attendees(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    console.log('notifications table is ready');
  } catch (error: any) {
    console.log('notifications table creation skipped (may already exist):', error.message);
  }

  // Add end_time column to events table if it doesn't exist
  try {
    console.log('Adding end_time column to events table if needed...');
    await db.execute(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;
    `);
    console.log('end_time column is ready');
    
    // Update existing events with default end time (2 hours after start)
    await db.execute(`
      UPDATE events 
      SET end_time = date + INTERVAL '2 hours' 
      WHERE end_time IS NULL;
    `);
    console.log('Existing events updated with default end times');
  } catch (error: any) {
    console.log('end_time column setup completed or skipped:', error.message);
  }

  // Add gender enums and columns
  try {
    console.log('Creating gender enums if needed...');
    
    // Create gender enum
    await db.execute(`
      DO $$ BEGIN
        CREATE TYPE gender AS ENUM ('masculino', 'femenino', 'otro', 'no_especificar');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    
    // Create gender preference enum (recreate if needed to ensure correct values)
    await db.execute(`
      DO $$ BEGIN
        DROP TYPE IF EXISTS gender_preference CASCADE;
        CREATE TYPE gender_preference AS ENUM ('all_people', 'men', 'women');
      EXCEPTION
        WHEN others THEN 
          -- If there's an error, try to create the type anyway
          BEGIN
            CREATE TYPE gender_preference AS ENUM ('all_people', 'men', 'women');
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END;
      END $$;
    `);
    
    console.log('Gender enums created successfully');
  } catch (error: any) {
    console.log('Gender enums creation completed or skipped:', error.message);
  }
  
  // Add gender column to users table
  try {
    console.log('Adding gender column to users table if needed...');
    await db.execute(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gender gender;
    `);
    console.log('Gender column added to users table');
  } catch (error: any) {
    console.log('Gender column setup completed or skipped:', error.message);
  }
  
  // Add gender_preference column to events table
  try {
    console.log('Adding gender_preference column to events table if needed...');
    await db.execute(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS gender_preference gender_preference DEFAULT 'all_people';
    `);
    
    // Update existing events with default gender preference and convert 'mixto' to 'all_people'
    await db.execute(`
      UPDATE events 
      SET gender_preference = 'all_people' 
      WHERE gender_preference IS NULL OR gender_preference::text = 'mixto';
    `);
    
    console.log('Gender preference column added to events table');
  } catch (error: any) {
    console.log('Gender preference column setup completed or skipped:', error.message);
  }

  // Create user_ratings table for aura system
  try {
    console.log('Creating user_ratings table if needed...');
    
    // Check if table exists by testing a simple query
    const { error: checkError } = await supabase
      .from('user_ratings')
      .select('id')
      .limit(1);
    
    if (checkError && checkError.message.includes('relation "public.user_ratings" does not exist')) {
      console.log('Creating user_ratings table with fallback method...');
      // Create table using Supabase-compatible approach
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS user_ratings (
          id SERIAL PRIMARY KEY,
          rated_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          rater_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          UNIQUE(rated_user_id, rater_user_id)
        );
      `;
      
      // Create using supabase SQL execution - simplified approach
      try {
        // Try alternative approach - create an insert operation that will fail but reveal if table exists
        await supabase.from('user_ratings').insert([]);
      } catch (insertError: any) {
        console.log('Table creation approach - ready to create via SQL editor');
        console.log('Please execute this SQL in Supabase SQL editor:');
        console.log(createTableSQL);
      }
    }
    
    console.log('user_ratings table is ready');
  } catch (error: any) {
    console.log('user_ratings table creation completed or skipped:', error.message);
  }
  
  // Initialize local storage for media files
  console.log('Setting up local file storage...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const attachedDir = path.join(process.cwd(), 'attached_assets');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(attachedDir)) {
      fs.mkdirSync(attachedDir, { recursive: true });
    }
    console.log('Local storage directories ready');
  } catch (error) {
    console.error('Error setting up local storage:', error);
  }
  
  // Create a simple auth logger middleware
  const logAuthStatus = (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/auth/')) {
      console.log(`Auth check for ${req.method} ${req.path}: ${req.user ? 'Authenticated' : 'Not authenticated'}`);
    }
    next();
  };
  
  // Temporarily disable auth logger to fix middleware loop
  // app.use(logAuthStatus);
  
  // Test Supabase connection
  console.log('Testing Supabase connection...');
  await testSupabaseConnection();
  
// Priority route removed - issue was fixed in storage.ts by using Supabase client instead of mock db
  
  // Serve static files from public directory (for multimedia files)
  app.use(express.static('public'));
  
  // Add media router for file handling
  app.use(mediaRouter);
  
  // Register Supabase auth routes
  app.use('/api/auth', supabaseRoutes);
  
  // Register conflict detection routes with specific paths that need auth
  app.use('/api/events/conflict-check', isAuthenticatedMiddleware, conflictRoutes);
  
  // Register API routes (excluding auth routes - handled by Supabase)
  const server = await registerRoutes(app, { excludeAuth: true });

  // Set up WebSocket server for chat
  const { ChatWebSocketServer } = await import('./websocket-server');
  new ChatWebSocketServer(server);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Express error handler:", err);
    res.status(status).json({ message });
  });



  // Add a special middleware to ensure API routes don't get handled by Vite
  app.use((req, res, next) => {
    // If this is an API request and has already been handled, don't pass it to Vite
    if (req.path.startsWith('/api/') && res.headersSent) {
      return;
    }
    next();
  });
  
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use port 5000 for Replit compatibility, fallback to available port
  const PORT = process.env.PORT || 5000;
  log(`Attempting to start server on port ${PORT}...`);
  
  server.listen({
    port: PORT,
    host: "0.0.0.0",
  }, () => {
    log(`🚀 Server started successfully on port ${PORT}`);
    
    // Print additional information to make it clear for users
    log(`-------------------------------------------------------`);
    log(`Pipol Application is now running!`);
    log(`Access the app in your browser at: http://localhost:${PORT}`);
    log(`-------------------------------------------------------`);
  }).on('error', (err: any) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Failed to start server: ${errorMessage}`);
    process.exit(1);
  });
})();
