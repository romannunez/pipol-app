import express, { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import passport from "passport";
import { loginUserSchema, insertUserSchema, insertEventSchema, insertEventAttendeeSchema } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    console.log("Auth check for", req.method, req.path, ": ", req.user ? "Authenticated" : "Not authenticated");
    
    if (req.user) {
      return next();
    }
    
    // Check session data for debugging
    console.log("Checking session data:", {
      sessionExists: !!req.session,
      sessionId: req.sessionID,
      cookieExists: !!req.headers.cookie
    });
    
    return res.status(401).json({ message: "Authentication required" });
  };

  // Auth routes
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

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const userId = await storage.insertUser({
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

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(500).json({ message: "Failed to create user" });
      }

      // Log the user in using req.login
      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Login failed after registration" });
        }
        
        // Store user data in session
        req.session.authenticated = true;
        req.session.userEmail = user.email;
        req.session.userId = user.id;
        req.session.supabaseUserId = user.supabaseId;
        
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
        
        // Store user data in session
        req.session.authenticated = true;
        req.session.userEmail = user.email;
        req.session.userId = user.id;
        req.session.supabaseUserId = user.supabaseId;
        
        return res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          bio: user.bio,
          avatar: user.avatar,
        });
      });
    })(req, res, next);
  });

  // Get current user
  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticatedMiddleware && !req.user) {
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

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    if (!req.isAuthenticatedMiddleware) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;

    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }

      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destroy error:", destroyErr);
          return res.status(500).json({ message: "Session cleanup failed" });
        }

        res.clearCookie('connect.sid');
        return res.json({ message: "Logged out successfully" });
      });
    });
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
  ], async (req, res) => {
    try {
      const user = req.user as any;
      const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};
      
      // Build event data
      const eventData = {
        ...req.body,
        organizerId: user.id,
        latitude: typeof req.body.latitude === 'number' ? req.body.latitude : parseFloat(req.body.latitude),
        longitude: typeof req.body.longitude === 'number' ? req.body.longitude : parseFloat(req.body.longitude),
        maxCapacity: req.body.maxCapacity ? parseInt(req.body.maxCapacity) : null,
        price: req.body.price ? parseFloat(req.body.price) : null,
      };

      // Process media items
      let mediaItems: any[] = [];
      let mainMediaUrl = '';
      let mainMediaType = 'photo';

      // Parse mediaItems if provided
      if (req.body.mediaItems) {
        try {
          const parsedItems = JSON.parse(req.body.mediaItems);
          if (Array.isArray(parsedItems)) {
            mediaItems = parsedItems;
          }
        } catch (e) {
          console.warn("Could not parse mediaItems:", e);
        }
      }

      // Process uploaded files
      Object.keys(files).forEach((fieldName, index) => {
        const fileArray = files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          const mediaPath = file.path.replace('public', '');
          const isVideo = file.mimetype.startsWith('video/');
          
          interface MediaItem {
            type: string;
            url: string;
            order: number;
            isMain?: boolean;
          }
          
          const mediaItem: MediaItem = {
            type: isVideo ? 'video' : 'photo',
            url: mediaPath,
            order: mediaItems.length + index,
            isMain: fieldName === 'mainMediaFile' || index === 0
          };
          
          mediaItems.push(mediaItem);
          
          if (mediaItem.isMain || mainMediaUrl === '') {
            mainMediaUrl = mediaPath;
            mainMediaType = mediaItem.type;
          }
        }
      });

      // Set main media
      if (mainMediaUrl) {
        eventData.mainMediaUrl = mainMediaUrl;
        eventData.mainMediaType = mainMediaType;
      }

      // Set media items JSON
      if (mediaItems.length > 0) {
        eventData.mediaItems = JSON.stringify(mediaItems);
      }

      const eventId = await storage.insertEvent(eventData);
      const newEvent = await storage.getEventById(eventId);

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
  ], async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      
      // Check if event exists
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check authorization
      if (parseInt(event.organizerId.toString()) !== parseInt(user.id.toString())) {
        return res.status(403).json({ message: "Not authorized to update this event" });
      }
      
      const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};
      const updateData: any = { ...req.body };
      
      // Parse existing mediaItems
      let mediaItems: any[] = [];
      if (event.mediaItems) {
        try {
          mediaItems = JSON.parse(event.mediaItems);
        } catch (e) {
          console.warn("Could not parse existing mediaItems:", e);
          mediaItems = [];
        }
      }

      // Parse client mediaItems if provided
      let clientMediaItems: any[] = [];
      if (req.body.mediaItems) {
        try {
          clientMediaItems = JSON.parse(req.body.mediaItems);
        } catch (e) {
          console.warn("Could not parse client mediaItems:", e);
          clientMediaItems = [];
        }
      }

      // Process uploaded files
      Object.keys(files).forEach((fieldName, index) => {
        const fileArray = files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          const mediaPath = file.path.replace('public', '');
          const isVideo = file.mimetype.startsWith('video/');
          
          interface MediaItem {
            type: string;
            url: string;
            order: number;
            isMain?: boolean;
          }
          
          const mediaItem: MediaItem = {
            type: isVideo ? 'video' : 'photo',
            url: mediaPath,
            order: mediaItems.length + index,
            isMain: fieldName === 'mainMediaFile'
          };
          
          mediaItems.push(mediaItem);
        }
      });

      // Process client mediaItems with URL preservation
      if (clientMediaItems.length > 0) {
        // Map client items to preserve existing URLs
        const updatedMediaItems = clientMediaItems.map((clientItem: any, index: number) => {
          // Find matching existing item by order or type
          const existingItem = mediaItems.find((existing: any) => 
            existing.order === clientItem.order || 
            (existing.type === clientItem.type && existing.order === index)
          );
          
          return {
            type: clientItem.type || 'photo',
            url: clientItem.url || existingItem?.url || '',
            order: clientItem.order !== undefined ? clientItem.order : index,
            isMain: clientItem.isMain === true
          };
        }).filter((item: any) => item.url); // Only keep items with valid URLs
        
        if (updatedMediaItems.length > 0) {
          mediaItems = updatedMediaItems;
        }
      }

      // Set main media from the first item marked as main
      const mainItem = mediaItems.find((item: any) => item.isMain);
      if (mainItem) {
        updateData.mainMediaUrl = mainItem.url;
        updateData.mainMediaType = mainItem.type;
      }

      // Update mediaItems JSON
      if (mediaItems.length > 0) {
        updateData.mediaItems = JSON.stringify(mediaItems);
      }

      await storage.updateEvent(eventId, updateData);
      const updatedEvent = await storage.getEventById(eventId);

      res.json(updatedEvent);
    } catch (error) {
      console.error("Event update error:", error);
      res.status(500).json({ message: "Failed to update event" });
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
      
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Get event by ID
  app.get("/api/events/:id", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
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

  // Delete event
  app.delete("/api/events/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      if (event.organizerId !== user.id) {
        return res.status(403).json({ message: "Not authorized to delete this event" });
      }
      
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
      
      const attendeeId = await storage.insertEventAttendee(attendeeData);
      const attendee = await storage.getEventAttendeeById(attendeeId);
      
      res.status(201).json(attendee);
    } catch (error) {
      console.error("Error attending event:", error);
      res.status(500).json({ message: "Failed to attend event" });
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

  // WebSocket setup
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Map<string, { ws: WebSocket, userId: number, userName: string }>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket connection established');
    
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'join' && data.userId && data.userName) {
          const clientId = Math.random().toString(36);
          clients.set(clientId, { ws, userId: data.userId, userName: data.userName });
          console.log(`User ${data.userName} joined WebSocket`);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      for (const [clientId, client] of clients.entries()) {
        if (client.ws === ws) {
          clients.delete(clientId);
          break;
        }
      }
    });
  });

  // Serve static files
  app.use(express.static('public'));

  return httpServer;
}