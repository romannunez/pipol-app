import express, { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import passport from "passport";
import { loginUserSchema, insertUserSchema, insertEventSchema, insertEventAttendeeSchema } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
// WebSocket imports removed to prevent conflicts
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { isAuthenticatedMiddleware } from "./supabase-auth";
import { supabase } from "./supabase-client";

if (!process.env.SESSION_SECRET) {
  console.warn("No SESSION_SECRET provided, using default secret. This is insecure!");
}

// Payment functionality is disabled for this app
console.log("Payment functionality is disabled in this version of the app.");

// Set stripe to null - all events will be free
const stripe = null;

// Configurar almacenamiento para multer
const storage_uploads = multer.diskStorage({
  destination: function (req, file, cb) {
    // Definir el directorio según el tipo de archivo
    let uploadPath = 'public/uploads/events';
    
    // Asegurarse de que el directorio existe
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generar un nombre de archivo único
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'event-' + uniqueSuffix + extension);
  }
});

// Filtrar archivos por tipo y validar condiciones
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log(`Procesando archivo: ${file.fieldname}, tipo: ${file.mimetype}`);
  
  // Categorizar el archivo según el campo
  const isMainMedia = file.fieldname === 'mainMediaFile';
  const isEventPhoto = file.fieldname === 'eventPhoto';
  const isEventVideo = file.fieldname === 'eventVideo';
  const isMediaFile = file.fieldname.startsWith('mediaFile_');
  const isPhotos = file.fieldname === 'photos';
  const isVideos = file.fieldname === 'videos';
  const isEventPhotos = file.fieldname === 'eventPhotos';
  const isEventVideos = file.fieldname === 'eventVideos';
  
  // Límites de tipos de archivo
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  
  // Validar tipos permitidos
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'];
  
  // Verificar si el tipo de archivo es válido
  const isValidImageType = allowedImageTypes.includes(file.mimetype);
  const isValidVideoType = allowedVideoTypes.includes(file.mimetype);
  
  if (!isValidImageType && !isValidVideoType) {
    console.log(`Archivo rechazado por tipo no válido: ${file.mimetype}`);
    return cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
  }
  
  // Verificar coherencia entre el campo y el tipo
  if ((isEventPhoto || isPhotos || isEventPhotos) && !isImage) {
    return cb(new Error('Solo se permiten imágenes para campos de fotos'));
  }
  
  if ((isEventVideo || isVideos || isEventVideos) && !isVideo) {
    return cb(new Error('Solo se permiten videos para campos de video'));
  }
  
  console.log(`Archivo aceptado: ${file.fieldname} (${file.mimetype})`);
  cb(null, true);
};

// Manejo de errores de multer
const multerErrorHandler = (err: any, req: Request, res: Response, next: Function) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: "El archivo es demasiado grande",
        details: "El tamaño máximo permitido es 10MB"
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        message: "Demasiados archivos",
        details: "Se ha excedido el límite de archivos permitidos"
      });
    }
  }
  
  if (err.message && err.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({ 
      message: "Tipo de archivo no válido",
      details: err.message
    });
  }
  
  return res.status(500).json({ 
    message: "Error al procesar archivos",
    details: err.message || 'Error desconocido'
  });
};

export async function registerRoutes(app: Express, options: { excludeAuth?: boolean } = {}): Promise<Server> {
  
  const isAuthenticated = async (req: Request, res: Response, next: Function) => {
    console.log("Auth check for", req.method, req.path, ": ", req.user ? "Authenticated" : "Not authenticated");
    
    // Check if user is already set by passport
    if (req.user) {
      return next();
    }
    
    // Check if user is in session (passport session)
    if (req.session && (req.session as any).passport && (req.session as any).passport.user) {
      console.log("Found user in session, attempting to deserialize user ID:", (req.session as any).passport.user);
      
      try {
        // Manually deserialize user using direct Supabase query
        const userId = (req.session as any).passport.user;
        console.log("Manual deserialization for user ID:", userId);
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', parseInt(userId))
          .single(); // Use single() for better error handling
        
        console.log("Manual deserialization result:", { 
          error: error?.message || null, 
          hasUser: !!users
        });
        
        if (error) {
          console.error("Manual deserialization Supabase error:", error.message);
          // Still check if error is about no rows found vs actual error
          if (error.code !== 'PGRST116') { // PGRST116 is "no rows found"
            return res.status(500).json({ message: "Database authentication error" });
          }
        } else if (users) {
          console.log("Manual deserialization successful:", users.id, users.name);
          req.user = users;
          return next();
        }
      } catch (error) {
        console.error("Error during manual deserialization:", error);
      }
    }
    
    // If all else fails, try one more check with passport's isAuthenticated
    if (req.isAuthenticated && req.isAuthenticated()) {
      console.log("Passport isAuthenticated() returned true, proceeding");
      return next();
    }
    
    // Check session data for debugging
    console.log("Checking session data:", {
      sessionExists: !!req.session,
      sessionId: req.sessionID,
      cookieExists: !!req.headers.cookie,
      passportSession: !!(req.session && (req.session as any).passport),
      passportUser: req.session && (req.session as any).passport ? (req.session as any).passport.user : null,
      passportIsAuthenticated: req.isAuthenticated ? req.isAuthenticated() : 'N/A'
    });
    
    return res.status(401).json({ message: "Authentication required" });
  };

  // Auth routes (only if not excluded)
  if (!options.excludeAuth) {
    app.post("/api/auth/register", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid user data", errors: result.error.errors });
      }

      const { username, email, password, name, bio } = result.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password if provided
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

      // Create user
      const user = await storage.insertUser({
        username,
        email,
        password: hashedPassword,
        name,
        bio: bio || null,
        avatar: null,
        supabaseId: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
      if (!user) {
        return res.status(500).json({ message: "Failed to create user" });
      }

      // Log the user in using req.login
      req.login(user as any, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Login failed after registration" });
        }
        
        // Store user data in session
        (req.session as any).authenticated = true;
        (req.session as any).userEmail = user.email;
        (req.session as any).userId = user.id;
        (req.session as any).supabaseUserId = user.supabaseId;
        
        return res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          bio: user.bio,
          avatar: user.avatar,
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    const result = loginUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid login data", errors: result.error.errors });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Authentication error:", err);
        return res.status(500).json({ message: "Authentication failed" });
      }

      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }

      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        
        console.log("Login successful for user:", user.email, "with ID:", user.id);
        
        // Store user data in session
        (req.session as any).authenticated = true;
        (req.session as any).userEmail = user.email;
        (req.session as any).userId = user.id;
        (req.session as any).supabaseUserId = user.supabaseId;
        
        // Save session before responding
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
          }
          
          return res.json({
            message: "Login successful",
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              name: user.name
            },
            token: user.supabaseToken || '',
            refreshToken: user.supabaseRefreshToken || '',
            sessionId: req.sessionID
          });
        });
      });
    })(req, res, next);
  });

    // Logout endpoint
    app.post("/api/auth/logout", (req, res) => {
      req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
          return res.status(500).json({ message: "Logout failed" });
        }
        
        // Clear session data
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).json({ message: "Session cleanup failed" });
          }
          
          res.clearCookie('pipol_session');
          res.clearCookie('connect.sid');
          return res.json({ message: "Logged out successfully" });
        });
      });
    });

    // Get current user
    app.get("/api/auth/me", isAuthenticated, (req, res) => {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user as any;
      
      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        bio: user.bio,
        avatar: user.avatar,
      });
    });
  } // End of excludeAuth conditional block

  // Get latest message for events - MUST BE BEFORE /:id route
  app.get("/api/events/latest-messages", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { eventIds } = req.query;

      console.log('Latest messages request:', { eventIds, user: user.id, type: typeof eventIds });

      if (!eventIds) {
        console.log('No eventIds provided');
        return res.status(400).json({ message: 'Event IDs required' });
      }

      const eventIdArray = typeof eventIds === 'string' ? 
        eventIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];

      console.log('Parsed event IDs:', eventIdArray, 'Original:', eventIds);

      if (eventIdArray.length === 0) {
        console.log('No valid event IDs after parsing');
        return res.status(400).json({ message: 'No valid event IDs provided' });
      }

      // Get latest message for each event
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          event_id,
          sender_id,
          content,
          message_type,
          created_at,
          sender:users!sender_id (
            id,
            name,
            username
          )
        `)
        .in('event_id', eventIdArray)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching latest messages:', error);
        return res.status(500).json({ message: 'Error fetching messages' });
      }

      // Group messages by event_id and get the latest one for each event
      const latestMessages: { [eventId: number]: any } = {};
      
      if (messages) {
        console.log('Found messages:', messages.length);
        messages.forEach(message => {
          const eventId = message.event_id;
          if (!latestMessages[eventId] || new Date(message.created_at) > new Date(latestMessages[eventId].created_at)) {
            latestMessages[eventId] = message;
          }
        });
      }

      console.log('Returning latest messages:', latestMessages);
      res.json(latestMessages);
    } catch (error) {
      console.error('Error in latest messages endpoint:', error);
      res.status(500).json({ message: 'Error fetching messages' });
    }
  });

  // Get event by ID (PUBLIC ROUTE)
  app.get("/api/events/:id", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Create events
  app.post("/api/events", [
    isAuthenticated,
    multer({ 
      storage: storage_uploads, 
      fileFilter: fileFilter,
      limits: { 
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 12 // Max 12 files total (mainMediaFile + up to 11 additional media files)
      }
    }).fields([
      { name: 'mainMediaFile', maxCount: 1 },
      { name: 'eventPhoto', maxCount: 1 },
      { name: 'eventVideo', maxCount: 1 },
      { name: 'photos', maxCount: 6 },
      { name: 'videos', maxCount: 3 },
      { name: 'eventPhotos', maxCount: 6 },
      { name: 'eventVideos', maxCount: 3 },
      { name: 'mediaFile_0', maxCount: 1 },
      { name: 'mediaFile_1', maxCount: 1 },
      { name: 'mediaFile_2', maxCount: 1 },
      { name: 'mediaFile_3', maxCount: 1 },
      { name: 'mediaFile_4', maxCount: 1 },
      { name: 'mediaFile_5', maxCount: 1 },
      { name: 'mediaFile_6', maxCount: 1 },
      { name: 'mediaFile_7', maxCount: 1 },
      { name: 'mediaFile_8', maxCount: 1 },
      { name: 'mediaFile_9', maxCount: 1 }
    ])
  ], async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};
      
      // Build event data with proper type conversion using camelCase field names
      const eventData: any = {
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        date: new Date(req.body.date),
        latitude: parseFloat(req.body.latitude),
        longitude: parseFloat(req.body.longitude),
        locationName: req.body.locationName,
        locationAddress: req.body.locationAddress,
        paymentType: req.body.paymentType,
        privacyType: req.body.privacyType,
        genderPreference: req.body.genderPreference || 'all_people',
        organizerId: parseInt(user.id.toString()),
        maxCapacity: req.body.maxCapacity ? parseInt(req.body.maxCapacity) : null,
        price: req.body.price ? parseFloat(req.body.price) : null,
        mainMediaUrl: null,
        mainMediaType: 'photo',
        mediaItems: null
      };

      // Process media items without duplication
      let mediaItems: any[] = [];
      let mainMediaUrl = '';
      let mainMediaType = 'photo';
      
      // Parse existing mediaItems if provided (for new items, these will be placeholders without real URLs)
      let existingMediaStructure: any[] = [];
      if (req.body.mediaItems) {
        try {
          const parsedItems = JSON.parse(req.body.mediaItems);
          if (Array.isArray(parsedItems)) {
            existingMediaStructure = parsedItems;
          }
        } catch (e) {
          console.warn("Could not parse mediaItems:", e);
        }
      }

      // Process uploaded files and map them to the correct media structure
      let fileIndex = 0;
      Object.keys(files).forEach((fieldName) => {
        const fileArray = files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          const mediaPath = file.path.replace('public', '');
          const isVideo = file.mimetype.startsWith('video/');
          
          // Find if this file corresponds to a placeholder in existingMediaStructure
          let targetItem = null;
          if (fieldName === 'mainMediaFile') {
            // Find the item marked as main
            targetItem = existingMediaStructure.find(item => item.isMain);
          } else if (fieldName.startsWith('mediaFile_')) {
            // Match by order/index
            const mediaFileIndex = parseInt(fieldName.split('_')[1]);
            targetItem = existingMediaStructure.find(item => !item.url && item.order === mediaFileIndex);
            if (!targetItem) {
              // Fallback: find any item without URL at the correct position
              targetItem = existingMediaStructure.filter(item => !item.url)[mediaFileIndex];
            }
          }
          
          const mediaItem: any = {
            type: isVideo ? 'video' : 'photo',
            url: mediaPath,
            order: targetItem ? targetItem.order : fileIndex,
            isMain: targetItem ? targetItem.isMain : (fieldName === 'mainMediaFile' || fileIndex === 0)
          };
          
          mediaItems.push(mediaItem);
          
          if (mediaItem.isMain || mainMediaUrl === '') {
            mainMediaUrl = mediaPath;
            mainMediaType = mediaItem.type;
          }
          
          fileIndex++;
        }
      });

      // Add any existing items with URLs (items that already existed and weren't being replaced)
      existingMediaStructure.forEach(item => {
        if (item.url && item.url.trim() !== '') {
          // Only add if not already processed as a file upload
          const existsInUploads = mediaItems.some(mediaItem => mediaItem.url === item.url);
          if (!existsInUploads) {
            mediaItems.push({
              type: item.type,
              url: item.url,
              order: item.order,
              isMain: item.isMain || false
            });
            
            if (item.isMain && !mainMediaUrl) {
              mainMediaUrl = item.url;
              mainMediaType = item.type;
            }
          }
        }
      });

      // Enhanced main media selection for event creation
      let finalMainMediaUrl = null;
      let finalMainMediaType = 'photo';
      
      if (mediaItems.length > 0) {
        // Find explicitly marked main item with valid URL
        const explicitMain = mediaItems.find((item: any) => 
          item && item.isMain === true && item.url && item.url.trim() !== ''
        );
        
        if (explicitMain) {
          finalMainMediaUrl = explicitMain.url;
          finalMainMediaType = explicitMain.type || 'photo';
        } else {
          // Use first valid item as main
          const firstValid = mediaItems.find((item: any) => 
            item && item.url && item.url.trim() !== ''
          );
          
          if (firstValid) {
            finalMainMediaUrl = firstValid.url;
            finalMainMediaType = firstValid.type || 'photo';
            
            // Mark first valid item as main
            mediaItems = mediaItems.map((item: any) => ({
              ...item,
              isMain: item === firstValid
            }));
          }
        }
      }

      // Set main media (using camelCase field names)
      eventData.mainMediaUrl = finalMainMediaUrl;
      eventData.mainMediaType = finalMainMediaType;

      // Sort media items so main item appears first before saving
      if (mediaItems.length > 0) {
        const sortedMediaItems = mediaItems.sort((a, b) => {
          // If one is main and the other is not, main goes first
          if (a.isMain && !b.isMain) return -1;
          if (!a.isMain && b.isMain) return 1;
          // If both are main or neither is main, sort by order
          return (a.order || 0) - (b.order || 0);
        });

        eventData.mediaItems = JSON.stringify(sortedMediaItems);
      } else {
        eventData.mediaItems = null;
      }

      const newEvent = await storage.insertEvent(eventData);

      res.status(201).json(newEvent);
    } catch (error) {
      console.error("Event creation error:", error);
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  // Update events  
  app.patch("/api/events/:id", [
    isAuthenticated,
    multer({ 
      storage: storage_uploads, 
      fileFilter: fileFilter,
      limits: { 
        fileSize: 10 * 1024 * 1024,
        files: 12
      }
    }).fields([
      { name: 'mainMediaFile', maxCount: 1 },
      { name: 'eventPhoto', maxCount: 1 },
      { name: 'eventVideo', maxCount: 1 },
      { name: 'photos', maxCount: 6 },
      { name: 'videos', maxCount: 3 },
      { name: 'eventPhotos', maxCount: 6 },
      { name: 'eventVideos', maxCount: 3 },
      { name: 'mediaFile_0', maxCount: 1 },
      { name: 'mediaFile_1', maxCount: 1 },
      { name: 'mediaFile_2', maxCount: 1 },
      { name: 'mediaFile_3', maxCount: 1 },
      { name: 'mediaFile_4', maxCount: 1 },
      { name: 'mediaFile_5', maxCount: 1 },
      { name: 'mediaFile_6', maxCount: 1 },
      { name: 'mediaFile_7', maxCount: 1 },
      { name: 'mediaFile_8', maxCount: 1 },
      { name: 'mediaFile_9', maxCount: 1 }
    ])
  ], async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      
      // Check if event exists
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Debug logging to understand event structure
      console.log("Event object keys:", Object.keys(event));
      console.log("Event organizer info:", {
        organizerId: event.organizerId,
        organizer_id: event.organizer_id,
        organizer: event.organizer
      });
      
      // Check authorization - handle different possible property names
      const eventOrganizerId = event.organizerId || event.organizer_id || event.organizer?.id;
      if (!eventOrganizerId) {
        console.error("Could not find organizer ID in event:", event);
        return res.status(403).json({ message: "Event organizer information not found" });
      }
      
      if (parseInt(eventOrganizerId.toString()) !== parseInt(user.id.toString())) {
        console.log("Authorization failed:", { eventOrganizerId, userId: user.id });
        return res.status(403).json({ message: "Not authorized to update this event" });
      }
      
      const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};
      const updateData: any = { ...req.body };
      
      // Convert field names from camelCase to snake_case to match database schema
      if (updateData.locationName) {
        updateData.location_name = updateData.locationName;
        delete updateData.locationName;
      }
      if (updateData.locationAddress) {
        updateData.location_address = updateData.locationAddress;
        delete updateData.locationAddress;
      }
      if (updateData.paymentType) {
        updateData.payment_type = updateData.paymentType;
        delete updateData.paymentType;
      }
      if (updateData.maxCapacity) {
        updateData.max_capacity = updateData.maxCapacity;
        delete updateData.maxCapacity;
      }
      if (updateData.privacyType) {
        updateData.privacy_type = updateData.privacyType;
        delete updateData.privacyType;
      }
      if (updateData.privateAccessType) {
        // Note: privateAccessType column doesn't exist in current database schema
        // Skip this field to prevent database errors
        console.log("Skipping privateAccessType field - not implemented in database schema");
        delete updateData.privateAccessType;
      }
      if (updateData.mainMediaType) {
        updateData.main_media_type = updateData.mainMediaType;
        delete updateData.mainMediaType;
      }
      if (updateData.mainMediaUrl) {
        updateData.main_media_url = updateData.mainMediaUrl;
        delete updateData.mainMediaUrl;
      }
      if (updateData.mediaItems) {
        updateData.media_items = updateData.mediaItems;
        delete updateData.mediaItems;
      }
      if (updateData.organizerId) {
        updateData.organizer_id = updateData.organizerId;
        delete updateData.organizerId;
      }
      if (updateData.createdAt) {
        updateData.created_at = updateData.createdAt;
        delete updateData.createdAt;
      }
      if (updateData.updatedAt) {
        updateData.updated_at = updateData.updatedAt;
        delete updateData.updatedAt;
      }
      if (updateData.genderPreference) {
        updateData.gender_preference = updateData.genderPreference;
        delete updateData.genderPreference;
      }
      
      // Convert date string to Date object if provided
      if (updateData.date && typeof updateData.date === 'string') {
        updateData.date = new Date(updateData.date);
      }
      
      // Parse existing mediaItems with improved error handling - check both field names
      let mediaItems: any[] = [];
      const existingMediaItems = event.media_items || event.mediaItems;
      if (existingMediaItems) {
        try {
          if (typeof existingMediaItems === 'string') {
            mediaItems = JSON.parse(existingMediaItems);
          } else if (Array.isArray(existingMediaItems)) {
            mediaItems = existingMediaItems;
          } else if (typeof existingMediaItems === 'object') {
            mediaItems = [existingMediaItems];
          }
          
          // Ensure array is valid
          if (!Array.isArray(mediaItems)) {
            mediaItems = [];
          }
        } catch (e) {
          console.warn("Could not parse existing mediaItems:", e);
          mediaItems = [];
        }
      }

      // Parse client mediaItems with enhanced validation
      let clientMediaItems: any[] = [];
      if (req.body.mediaItems) {
        try {
          if (typeof req.body.mediaItems === 'string') {
            // Handle JSON string
            clientMediaItems = JSON.parse(req.body.mediaItems);
          } else if (Array.isArray(req.body.mediaItems)) {
            // Handle array directly
            clientMediaItems = req.body.mediaItems;
          } else if (typeof req.body.mediaItems === 'object' && req.body.mediaItems !== null) {
            // Handle single object
            clientMediaItems = [req.body.mediaItems];
          } else {
            clientMediaItems = [];
          }
          
          // Validate that result is an array
          if (!Array.isArray(clientMediaItems)) {
            console.warn("Client mediaItems is not an array after parsing, resetting to empty array");
            clientMediaItems = [];
          }
        } catch (e) {
          console.warn("Could not parse client mediaItems:", e);
          clientMediaItems = [];
        }
      }

      // Process uploaded files and map them to metadata
      const uploadedFiles: any[] = [];
      Object.keys(files).forEach((fieldName, index) => {
        const fileArray = files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          const mediaPath = file.path.replace('public', '');
          const isVideo = file.mimetype.startsWith('video/');
          
          uploadedFiles.push({
            fieldName,
            type: isVideo ? 'video' : 'photo',
            url: mediaPath,
            order: index,
            isMain: fieldName === 'mainMediaFile'
          });
          
          console.log(`📁 Uploaded file processed: ${fieldName} -> ${mediaPath}`);
        }
      });

      // Combine client metadata with uploaded files
      mediaItems = [];
      
      if (clientMediaItems.length > 0) {
        console.log(`Processing ${clientMediaItems.length} client media items`);
        
        clientMediaItems.forEach((clientItem: any, index: number) => {
          // If client item has existing URL, preserve it
          if (clientItem.url && !clientItem.isNew) {
            mediaItems.push({
              type: clientItem.type || 'photo',
              url: clientItem.url,
              order: clientItem.order !== undefined ? clientItem.order : index,
              isMain: clientItem.isMain === true
            });
            console.log(`📂 Preserved existing media: ${clientItem.url}`);
          }
          // If client item is new and has file, find corresponding upload
          else if (clientItem.isNew && clientItem.hasFile) {
            // Find uploaded file by order/index
            const uploadedFile = uploadedFiles.find(upload => 
              upload.fieldName.endsWith(`_${index}`) || upload.order === index
            ) || uploadedFiles[index];
            
            if (uploadedFile) {
              mediaItems.push({
                type: uploadedFile.type,
                url: uploadedFile.url,
                order: clientItem.order !== undefined ? clientItem.order : index,
                isMain: clientItem.isMain === true
              });
              console.log(`📁 Added new media: ${uploadedFile.url}`);
            }
          }
        });
      } else {
        // Fallback: add all uploaded files if no client metadata
        uploadedFiles.forEach((upload, index) => {
          mediaItems.push({
            type: upload.type,
            url: upload.url,
            order: upload.order !== undefined ? upload.order : index,
            isMain: upload.isMain || index === 0
          });
        });
      }

      // Enhanced main media selection with validation
      let mainItem: any = null;
      
      // First, try to find explicitly marked main item with valid URL
      mainItem = mediaItems.find((item: any) => 
        item && item.isMain === true && item.url && item.url.trim() !== ''
      );
      
      // If no explicit main found, use first valid item
      if (!mainItem && mediaItems.length > 0) {
        mainItem = mediaItems.find((item: any) => 
          item && item.url && item.url.trim() !== ''
        );
        
        // Mark first valid item as main
        if (mainItem) {
          mediaItems = mediaItems.map((item: any) => ({
            ...item,
            isMain: item === mainItem
          }));
        }
      }
      
      // Set main media references (using correct database column names)
      if (mainItem && mainItem.url) {
        updateData.main_media_url = mainItem.url;
        updateData.main_media_type = mainItem.type || 'photo';
        console.log(`Encontrado elemento principal en mediaItems: {
          tipo: '${mainItem.type}',
          url: '${mainItem.url}'
        }`);
      } else {
        // Clear main media if no valid main item found
        updateData.main_media_url = null;
        updateData.main_media_type = 'photo';
        console.log("No se encontró elemento principal válido, limpiando referencias");
      }

      // Sort media items so main item appears first before saving
      if (mediaItems.length > 0) {
        const sortedMediaItems = mediaItems.sort((a, b) => {
          // If one is main and the other is not, main goes first
          if (a.isMain && !b.isMain) return -1;
          if (!a.isMain && b.isMain) return 1;
          // If both are main or neither is main, sort by order
          return (a.order || 0) - (b.order || 0);
        });

        updateData.media_items = JSON.stringify(sortedMediaItems);
      }

      console.log("Attempting to update event with data:", {
        eventId,
        updateFields: Object.keys(updateData),
        privacyType: updateData.privacy_type
      });

      await storage.updateEvent(eventId, updateData);
      const updatedEvent = await storage.getEventById(eventId);

      console.log("Event updated successfully");
      res.json(updatedEvent);
    } catch (error: any) {
      console.error("Event update error - detailed:", {
        error: error.message,
        stack: error.stack,
        eventId: req.params.id,
        updateFields: req.body ? Object.keys(req.body) : []
      });
      res.status(500).json({ message: "Failed to update event", details: error.message });
    }
  });

  // Get all events
  app.get("/api/events", async (req, res) => {
    try {
      const { lat, lng, radius, category, paymentType, search } = req.query;
      
      console.log("📍 GET /api/events query params:", { lat, lng, radius, category, paymentType, search });
      
      let events;
      
      // If lat and lng are provided, get nearby events
      if (lat && lng) {
        console.log("📍 Using nearby events path");
        events = await storage.getNearbyEvents(
          parseFloat(lat as string),
          parseFloat(lng as string),
          radius ? parseFloat(radius as string) : 10
        );
      } else {
        // Otherwise get all events with filters
        const filters: any = {};
        
        if (category) {
          filters.category = Array.isArray(category) ? category : [category as string];
        }
        
        if (paymentType) {
          filters.paymentType = Array.isArray(paymentType) ? paymentType : [paymentType as string];
        }
        
        if (search) {
          filters.searchTerm = search as string;
          console.log("📍 Adding search filter:", search);
        }
        
        console.log("📍 Using filtered events path with filters:", filters);
        events = await storage.getEvents(filters);
      }
      
      console.log(`📍 Found ${events.length} events`);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });



  // Delete all events (for development purposes)
  app.delete("/api/events", async (req, res) => {
    try {
      await storage.deleteAllEvents();
      res.json({ message: "All events deleted successfully" });
    } catch (error) {
      console.error("Error deleting all events:", error);
      res.status(500).json({ message: "Failed to delete all events" });
    }
  });

  // Delete event
  app.delete("/api/events/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      
      console.log(`Delete event request - User ID: ${user.id} (type: ${typeof user.id}), Event ID: ${eventId}`);
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Get organizer ID from both possible field names (snake_case from DB, camelCase from processed)
      const eventOrganizerId = event.organizer_id || event.organizerId;
      
      console.log(`Event found - Organizer ID: ${eventOrganizerId} (type: ${typeof eventOrganizerId})`);
      console.log(`Authorization check: ${eventOrganizerId} === ${user.id} -> ${eventOrganizerId === user.id}`);
      
      // Convert both to numbers for proper comparison
      const organizerIdNum = parseInt(String(eventOrganizerId));
      const userIdNum = parseInt(String(user.id));
      
      console.log(`Parsed values - Organizer: ${organizerIdNum}, User: ${userIdNum}`);
      
      if (organizerIdNum !== userIdNum) {
        console.log(`Authorization failed: ${organizerIdNum} !== ${userIdNum}`);
        return res.status(403).json({ message: "Not authorized to delete this event" });
      }
      
      console.log(`Authorization successful - deleting event ${eventId}`);
      await storage.deleteEvent(eventId);
      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Event attendance
  app.post("/api/events/:id/attend", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      const attendeeData = {
        eventId,
        userId: user.id,
        status: "approved" as const,
        paymentStatus: "completed",
        paymentIntentId: null,
      };
      
      const attendee = await storage.insertEventAttendee(attendeeData);
      
      res.status(201).json(attendee);
    } catch (error) {
      console.error("Error attending event:", error);
      res.status(500).json({ message: "Failed to attend event" });
    }
  });

  // Join event (alias for attend)
  app.post("/api/events/:id/join", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      const { answers } = req.body; // For private events with questions
      
      console.log(`🔍 Checking access for user ${user.id} to event ${eventId}`);
      console.log(`🔍 Verifying access for user ${user.id} to event ${eventId}`);
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      console.log(`📋 Event found: ${event.title}, organizer: ${event.organizerId}, user requesting: ${user.id}`);
      console.log(`🔍 Event privacy: ${event.privacyType || event.privacy_type}, access type: ${event.privateAccessType || event.private_access_type}`);
      
      // Check if user is already attending
      const existingAttendee = await storage.getEventAttendee(eventId, user.id);
      if (existingAttendee) {
        return res.status(400).json({ message: "Already joined this event" });
      }
      
      // Determine status based on event privacy and access type
      let status: "approved" | "pending" = "approved";
      let isPendingApproval = false;
      
      // For private events, check the access type (handle both camelCase and snake_case)
      const eventPrivacy = event.privacyType || event.privacy_type;
      const eventAccessType = event.privateAccessType || event.private_access_type;
      
      if (eventPrivacy === "private") {
        // Default private events to "solicitud" if no access type is specified
        const accessType = eventAccessType || "solicitud";
        console.log(`🔍 Private event access type: ${accessType} (original: ${eventAccessType})`);
        
        if (accessType === "solicitud" || accessType === "postulacion") {
          status = "pending";
          isPendingApproval = true;
        } else if (accessType === "paga") {
          // For paid private events, require immediate payment
          return res.status(402).json({ 
            message: "Payment required", 
            requiresPayment: true,
            eventId: eventId 
          });
        }
      }
      
      const attendeeData = {
        eventId,
        userId: user.id,
        status,
        paymentStatus: status === "approved" ? "completed" : "pending",
        paymentIntentId: null,
        applicationAnswers: answers ? JSON.stringify(answers) : null,
      };
      
      const attendee = await storage.insertEventAttendee(attendeeData);
      
      if (isPendingApproval) {
        // Create notification for the event organizer about new join request
        try {
          await storage.createNotification({
            userId: event.organizerId,
            type: 'new_request',
            title: 'Nueva solicitud de evento',
            message: `${user.name} quiere unirse a "${event.title}"`,
            eventId: eventId,
            requestId: attendee.id
          });
          console.log(`📧 Created notification for organizer about request from ${user.name}`);
        } catch (notificationError) {
          console.error('Error creating notification:', notificationError);
          // Don't fail the request if notification creation fails
        }
        
        console.log(`📝 User ${user.username} submitted request for private event ${eventId}`);
        res.status(201).json({ 
          message: "Join request submitted successfully", 
          attendee,
          isPendingApproval: true,
          status: "pending"
        });
      } else {
        console.log(`✅ User ${user.username} joined event ${eventId} successfully`);
        res.status(201).json({ 
          message: "Successfully joined event", 
          attendee,
          isPendingApproval: false,
          status: "approved"
        });
      }
    } catch (error) {
      console.error("Error joining event:", error);
      res.status(500).json({ message: "Failed to join event" });
    }
  });

  // Get pending requests for an event (organizers only)
  app.get("/api/events/:id/requests", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Only organizer can see pending requests
      if (event.organizerId !== user.id) {
        return res.status(403).json({ message: "Only organizer can view requests" });
      }
      
      const pendingRequests = await storage.getPendingEventRequests(eventId);
      res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  // Approve event join request (organizers only)
  app.post("/api/events/:id/requests/:userId/approve", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);
      
      console.log(`🔍 Organizer ${user.id} approving user ${userId} for event ${eventId}`);
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Only organizer can approve requests
      if (event.organizerId !== user.id) {
        return res.status(403).json({ message: "Only organizer can approve requests" });
      }
      
      // Update attendee status to approved
      const result = await storage.approveEventAttendee(eventId, userId);
      
      if (result) {
        // Create notification for the approved user
        try {
          const approvedUser = await storage.getUserById(userId);
          await storage.createNotification({
            userId: userId,
            type: 'request_approved',
            title: 'Solicitud aceptada',
            message: `Tu solicitud para unirte a "${event.title}" ha sido aceptada`,
            eventId: eventId
          });
          console.log(`📧 Created approval notification for user ${approvedUser?.name || userId}`);
        } catch (notificationError) {
          console.error('Error creating approval notification:', notificationError);
          // Don't fail the approval if notification creation fails
        }

        console.log(`✅ User ${userId} approved for event ${eventId}`);
        res.json({ message: "Request approved successfully" });
      } else {
        res.status(404).json({ message: "Request not found" });
      }
    } catch (error) {
      console.error("Error approving request:", error);
      res.status(500).json({ message: "Failed to approve request" });
    }
  });

  // Reject event join request (organizers only)
  app.post("/api/events/:id/requests/:userId/reject", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);
      
      console.log(`🔍 Organizer ${user.id} rejecting user ${userId} for event ${eventId}`);
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Only organizer can reject requests
      if (event.organizerId !== user.id) {
        return res.status(403).json({ message: "Only organizer can reject requests" });
      }
      
      // Update attendee status to rejected or remove the request
      const result = await storage.rejectEventAttendee(eventId, userId);
      
      if (result) {
        // Create notification for the rejected user
        try {
          const rejectedUser = await storage.getUserById(userId);
          await storage.createNotification({
            userId: userId,
            type: 'request_rejected',
            title: 'Solicitud rechazada',
            message: `Tu solicitud para unirte a "${event.title}" ha sido rechazada`,
            eventId: eventId
          });
          console.log(`📧 Created rejection notification for user ${rejectedUser?.name || userId}`);
        } catch (notificationError) {
          console.error('Error creating rejection notification:', notificationError);
          // Don't fail the rejection if notification creation fails
        }

        console.log(`❌ User ${userId} rejected for event ${eventId}`);
        res.json({ message: "Request rejected successfully" });
      } else {
        res.status(404).json({ message: "Request not found" });
      }
    } catch (error) {
      console.error("Error rejecting request:", error);
      res.status(500).json({ message: "Failed to reject request" });
    }
  });

  // Create payment for private paid events
  app.post("/api/events/:id/pay", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if event requires payment
      if (event.privacyType !== "private" || event.privateAccessType !== "paga") {
        return res.status(400).json({ message: "Event does not require payment" });
      }
      
      // Check if user is already attending
      const existingAttendee = await storage.getEventAttendee(eventId, user.id);
      if (existingAttendee) {
        return res.status(400).json({ message: "Already joined this event" });
      }
      
      // For now, simulate successful payment (since Stripe is disabled)
      // In production, this would create a Stripe payment intent
      const attendeeData = {
        eventId,
        userId: user.id,
        status: "approved" as const,
        paymentStatus: "completed",
        paymentIntentId: "sim_" + Date.now(), // Simulated payment ID
        applicationAnswers: null,
      };
      
      const attendee = await storage.insertEventAttendee(attendeeData);
      
      console.log(`💳 User ${user.username} completed payment for private event ${eventId}`);
      res.status(201).json({ 
        message: "Payment successful and joined event", 
        attendee,
        paymentSuccess: true 
      });
      
    } catch (error) {
      console.error("Error processing payment:", error);
      res.status(500).json({ message: "Failed to process payment" });
    }
  });

  // Leave event (remove attendance)
  app.delete("/api/events/:id/leave", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      
      console.log(`User ${user.username} (ID: ${user.id}) attempting to leave event ${eventId}`);
      
      // Check if event exists
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if user is currently attending
      const existingAttendee = await storage.getEventAttendee(eventId, user.id);
      if (!existingAttendee) {
        return res.status(400).json({ message: "You are not attending this event" });
      }
      
      // Remove user from event
      const result = await storage.leaveEvent(eventId, user.id);
      
      console.log(`✅ User ${user.username} left event ${eventId} successfully`);
      res.json({ message: "Successfully left event", result });
    } catch (error) {
      console.error("Error leaving event:", error);
      res.status(500).json({ message: "Failed to leave event" });
    }
  });

  // Get event attendance status for current user
  app.get("/api/events/:id/status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if user is the organizer
      const isOrganizer = event.organizerId === user.id;
      
      // Check if user is attending
      const attendee = await storage.getEventAttendee(eventId, user.id);
      const isAttending = !!attendee;
      
      res.json({
        isOrganizer,
        isAttending,
        status: attendee?.status || null,
        paymentStatus: attendee?.paymentStatus || null
      });
    } catch (error) {
      console.error("Error fetching event status:", error);
      res.status(500).json({ message: "Failed to fetch event status" });
    }
  });

  // Get event attendees
  app.get("/api/events/:id/attendees", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const attendees = await storage.getEventAttendees(eventId);
      res.json(attendees);
    } catch (error) {
      console.error("Error fetching attendees:", error);
      res.status(500).json({ message: "Failed to fetch attendees" });
    }
  });

  // Get events the authenticated user is attending
  app.get("/api/user/events/attending", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const attendingEvents = await storage.getUserAttendingEvents(user.id);
      
      // Convert snake_case database fields to camelCase for frontend
      const convertedEvents = attendingEvents.map((item: any) => {
        if (item.event) {
          // Convert event fields from snake_case to camelCase
          const event = {
            ...item.event,
            locationName: item.event.location_name,
            locationAddress: item.event.location_address,
            paymentType: item.event.payment_type,
            maxCapacity: item.event.max_capacity,
            privacyType: item.event.privacy_type,
            mainMediaUrl: item.event.main_media_url,
            mainMediaType: item.event.main_media_type,
            mediaItems: item.event.media_items,
            organizerId: item.event.organizer_id,
            createdAt: item.event.created_at,
            updatedAt: item.event.updated_at
          };
          
          // Clean up snake_case fields
          delete event.location_name;
          delete event.location_address;
          delete event.payment_type;
          delete event.max_capacity;
          delete event.privacy_type;
          delete event.main_media_url;
          delete event.main_media_type;
          delete event.media_items;
          delete event.organizer_id;
          delete event.created_at;
          delete event.updated_at;
          
          return {
            ...item,
            event
          };
        }
        return item;
      });
      
      res.json(convertedEvents);
    } catch (error) {
      console.error("Error fetching user attending events:", error);
      res.status(500).json({ message: "Failed to fetch attending events" });
    }
  });

  // Get events created by the authenticated user
  app.get("/api/user/events/created", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const createdEvents = await storage.getUserCreatedEvents(user.id);
      
      // Convert snake_case database fields to camelCase for frontend
      const convertedEvents = createdEvents.map((event: any) => {
        return {
          ...event,
          locationName: event.location_name,
          locationAddress: event.location_address,
          paymentType: event.payment_type,
          maxCapacity: event.max_capacity,
          privacyType: event.privacy_type,
          mainMediaUrl: event.main_media_url,
          mainMediaType: event.main_media_type,
          mediaItems: event.media_items,
          organizerId: event.organizer_id,
          createdAt: event.created_at,
          updatedAt: event.updated_at
        };
      }).map((event: any) => {
        // Clean up snake_case fields
        delete event.location_name;
        delete event.location_address;
        delete event.payment_type;
        delete event.max_capacity;
        delete event.privacy_type;
        delete event.main_media_url;
        delete event.main_media_type;
        delete event.media_items;
        delete event.organizer_id;
        delete event.created_at;
        delete event.updated_at;
        return event;
      });
      
      res.json(convertedEvents);
    } catch (error) {
      console.error("Error fetching user created events:", error);
      res.status(500).json({ message: "Failed to fetch created events" });
    }
  });

  // Get user interests
  app.get("/api/user/interests", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const interests = await storage.getUserInterests(user.id);
      res.json(interests);
    } catch (error) {
      console.error("Error fetching user interests:", error);
      res.status(500).json({ message: "Failed to fetch interests" });
    }
  });

  // Add user interest
  app.post("/api/user/interests", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { category } = req.body;
      
      if (!category) {
        return res.status(400).json({ message: "Category is required" });
      }

      // Check if interest already exists
      const existingInterests = await storage.getUserInterests(user.id);
      const hasInterest = existingInterests.some(interest => interest.category === category);
      
      if (hasInterest) {
        return res.status(400).json({ message: "Interest already exists" });
      }

      const newInterest = await storage.addUserInterest(user.id, category);
      res.json(newInterest);
    } catch (error) {
      console.error("Error adding user interest:", error);
      res.status(500).json({ message: "Failed to add interest" });
    }
  });

  // Remove user interest
  app.delete("/api/user/interests/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const interestId = parseInt(req.params.id);
      
      if (isNaN(interestId)) {
        return res.status(400).json({ message: "Invalid interest ID" });
      }

      // Verify the interest belongs to the user
      const userInterests = await storage.getUserInterests(user.id);
      const interestExists = userInterests.some(interest => interest.id === interestId);
      
      if (!interestExists) {
        return res.status(404).json({ message: "Interest not found" });
      }

      await storage.removeUserInterest(interestId);
      res.json({ message: "Interest removed successfully" });
    } catch (error) {
      console.error("Error removing user interest:", error);
      res.status(500).json({ message: "Failed to remove interest" });
    }
  });

  // WebSocket setup removed to prevent conflicts with Vite dev server

  // Google Maps proxy to avoid CORS issues
  app.get('/api/google-proxy/geocode/json', async (req, res) => {
    try {
      const { latlng, address, language, region, result_type, location_type } = req.query;
      
      if (!latlng && !address) {
        return res.status(400).json({ error: 'Missing latlng or address parameter' });
      }
      
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Google Maps API key not configured' });
      }
      
      // Build Google Maps API URL
      const params = new URLSearchParams({
        key: apiKey,
        language: String(language || 'es'),
        region: String(region || 'ar'),
      });
      
      if (latlng) {
        params.append('latlng', String(latlng));
      }
      if (address) {
        params.append('address', String(address));
      }
      if (result_type) params.append('result_type', String(result_type));
      if (location_type) params.append('location_type', String(location_type));
      
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
      
      // Fetch from Google Maps API
      const response = await fetch(googleUrl);
      const data = await response.json();
      
      // Return the response as JSON
      res.json(data);
    } catch (error) {
      console.error('Error in Google Maps proxy:', error);
      res.status(500).json({ error: 'Failed to fetch geocoding data' });
    }
  });

  // Google Places proxy for autocomplete search
  app.get('/api/google-proxy/place/autocomplete/json', async (req, res) => {
    try {
      const { input, location, radius, language, components } = req.query;
      
      if (!input) {
        return res.status(400).json({ error: 'Missing input parameter' });
      }
      
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Google Maps API key not configured' });
      }
      
      // Build Google Places API URL
      const params = new URLSearchParams({
        input: String(input),
        key: apiKey,
        language: String(language || 'es'),
        types: 'establishment|geocode',
      });
      
      if (location) params.append('location', String(location));
      if (radius) params.append('radius', String(radius));
      if (components) params.append('components', String(components));
      
      const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;
      
      // Fetch from Google Places API
      const response = await fetch(googleUrl);
      const data = await response.json();
      
      // Return the response as JSON
      res.json(data);
    } catch (error) {
      console.error('Error in Google Places proxy:', error);
      res.status(500).json({ error: 'Failed to fetch places data' });
    }
  });

  // Google Places details proxy
  app.get('/api/google-proxy/place/details/json', async (req, res) => {
    try {
      const { place_id, language, fields } = req.query;
      
      if (!place_id) {
        return res.status(400).json({ error: 'Missing place_id parameter' });
      }
      
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Google Maps API key not configured' });
      }
      
      // Build Google Places API URL
      const params = new URLSearchParams({
        place_id: String(place_id),
        key: apiKey,
        language: String(language || 'es'),
        fields: String(fields || 'name,formatted_address,geometry,place_id'),
      });
      
      const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;
      
      // Fetch from Google Places API
      const response = await fetch(googleUrl);
      const data = await response.json();
      
      // Return the response as JSON
      res.json(data);
    } catch (error) {
      console.error('Error in Google Places details proxy:', error);
      res.status(500).json({ error: 'Failed to fetch place details' });
    }
  });

  // Mapbox access token endpoint
  app.get('/api/mapbox-token', (req, res) => {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Mapbox access token not configured' });
    }
    res.json({ token });
  });

  // Google Maps API key endpoint for frontend
  app.get('/api/google-maps-key', (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key || key === 'GOOGLE_API_KEY') {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }
    res.json(key);
  });

  // Notification endpoints
  app.get("/api/notifications/count", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      
      // Count pending requests for events organized by this user
      const { data: pendingRequests, error } = await supabase
        .from('event_attendees')
        .select(`
          id, event_id,
          events!inner(organizer_id)
        `)
        .eq('status', 'pending')
        .eq('events.organizer_id', user.id);

      if (error) {
        console.error('Error fetching pending requests count:', error);
        return res.status(500).json({ message: 'Error fetching notifications' });
      }

      // Count unread notifications for this user
      const { data: unreadNotifications, error: notificationError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (notificationError) {
        console.error('Error fetching unread notifications count:', notificationError);
        return res.status(500).json({ message: 'Error fetching notifications' });
      }

      const pendingRequestsCount = pendingRequests?.length || 0;
      const unreadNotificationsCount = unreadNotifications?.length || 0;
      const totalCount = pendingRequestsCount + unreadNotificationsCount;

      res.json({ count: totalCount });
    } catch (error) {
      console.error('Error fetching notification count:', error);
      res.status(500).json({ message: 'Error fetching notifications' });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      
      console.log(`📖 Marking all notifications as read for user ${user.id}`);
      
      // Update all unread notifications for this user
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking notifications as read:', error);
        return res.status(500).json({ message: 'Error marking notifications as read' });
      }

      console.log(`✅ Successfully marked notifications as read for user ${user.id}`);
      res.json({ success: true, message: 'Notifications marked as read' });
    } catch (error) {
      console.error('Error in mark-all-read endpoint:', error);
      res.status(500).json({ message: 'Error marking notifications as read' });
    }
  });

  // Get all notifications (combined pending requests and user notifications)
  app.get("/api/notifications/all", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      
      console.log(`📋 Fetching all notifications for user ${user.id}`);
      
      // Get user notifications
      const { data: userNotifications, error: userNotificationsError } = await supabase
        .from('notifications')
        .select(`
          id, type, title, message, event_id, request_id, is_read, created_at,
          events(title)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (userNotificationsError) {
        console.error('Error fetching user notifications:', userNotificationsError);
        return res.status(500).json({ message: 'Error fetching notifications' });
      }

      // Get pending requests for events organized by this user
      const { data: pendingRequests, error: pendingError } = await supabase
        .from('event_attendees')
        .select(`
          id, event_id, user_id, status, created_at,
          events!inner(id, title, date, organizer_id),
          users(id, name, email, avatar)
        `)
        .eq('status', 'pending')
        .eq('events.organizer_id', user.id)
        .order('created_at', { ascending: false });

      if (pendingError) {
        console.error('Error fetching pending requests:', pendingError);
        return res.status(500).json({ message: 'Error fetching pending requests' });
      }

      // Format user notifications
      const formattedUserNotifications = (userNotifications || []).map(notif => ({
        type: 'user_notification',
        id: notif.id,
        notificationType: notif.type,
        title: notif.title,
        message: notif.message,
        eventId: notif.event_id,
        requestId: notif.request_id,
        isRead: notif.is_read,
        createdAt: notif.created_at,
        event: notif.events ? { title: (notif.events as any).title } : null
      }));

      // Format pending requests
      const formattedPendingRequests = (pendingRequests || []).map(req => ({
        type: 'pending_request',
        id: req.id,
        eventId: req.event_id,
        userId: req.user_id,
        status: req.status,
        createdAt: req.created_at,
        user: req.users ? {
          id: (req.users as any).id,
          name: (req.users as any).name,
          email: (req.users as any).email,
          avatar: (req.users as any).avatar
        } : null,
        event: req.events ? {
          id: (req.events as any).id,
          title: (req.events as any).title,
          date: (req.events as any).date
        } : null
      }));

      // Combine and sort by creation date
      const allNotifications = [...formattedUserNotifications, ...formattedPendingRequests]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      console.log(`📋 Found ${allNotifications.length} total notifications for user ${user.id}`);
      res.json({ notifications: allNotifications });
    } catch (error) {
      console.error('Error fetching all notifications:', error);
      res.status(500).json({ message: 'Error fetching notifications' });
    }
  });

  app.get("/api/notifications/pending-requests", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      console.log(`📋 Fetching pending requests for organizer ${user.id}`);
      
      // Simplified direct query to avoid storage function issues
      const { data: pendingRequests, error } = await supabase
        .from('event_attendees')
        .select(`
          id, event_id, user_id, status, created_at
        `)
        .eq('status', 'pending');
      
      if (error) {
        console.error('Error fetching pending requests from DB:', error);
        return res.status(500).json({ message: 'Error fetching pending requests' });
      }
      
      if (!pendingRequests || pendingRequests.length === 0) {
        console.log(`📋 No pending requests found`);
        return res.json({ requests: [] });
      }
      
      // Get event details for filtering by organizer
      const eventIds = Array.from(new Set(pendingRequests.map(req => req.event_id)));
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, title, date, organizer_id')
        .in('id', eventIds)
        .eq('organizer_id', user.id);
      
      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        return res.status(500).json({ message: 'Error fetching events' });
      }
      
      // Filter requests for events organized by this user
      const userEventIds = events?.map(e => e.id) || [];
      const filteredRequests = pendingRequests.filter(req => userEventIds.includes(req.event_id));
      
      if (filteredRequests.length === 0) {
        console.log(`📋 No pending requests found for organizer ${user.id}`);
        return res.json({ requests: [] });
      }
      
      // Get user details for each request
      const userIds = Array.from(new Set(filteredRequests.map(req => req.user_id)));
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, avatar')
        .in('id', userIds);
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
        return res.status(500).json({ message: 'Error fetching users' });
      }
      
      // Combine all data
      const requests = filteredRequests.map(req => {
        const event = events?.find(e => e.id === req.event_id);
        const reqUser = users?.find(u => u.id === req.user_id);
        
        return {
          id: req.id,
          eventId: req.event_id,
          userId: req.user_id,
          status: req.status,
          createdAt: req.created_at,
          applicationAnswers: null, // Column doesn't exist in Supabase yet
          user: reqUser,
          event: event
        };
      });

      console.log(`📋 Returning ${requests.length} pending requests for organizer ${user.id}`);
      res.json({ requests });
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      res.status(500).json({ message: 'Error fetching pending requests' });
    }
  });

  // Approve event request endpoint
  app.post("/api/events/approve-attendee", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { requestId } = req.body;

      if (!requestId) {
        return res.status(400).json({ message: 'Request ID is required' });
      }

      // Get the request details and verify organizer
      const { data: request, error: fetchError } = await supabase
        .from('event_attendees')
        .select(`
          id, event_id, user_id, status,
          events!inner(organizer_id)
        `)
        .eq('id', requestId)
        .eq('status', 'pending')
        .eq('events.organizer_id', user.id)
        .single();

      if (fetchError || !request) {
        return res.status(404).json({ message: 'Request not found or not authorized' });
      }

      // Update request status to approved
      const { error: updateError } = await supabase
        .from('event_attendees')
        .update({ 
          status: 'approved',
          payment_status: 'completed'
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Error approving request:', updateError);
        return res.status(500).json({ message: 'Error approving request' });
      }

      // Get event details for notification
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('title')
        .eq('id', request.event_id)
        .single();

      if (!eventError && eventData) {
        // Create notification for the user who requested to join
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: request.user_id,
            type: 'request_approved',
            title: 'Solicitud aprobada',
            message: `Tu solicitud para unirte a "${eventData.title}" ha sido aceptada`,
            event_id: request.event_id,
            request_id: requestId
          });

        if (notificationError) {
          console.error('Error creating notification:', notificationError);
        }
      }

      res.json({ message: 'Request approved successfully' });
    } catch (error) {
      console.error('Error approving request:', error);
      res.status(500).json({ message: 'Error approving request' });
    }
  });

  // Get all notifications for user (both pending requests and user notifications)
  app.get("/api/notifications/all", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      console.log(`📋 Fetching all notifications for user ${user.id}`);

      // Get pending requests for events organized by this user
      const { data: pendingRequests, error: pendingError } = await supabase
        .from('event_attendees')
        .select(`
          id, event_id, user_id, status, created_at
        `)
        .eq('status', 'pending');

      if (pendingError) {
        console.error('Error fetching pending requests:', pendingError);
        return res.status(500).json({ message: 'Error fetching notifications' });
      }

      // Filter and get event details for requests on events organized by this user
      let organizerRequests: any[] = [];
      if (pendingRequests && pendingRequests.length > 0) {
        const eventIds = Array.from(new Set(pendingRequests.map(req => req.event_id)));
        const { data: events, error: eventsError } = await supabase
          .from('events')
          .select('id, title, date, organizer_id')
          .in('id', eventIds)
          .eq('organizer_id', user.id);

        if (!eventsError && events) {
          const userEventIds = events.map(e => e.id);
          const filteredRequests = pendingRequests.filter(req => userEventIds.includes(req.event_id));

          if (filteredRequests.length > 0) {
            // Get user details for each request
            const userIds = Array.from(new Set(filteredRequests.map(req => req.user_id)));
            const { data: users, error: usersError } = await supabase
              .from('users')
              .select('id, name, email, avatar')
              .in('id', userIds);

            if (!usersError && users) {
              organizerRequests = filteredRequests.map(req => {
                const event = events.find(e => e.id === req.event_id);
                const reqUser = users.find(u => u.id === req.user_id);
                return {
                  type: 'pending_request',
                  id: req.id,
                  eventId: req.event_id,
                  userId: req.user_id,
                  status: req.status,
                  createdAt: req.created_at,
                  user: reqUser,
                  event: event
                };
              });
            }
          }
        }
      }

      // Get user notifications (approvals, rejections, etc.)
      const { data: userNotifications, error: notificationsError } = await supabase
        .from('notifications')
        .select(`
          id, type, title, message, event_id, request_id, is_read, created_at,
          events(title)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (notificationsError) {
        console.error('Error fetching user notifications:', notificationsError);
        return res.status(500).json({ message: 'Error fetching notifications' });
      }

      // Combine and format all notifications
      const allNotifications = [
        ...organizerRequests,
        ...(userNotifications || []).map(notif => ({
          type: 'user_notification',
          id: notif.id,
          notificationType: notif.type,
          title: notif.title,
          message: notif.message,
          eventId: notif.event_id,
          requestId: notif.request_id,
          isRead: notif.is_read,
          createdAt: notif.created_at,
          event: notif.events
        }))
      ];

      // Sort by creation date (newest first)
      allNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      console.log(`📋 Returning ${allNotifications.length} total notifications for user ${user.id}`);
      res.json({ notifications: allNotifications });
    } catch (error) {
      console.error('Error fetching all notifications:', error);
      res.status(500).json({ message: 'Error fetching notifications' });
    }
  });

  // Reject event request endpoint
  app.post("/api/events/reject-attendee", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { requestId } = req.body;

      if (!requestId) {
        return res.status(400).json({ message: 'Request ID is required' });
      }

      // Get the request details and verify organizer
      const { data: request, error: fetchError } = await supabase
        .from('event_attendees')
        .select(`
          id, event_id, user_id, status,
          events!inner(organizer_id)
        `)
        .eq('id', requestId)
        .eq('status', 'pending')
        .eq('events.organizer_id', user.id)
        .single();

      if (fetchError || !request) {
        return res.status(404).json({ message: 'Request not found or not authorized' });
      }

      // Update request status to rejected (or delete the record)
      const { error: updateError } = await supabase
        .from('event_attendees')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (updateError) {
        console.error('Error rejecting request:', updateError);
        return res.status(500).json({ message: 'Error rejecting request' });
      }

      res.json({ message: 'Request rejected successfully' });
    } catch (error) {
      console.error('Error rejecting request:', error);
      res.status(500).json({ message: 'Error rejecting request' });
    }
  });


  // Get user profile by ID
  app.get("/api/users/:userId", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get user profile from Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, username, bio, avatar, created_at')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ message: 'Error fetching user profile' });
    }
  });

  // Get user interests by user ID
  app.get("/api/users/:userId/interests", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get user interests from Supabase
      const { data: interests, error } = await supabase
        .from('user_interests')
        .select('category')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user interests:', error);
        return res.status(500).json({ message: 'Error fetching user interests' });
      }

      const interestsList = interests ? interests.map(i => i.category) : [];
      res.json({ interests: interestsList });
    } catch (error) {
      console.error('Error fetching user interests:', error);
      res.status(500).json({ message: 'Error fetching user interests' });
    }
  });

  // Get user aura (average rating)
  app.get("/api/users/:userId/aura", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get average rating for the user
      const { data: ratings, error } = await supabase
        .from('user_ratings')
        .select('rating')
        .eq('rated_user_id', userId);

      if (error) {
        console.error('Error fetching user ratings:', error);
        
        // If table doesn't exist, return default values (no ratings yet)
        if (error.message && error.message.includes('relation "public.user_ratings" does not exist')) {
          return res.json({ aura: 0, count: 0 });
        }
        
        return res.status(500).json({ message: 'Error fetching user aura' });
      }

      let aura = 0;
      let count = 0;

      if (ratings && ratings.length > 0) {
        const sum = ratings.reduce((acc, rating) => acc + rating.rating, 0);
        aura = sum / ratings.length;
        count = ratings.length;
      }

      res.json({ 
        aura: parseFloat(aura.toFixed(1)), 
        count 
      });
    } catch (error) {
      console.error('Error fetching user aura:', error);
      res.status(500).json({ message: 'Error fetching user aura' });
    }
  });

  // Check if current user can rate another user (have been in same event)
  app.get("/api/users/:userId/can-rate", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const targetUserId = parseInt(req.params.userId);
      
      if (isNaN(targetUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (user.id === targetUserId) {
        return res.json({ canRate: false, reason: "Cannot rate yourself" });
      }

      // First get events where current user was approved
      const { data: userEvents, error: userEventsError } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('status', 'approved');

      if (userEventsError || !userEvents || userEvents.length === 0) {
        return res.json({ canRate: false, reason: "You need to attend the same event to rate this user" });
      }

      const userEventIds = userEvents.map(e => e.event_id);

      // Check if target user was also approved in any of these events
      const { data: sharedEvents, error } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', targetUserId)
        .eq('status', 'approved')
        .in('event_id', userEventIds);

      if (error) {
        console.error('Error checking shared events:', error);
        return res.status(500).json({ message: 'Error checking rating eligibility' });
      }

      const canRate = sharedEvents && sharedEvents.length > 0;
      
      res.json({ 
        canRate,
        reason: canRate ? null : "You need to attend the same event to rate this user"
      });
    } catch (error) {
      console.error('Error checking rating eligibility:', error);
      res.status(500).json({ message: 'Error checking rating eligibility' });
    }
  });

  // Rate a user
  app.post("/api/users/:userId/rate", isAuthenticatedMiddleware, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const targetUserId = parseInt(req.params.userId);
      const { rating } = req.body;
      
      if (isNaN(targetUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (user.id === targetUserId) {
        return res.status(400).json({ message: "Cannot rate yourself" });
      }

      if (!rating || rating < 1 || rating > 10) {
        return res.status(400).json({ message: "Rating must be between 1 and 10" });
      }

      // First get events where current user was approved
      const { data: userEvents, error: userEventsError } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('status', 'approved');

      if (userEventsError || !userEvents || userEvents.length === 0) {
        return res.status(403).json({ 
          message: "You can only rate users you've attended events with" 
        });
      }

      const userEventIds = userEvents.map(e => e.event_id);

      // Check if target user was also approved in any of these events
      const { data: sharedEvents, error: checkError } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', targetUserId)
        .eq('status', 'approved')
        .in('event_id', userEventIds);

      if (checkError || !sharedEvents || sharedEvents.length === 0) {
        return res.status(403).json({ 
          message: "You can only rate users you've attended events with" 
        });
      }

      // Insert or update rating (upsert) - allow modifications anytime
      const { error: upsertError } = await supabase
        .from('user_ratings')
        .upsert({
          rated_user_id: targetUserId,
          rater_user_id: user.id,
          rating: rating,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'rated_user_id,rater_user_id'
        });

      if (upsertError) {
        console.error('Error saving rating:', upsertError);
        
        // If table doesn't exist, inform user that admin needs to create it
        if (upsertError.message && upsertError.message.includes('relation "public.user_ratings" does not exist')) {
          return res.status(503).json({ 
            message: 'Rating system is not available yet. Please contact administrator.' 
          });
        }
        
        return res.status(500).json({ message: 'Error saving rating' });
      }

      res.json({ message: 'Rating saved successfully' });
    } catch (error) {
      console.error('Error rating user:', error);
      res.status(500).json({ message: 'Error rating user' });
    }
  });

  // Serve static files
  app.use(express.static('public'));

  const httpServer = createServer(app);
  return httpServer;
}