var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express4 from "express";
import session from "express-session";
import cookieParser from "cookie-parser";

// server/routes.ts
import express from "express";
import { createServer } from "http";

// server/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  attendeeStatusEnum: () => attendeeStatusEnum,
  eventAttendees: () => eventAttendees,
  eventAttendeesRelations: () => eventAttendeesRelations,
  eventCategoryEnum: () => eventCategoryEnum,
  events: () => events,
  eventsRelations: () => eventsRelations,
  insertEventAttendeeSchema: () => insertEventAttendeeSchema,
  insertEventSchema: () => insertEventSchema,
  insertUserSchema: () => insertUserSchema,
  loginUserSchema: () => loginUserSchema,
  multimediaTypeEnum: () => multimediaTypeEnum,
  paymentTypeEnum: () => paymentTypeEnum,
  privacyTypeEnum: () => privacyTypeEnum,
  privateAccessTypeEnum: () => privateAccessTypeEnum,
  userInterests: () => userInterests,
  userInterestsRelations: () => userInterestsRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { pgTable, text, serial, integer, timestamp, decimal, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
var eventCategoryEnum = pgEnum("event_category", [
  "social",
  "music",
  "spiritual",
  "education",
  "sports",
  "food",
  "art",
  "technology",
  "games",
  "outdoor",
  "networking",
  "workshop",
  "conference",
  "party",
  "fair",
  "exhibition"
]);
var privacyTypeEnum = pgEnum("privacy_type", ["public", "private"]);
var privateAccessTypeEnum = pgEnum("private_access_type", ["solicitud", "postulacion", "paga"]);
var paymentTypeEnum = pgEnum("payment_type", ["free", "paid"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password"),
  // No longer required with Supabase auth
  name: text("name").notNull(),
  bio: text("bio"),
  avatar: text("avatar"),
  supabaseId: text("supabase_id").unique(),
  // Add Supabase user ID reference
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var multimediaTypeEnum = pgEnum("multimedia_type", ["photo", "video"]);
var events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: eventCategoryEnum("category").notNull(),
  date: timestamp("date").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 6 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 6 }).notNull(),
  locationName: text("location_name").notNull(),
  locationAddress: text("location_address").notNull(),
  paymentType: paymentTypeEnum("payment_type").notNull().default("free"),
  price: decimal("price", { precision: 10, scale: 2 }),
  maxCapacity: integer("max_capacity"),
  privacyType: privacyTypeEnum("privacy_type").notNull().default("public"),
  mediaItems: text("media_items"),
  mainMediaType: text("main_media_type"),
  mainMediaUrl: text("main_media_url"),
  organizerId: integer("organizer_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var attendeeStatusEnum = pgEnum("attendee_status", ["pending", "approved", "rejected"]);
var eventAttendees = pgTable("event_attendees", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  status: attendeeStatusEnum("status").default("approved").notNull(),
  paymentStatus: text("payment_status").default("pending"),
  paymentIntentId: text("payment_intent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var userInterests = pgTable("user_interests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  category: eventCategoryEnum("category").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var usersRelations = relations(users, ({ many }) => ({
  organizedEvents: many(events, { relationName: "organizer" }),
  attendedEvents: many(eventAttendees, { relationName: "attendee" }),
  interests: many(userInterests)
}));
var eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, { fields: [events.organizerId], references: [users.id], relationName: "organizer" }),
  attendees: many(eventAttendees)
}));
var eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(events, { fields: [eventAttendees.eventId], references: [events.id] }),
  user: one(users, { fields: [eventAttendees.userId], references: [users.id], relationName: "attendee" })
}));
var userInterestsRelations = relations(userInterests, ({ one }) => ({
  user: one(users, { fields: [userInterests.userId], references: [users.id] })
}));
var insertUserSchema = createInsertSchema(users, {
  email: (schema) => schema.email("Direcci\xF3n de correo electr\xF3nico inv\xE1lida"),
  password: (schema) => schema.min(6, "La contrase\xF1a debe tener al menos 6 caracteres"),
  username: (schema) => schema.min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  name: (schema) => schema.min(2, "El nombre debe tener al menos 2 caracteres")
});
var loginUserSchema = z.object({
  email: z.string().email("Direcci\xF3n de correo electr\xF3nico inv\xE1lida"),
  password: z.string().min(6, "La contrase\xF1a debe tener al menos 6 caracteres")
});
var insertEventSchema = z.object({
  title: z.string().min(3, "El t\xEDtulo debe tener al menos 3 caracteres"),
  description: z.string().min(10, "La descripci\xF3n debe tener al menos 10 caracteres"),
  category: z.enum(eventCategoryEnum.enumValues),
  date: z.string().or(z.date()).transform(
    (val) => typeof val === "string" ? new Date(val) : val
  ),
  latitude: z.string().or(z.number()).transform(
    (val) => typeof val === "string" ? parseFloat(val) : val
  ),
  longitude: z.string().or(z.number()).transform(
    (val) => typeof val === "string" ? parseFloat(val) : val
  ),
  locationName: z.string().min(3, "El nombre del lugar debe tener al menos 3 caracteres"),
  locationAddress: z.string().min(5, "La direcci\xF3n debe tener al menos 5 caracteres"),
  paymentType: z.enum(paymentTypeEnum.enumValues).default("free"),
  price: z.string().or(z.number()).transform(
    (val) => typeof val === "string" ? parseFloat(val) || 0 : val
  ).optional().nullable(),
  maxCapacity: z.string().or(z.number()).transform(
    (val) => typeof val === "string" ? parseFloat(val) || null : val
  ).optional().nullable(),
  privacyType: z.enum(privacyTypeEnum.enumValues).default("public"),
  privateAccessType: z.enum(privateAccessTypeEnum.enumValues).optional().nullable(),
  applicationQuestions: z.string().optional().nullable(),
  // JSON string for questions
  // Campos existentes (mantenidos por compatibilidad)
  photoUrl: z.string().optional().nullable(),
  photoUrls: z.string().optional().nullable(),
  // Almacenar array como JSON string
  videoUrl: z.string().optional().nullable(),
  videoUrls: z.string().optional().nullable(),
  // Nuevos campos para multimedia
  mediaItems: z.string().optional().nullable(),
  // Array JSON de items multimedia
  mainMediaType: z.enum(multimediaTypeEnum.enumValues).optional().default("photo"),
  mainMediaUrl: z.string().optional().nullable(),
  organizerId: z.number()
});
var insertEventAttendeeSchema = createInsertSchema(eventAttendees);

// server/db.ts
import dotenv from "dotenv";
dotenv.config();
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Database should be provisioned.");
  process.exit(1);
}
var connectionString = process.env.DATABASE_URL;
console.log("Connecting to database...");
var client = postgres(connectionString, {
  max: 10,
  // Connection pool size
  idle_timeout: 20,
  // How long a connection can be idle before being removed
  connect_timeout: 10,
  // Connection timeout
  ssl: "require"
  // Enable SSL for database connection
});
var db = drizzle(client, { schema: schema_exports });

// server/storage.ts
import { eq, and, desc } from "drizzle-orm";
var getUserById = async (id) => {
  return db.query.users.findFirst({
    where: eq(users.id, id)
  });
};
var getUserByEmail = async (email) => {
  return db.query.users.findFirst({
    where: eq(users.email, email)
  });
};
var getUserByUsername = async (username) => {
  return db.query.users.findFirst({
    where: eq(users.username, username)
  });
};
var getUserBySupabaseId = async (supabaseId) => {
  return db.query.users.findFirst({
    where: eq(users.supabaseId, supabaseId)
  });
};
var insertUser = async (user) => {
  const [newUser] = await db.insert(users).values(user).returning();
  return newUser;
};
var updateUser = async (id, userData) => {
  const [updatedUser] = await db.update(users).set({ ...userData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
  return updatedUser;
};
var updateStripeCustomerId = async (userId, stripeCustomerId) => {
  const [updatedUser] = await db.update(users).set({
    stripeCustomerId,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq(users.id, userId)).returning();
  return updatedUser;
};
var updateUserStripeInfo = async (userId, stripeInfo) => {
  const [updatedUser] = await db.update(users).set({
    stripeCustomerId: stripeInfo.stripeCustomerId,
    stripeSubscriptionId: stripeInfo.stripeSubscriptionId,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq(users.id, userId)).returning();
  return updatedUser;
};
var getEventById = async (id) => {
  return db.query.events.findFirst({
    where: eq(events.id, id),
    with: {
      organizer: true,
      attendees: {
        with: {
          user: true
        }
      }
    }
  });
};
var getEvents = async (filters) => {
  try {
    let query = db.query.events.findMany({
      with: {
        organizer: true,
        attendees: {
          with: {
            user: true
          }
        }
      },
      orderBy: desc(events.date)
    });
    return query;
  } catch (error) {
    if (error.code === "42P01" && error.message.includes("event_attendees")) {
      console.log("Warning: event_attendees table missing, querying events without attendees");
      let query = db.query.events.findMany({
        with: {
          organizer: true
        },
        orderBy: desc(events.date)
      });
      return query;
    }
    throw error;
  }
};
var getNearbyEvents = async (lat, lng, radius = 10) => {
  let allEvents;
  try {
    allEvents = await db.query.events.findMany({
      with: {
        organizer: true,
        attendees: {
          limit: 5,
          with: {
            user: true
          }
        }
      },
      orderBy: desc(events.date)
    });
  } catch (error) {
    if (error.code === "42P01" && error.message.includes("event_attendees")) {
      console.log("Warning: event_attendees table missing, querying nearby events without attendees");
      allEvents = await db.query.events.findMany({
        with: {
          organizer: true
        },
        orderBy: desc(events.date)
      });
    } else {
      throw error;
    }
  }
  return allEvents.filter((event) => {
    const eventLat = parseFloat(event.latitude.toString());
    const eventLng = parseFloat(event.longitude.toString());
    const R = 6371;
    const dLat = (lat - eventLat) * Math.PI / 180;
    const dLng = (lng - eventLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(eventLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance <= radius;
  });
};
var insertEvent = async (event) => {
  try {
    console.log("Insertando evento en DB:", JSON.stringify(event));
    const eventData = {
      title: event.title,
      description: event.description,
      category: event.category,
      date: event.date instanceof Date ? event.date : new Date(event.date),
      latitude: event.latitude.toString(),
      longitude: event.longitude.toString(),
      locationName: event.locationName,
      locationAddress: event.locationAddress,
      paymentType: event.paymentType || "free",
      price: event.price ? event.price.toString() : null,
      maxCapacity: event.maxCapacity,
      privacyType: event.privacyType || "public",
      mediaItems: event.mediaItems,
      mainMediaType: event.mainMediaType,
      mainMediaUrl: event.mainMediaUrl,
      organizerId: parseInt(event.organizerId.toString())
    };
    console.log("Datos formateados para DB:", JSON.stringify(eventData));
    const [newEvent] = await db.insert(events).values(eventData).returning();
    console.log("Evento creado exitosamente:", JSON.stringify(newEvent));
    return newEvent;
  } catch (error) {
    console.error("Error al insertar evento en la base de datos:", error);
    throw error;
  }
};
var updateEvent = async (id, eventData) => {
  console.log("Actualizando evento en la base de datos. ID:", id);
  console.log("Datos de multimedia a guardar:");
  console.log("- mediaItems:", eventData.mediaItems);
  console.log("- mainMediaType:", eventData.mainMediaType);
  console.log("- mainMediaUrl:", eventData.mainMediaUrl);
  if (eventData.mediaItems) {
    try {
      const mediaItems = JSON.parse(eventData.mediaItems);
      const mainItem = mediaItems.find((item) => item && item.isMain === true);
      if (mainItem) {
        console.log("Encontrado elemento principal en mediaItems:", {
          tipo: mainItem.type,
          url: mainItem.url
        });
        if (mainItem.type && mainItem.url) {
          if (eventData.mainMediaType !== mainItem.type) {
            console.log(`Corrigiendo mainMediaType para que coincida con mediaItems: ${mainItem.type}`);
            eventData.mainMediaType = mainItem.type;
          }
          if (eventData.mainMediaUrl !== mainItem.url) {
            console.log(`Corrigiendo mainMediaUrl para que coincida con mediaItems: ${mainItem.url}`);
            eventData.mainMediaUrl = mainItem.url;
          }
        }
      }
    } catch (error) {
      console.error("Error al parsear mediaItems para verificar coherencia:", error);
    }
  }
  if (eventData.mainMediaType && Array.isArray(eventData.mainMediaType)) {
    const firstType = eventData.mainMediaType[0] || "photo";
    console.log(`Corrigiendo mainMediaType de array a string: \u2192 ${firstType}`);
    eventData.mainMediaType = firstType;
  }
  const updateTimestamp = /* @__PURE__ */ new Date();
  const [updatedEvent] = await db.update(events).set({
    ...eventData,
    updatedAt: updateTimestamp
  }).where(eq(events.id, id)).returning();
  console.log("Evento actualizado correctamente.");
  const verifiedEvent = await getEventById(id);
  if (verifiedEvent) {
    console.log("Verificaci\xF3n despu\xE9s de actualizar:");
    console.log("- mediaItems almacenados:", verifiedEvent.mediaItems);
    console.log("- mainMediaType almacenado:", verifiedEvent.mainMediaType);
    console.log("- mainMediaUrl almacenado:", verifiedEvent.mainMediaUrl);
  }
  return updatedEvent;
};
var deleteEvent = async (id) => {
  await db.delete(eventAttendees).where(eq(eventAttendees.eventId, id));
  const [deletedEvent] = await db.delete(events).where(eq(events.id, id)).returning();
  return deletedEvent;
};
var deleteAllEvents = async () => {
  try {
    await db.delete(eventAttendees);
    await db.delete(events);
    console.log("All events and attendees deleted successfully");
    return { message: "All events and attendees deleted successfully" };
  } catch (error) {
    console.error("Error deleting all events:", error);
    throw error;
  }
};
var joinEvent = async (attendee) => {
  const [newAttendee] = await db.insert(eventAttendees).values(attendee).returning();
  return newAttendee;
};
var leaveEvent = async (eventId, userId) => {
  const [removedAttendee] = await db.delete(eventAttendees).where(
    and(
      eq(eventAttendees.eventId, eventId),
      eq(eventAttendees.userId, userId)
    )
  ).returning();
  return removedAttendee;
};
var getEventAttendees = async (eventId) => {
  return db.query.eventAttendees.findMany({
    where: eq(eventAttendees.eventId, eventId),
    with: {
      user: true
    }
  });
};
var getEventAttendee = async (eventId, userId) => {
  return db.query.eventAttendees.findFirst({
    where: and(
      eq(eventAttendees.eventId, eventId),
      eq(eventAttendees.userId, userId)
    )
  });
};
var updateEventAttendee = async (id, attendeeData) => {
  const [updatedAttendee] = await db.update(eventAttendees).set(attendeeData).where(eq(eventAttendees.id, id)).returning();
  return updatedAttendee;
};
var insertEventAttendee = async (attendeeData) => {
  const [newAttendee] = await db.insert(eventAttendees).values(attendeeData).returning();
  return newAttendee;
};
var getEventAttendeeById = async (id) => {
  return db.query.eventAttendees.findFirst({
    where: eq(eventAttendees.id, id),
    with: {
      user: true,
      event: true
    }
  });
};
var updatePaymentStatus = async (eventId, userId, paymentStatus, paymentIntentId) => {
  const [updatedAttendee] = await db.update(eventAttendees).set({
    paymentStatus,
    paymentIntentId
  }).where(
    and(
      eq(eventAttendees.eventId, eventId),
      eq(eventAttendees.userId, userId)
    )
  ).returning();
  return updatedAttendee;
};
var getUserCreatedEvents = async (userId) => {
  return db.query.events.findMany({
    where: eq(events.organizerId, userId),
    with: {
      attendees: true
    },
    orderBy: desc(events.date)
  });
};
var getUserAttendingEvents = async (userId) => {
  return db.query.eventAttendees.findMany({
    where: eq(eventAttendees.userId, userId),
    with: {
      event: {
        with: {
          organizer: true
        }
      }
    },
    orderBy: desc(eventAttendees.createdAt)
  });
};
var getUserInterests = async (userId) => {
  return db.query.userInterests.findMany({
    where: eq(userInterests.userId, userId),
    orderBy: desc(userInterests.createdAt)
  });
};
var addUserInterest = async (userId, category) => {
  const [interest] = await db.insert(userInterests).values([{
    userId,
    category
  }]).returning();
  return interest;
};
var removeUserInterest = async (interestId) => {
  await db.delete(userInterests).where(eq(userInterests.id, interestId));
};
var storage = {
  getUserById,
  getUserByEmail,
  getUserByUsername,
  getUserBySupabaseId,
  insertUser,
  updateUser,
  updateStripeCustomerId,
  updateUserStripeInfo,
  getEventById,
  getEvents,
  getNearbyEvents,
  insertEvent,
  updateEvent,
  deleteEvent,
  deleteAllEvents,
  joinEvent,
  leaveEvent,
  getEventAttendees,
  getEventAttendee,
  insertEventAttendee,
  getEventAttendeeById,
  updateEventAttendee,
  updatePaymentStatus,
  getUserCreatedEvents,
  getUserAttendingEvents,
  getUserInterests,
  addUserInterest,
  removeUserInterest
};

// server/routes.ts
import bcrypt from "bcrypt";
import passport from "passport";
import multer from "multer";
import path from "path";
import fs from "fs";
if (!process.env.SESSION_SECRET) {
  console.warn("No SESSION_SECRET provided, using default secret. This is insecure!");
}
console.log("Payment functionality is disabled in this version of the app.");
var storage_uploads = multer.diskStorage({
  destination: function(req, file, cb) {
    let uploadPath = "public/uploads/events";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, "event-" + uniqueSuffix + extension);
  }
});
var fileFilter = (req, file, cb) => {
  console.log(`Procesando archivo: ${file.fieldname}, tipo: ${file.mimetype}`);
  const isMainMedia = file.fieldname === "mainMediaFile";
  const isEventPhoto = file.fieldname === "eventPhoto";
  const isEventVideo = file.fieldname === "eventVideo";
  const isMediaFile = file.fieldname.startsWith("mediaFile_");
  const isPhotos = file.fieldname === "photos";
  const isVideos = file.fieldname === "videos";
  const isEventPhotos = file.fieldname === "eventPhotos";
  const isEventVideos = file.fieldname === "eventVideos";
  const isImage = file.mimetype.startsWith("image/");
  const isVideo = file.mimetype.startsWith("video/");
  const allowedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const allowedVideoTypes = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo"];
  const isValidImageType = allowedImageTypes.includes(file.mimetype);
  const isValidVideoType = allowedVideoTypes.includes(file.mimetype);
  if (!isValidImageType && !isValidVideoType) {
    console.log(`Archivo rechazado por tipo no v\xE1lido: ${file.mimetype}`);
    return cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
  }
  if ((isEventPhoto || isPhotos || isEventPhotos) && !isImage) {
    return cb(new Error("Solo se permiten im\xE1genes para campos de fotos"));
  }
  if ((isEventVideo || isVideos || isEventVideos) && !isVideo) {
    return cb(new Error("Solo se permiten videos para campos de video"));
  }
  console.log(`Archivo aceptado: ${file.fieldname} (${file.mimetype})`);
  cb(null, true);
};
async function registerRoutes(app2) {
  const httpServer = createServer(app2);
  const isAuthenticated = async (req, res, next) => {
    console.log("Auth check for", req.method, req.path, ": ", req.user ? "Authenticated" : "Not authenticated");
    if (req.user) {
      return next();
    }
    if (req.session && req.session.passport && req.session.passport.user) {
      console.log("Found user in session, attempting to deserialize user ID:", req.session.passport.user);
      try {
        const userId = req.session.passport.user;
        const user = await storage.getUserById(parseInt(userId));
        if (user) {
          console.log("Manual deserialization successful:", user.id, user.name);
          req.user = user;
          return next();
        } else {
          console.log("User not found in database during manual deserialization");
        }
      } catch (error) {
        console.error("Error during manual deserialization:", error);
      }
    }
    console.log("Checking session data:", {
      sessionExists: !!req.session,
      sessionId: req.sessionID,
      cookieExists: !!req.headers.cookie,
      passportSession: !!(req.session && req.session.passport),
      passportUser: req.session && req.session.passport ? req.session.passport.user : null
    });
    return res.status(401).json({ message: "Authentication required" });
  };
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid user data", errors: result.error.errors });
      }
      const { username, email, password, name, bio } = result.data;
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
      const user = await storage.insertUser({
        username,
        email,
        password: hashedPassword,
        name,
        bio: bio || null,
        avatar: null,
        supabaseId: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null
      });
      if (!user) {
        return res.status(500).json({ message: "Failed to create user" });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Login failed after registration" });
        }
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
          avatar: user.avatar
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/auth/login", (req, res, next) => {
    const result = loginUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid login data", errors: result.error.errors });
    }
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("Authentication error:", err);
        return res.status(500).json({ message: "Authentication failed" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err2) => {
        if (err2) {
          console.error("Login error:", err2);
          return res.status(500).json({ message: "Login failed" });
        }
        req.session.authenticated = true;
        req.session.userEmail = user.email;
        req.session.userId = user.id;
        req.session.supabaseUserId = user.supabaseId;
        req.session.save((err3) => {
          if (err3) {
            console.error("Session save error:", err3);
          }
          return res.json({
            message: "Login successful",
            user: {
              id: user.id.toString(),
              email: user.email,
              username: user.username,
              name: user.name
            },
            token: user.supabaseToken || "",
            refreshToken: user.supabaseRefreshToken || "",
            sessionId: req.sessionID
          });
        });
      });
    })(req, res, next);
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      req.session.destroy((err2) => {
        if (err2) {
          console.error("Session destroy error:", err2);
          return res.status(500).json({ message: "Session cleanup failed" });
        }
        res.clearCookie("pipol_session");
        res.clearCookie("connect.sid");
        return res.json({ message: "Logged out successfully" });
      });
    });
  });
  app2.get("/api/auth/me", isAuthenticated, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const user = req.user;
    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      bio: user.bio,
      avatar: user.avatar
    });
  });
  app2.post("/api/auth/logout", (req, res) => {
    const user = req.user;
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
        res.clearCookie("connect.sid");
        return res.json({ message: "Logged out successfully" });
      });
    });
  });
  app2.post("/api/events", [
    isAuthenticated,
    multer({
      storage: storage_uploads,
      fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024,
        // 10MB limit
        files: 12
        // Max 12 files total (mainMediaFile + up to 11 additional media files)
      }
    }).fields([
      { name: "mainMediaFile", maxCount: 1 },
      { name: "eventPhoto", maxCount: 1 },
      { name: "eventVideo", maxCount: 1 },
      { name: "photos", maxCount: 6 },
      { name: "videos", maxCount: 3 },
      { name: "eventPhotos", maxCount: 6 },
      { name: "eventVideos", maxCount: 3 },
      { name: "mediaFile_0", maxCount: 1 },
      { name: "mediaFile_1", maxCount: 1 },
      { name: "mediaFile_2", maxCount: 1 },
      { name: "mediaFile_3", maxCount: 1 },
      { name: "mediaFile_4", maxCount: 1 },
      { name: "mediaFile_5", maxCount: 1 },
      { name: "mediaFile_6", maxCount: 1 },
      { name: "mediaFile_7", maxCount: 1 },
      { name: "mediaFile_8", maxCount: 1 },
      { name: "mediaFile_9", maxCount: 1 }
    ])
  ], async (req, res) => {
    try {
      const user = req.user;
      const files = req.files || {};
      const eventData = {
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
        organizerId: parseInt(user.id.toString()),
        maxCapacity: req.body.maxCapacity ? parseInt(req.body.maxCapacity) : null,
        price: req.body.price ? parseFloat(req.body.price) : null,
        mainMediaUrl: null,
        mainMediaType: "photo",
        mediaItems: null
      };
      let mediaItems = [];
      let mainMediaUrl = "";
      let mainMediaType = "photo";
      let existingMediaStructure = [];
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
      let fileIndex = 0;
      Object.keys(files).forEach((fieldName) => {
        const fileArray = files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          const mediaPath = file.path.replace("public", "");
          const isVideo = file.mimetype.startsWith("video/");
          let targetItem = null;
          if (fieldName === "mainMediaFile") {
            targetItem = existingMediaStructure.find((item) => item.isMain);
          } else if (fieldName.startsWith("mediaFile_")) {
            const mediaFileIndex = parseInt(fieldName.split("_")[1]);
            targetItem = existingMediaStructure.find((item) => !item.url && item.order === mediaFileIndex);
            if (!targetItem) {
              targetItem = existingMediaStructure.filter((item) => !item.url)[mediaFileIndex];
            }
          }
          const mediaItem = {
            type: isVideo ? "video" : "photo",
            url: mediaPath,
            order: targetItem ? targetItem.order : fileIndex,
            isMain: targetItem ? targetItem.isMain : fieldName === "mainMediaFile" || fileIndex === 0
          };
          mediaItems.push(mediaItem);
          if (mediaItem.isMain || mainMediaUrl === "") {
            mainMediaUrl = mediaPath;
            mainMediaType = mediaItem.type;
          }
          fileIndex++;
        }
      });
      existingMediaStructure.forEach((item) => {
        if (item.url && item.url.trim() !== "") {
          const existsInUploads = mediaItems.some((mediaItem) => mediaItem.url === item.url);
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
      let finalMainMediaUrl = null;
      let finalMainMediaType = "photo";
      if (mediaItems.length > 0) {
        const explicitMain = mediaItems.find(
          (item) => item && item.isMain === true && item.url && item.url.trim() !== ""
        );
        if (explicitMain) {
          finalMainMediaUrl = explicitMain.url;
          finalMainMediaType = explicitMain.type || "photo";
        } else {
          const firstValid = mediaItems.find(
            (item) => item && item.url && item.url.trim() !== ""
          );
          if (firstValid) {
            finalMainMediaUrl = firstValid.url;
            finalMainMediaType = firstValid.type || "photo";
            mediaItems = mediaItems.map((item) => ({
              ...item,
              isMain: item === firstValid
            }));
          }
        }
      }
      eventData.mainMediaUrl = finalMainMediaUrl;
      eventData.mainMediaType = finalMainMediaType;
      eventData.mediaItems = mediaItems.length > 0 ? JSON.stringify(mediaItems) : null;
      const newEvent = await storage.insertEvent(eventData);
      res.status(201).json(newEvent);
    } catch (error) {
      console.error("Event creation error:", error);
      res.status(500).json({ message: "Failed to create event" });
    }
  });
  app2.patch("/api/events/:id", [
    isAuthenticated,
    multer({
      storage: storage_uploads,
      fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 12
      }
    }).fields([
      { name: "mainMediaFile", maxCount: 1 },
      { name: "eventPhoto", maxCount: 1 },
      { name: "eventVideo", maxCount: 1 },
      { name: "photos", maxCount: 6 },
      { name: "videos", maxCount: 3 },
      { name: "eventPhotos", maxCount: 6 },
      { name: "eventVideos", maxCount: 3 },
      { name: "mediaFile_0", maxCount: 1 },
      { name: "mediaFile_1", maxCount: 1 },
      { name: "mediaFile_2", maxCount: 1 },
      { name: "mediaFile_3", maxCount: 1 },
      { name: "mediaFile_4", maxCount: 1 },
      { name: "mediaFile_5", maxCount: 1 },
      { name: "mediaFile_6", maxCount: 1 },
      { name: "mediaFile_7", maxCount: 1 },
      { name: "mediaFile_8", maxCount: 1 },
      { name: "mediaFile_9", maxCount: 1 }
    ])
  ], async (req, res) => {
    try {
      const user = req.user;
      const eventId = parseInt(req.params.id);
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (parseInt(event.organizerId.toString()) !== parseInt(user.id.toString())) {
        return res.status(403).json({ message: "Not authorized to update this event" });
      }
      const files = req.files || {};
      const updateData = { ...req.body };
      if (updateData.date && typeof updateData.date === "string") {
        updateData.date = new Date(updateData.date);
      }
      let mediaItems = [];
      if (event.mediaItems) {
        try {
          if (typeof event.mediaItems === "string") {
            mediaItems = JSON.parse(event.mediaItems);
          } else if (Array.isArray(event.mediaItems)) {
            mediaItems = event.mediaItems;
          } else if (typeof event.mediaItems === "object") {
            mediaItems = [event.mediaItems];
          }
          if (!Array.isArray(mediaItems)) {
            mediaItems = [];
          }
        } catch (e) {
          console.warn("Could not parse existing mediaItems:", e);
          mediaItems = [];
        }
      }
      let clientMediaItems = [];
      if (req.body.mediaItems) {
        try {
          if (typeof req.body.mediaItems === "string") {
            clientMediaItems = JSON.parse(req.body.mediaItems);
          } else if (Array.isArray(req.body.mediaItems)) {
            clientMediaItems = req.body.mediaItems;
          } else if (typeof req.body.mediaItems === "object" && req.body.mediaItems !== null) {
            clientMediaItems = [req.body.mediaItems];
          } else {
            clientMediaItems = [];
          }
          if (!Array.isArray(clientMediaItems)) {
            console.warn("Client mediaItems is not an array after parsing, resetting to empty array");
            clientMediaItems = [];
          }
        } catch (e) {
          console.warn("Could not parse client mediaItems:", e);
          clientMediaItems = [];
        }
      }
      Object.keys(files).forEach((fieldName, index) => {
        const fileArray = files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          const mediaPath = file.path.replace("public", "");
          const isVideo = file.mimetype.startsWith("video/");
          const mediaItem = {
            type: isVideo ? "video" : "photo",
            url: mediaPath,
            order: mediaItems.length + index,
            isMain: fieldName === "mainMediaFile"
          };
          mediaItems.push(mediaItem);
        }
      });
      if (clientMediaItems.length > 0) {
        const existingMediaItems = [...mediaItems];
        const updatedMediaItems = clientMediaItems.map((clientItem, index) => {
          if (clientItem.url) {
            return {
              type: clientItem.type || "photo",
              url: clientItem.url,
              order: clientItem.order !== void 0 ? clientItem.order : index,
              isMain: clientItem.isMain === true
            };
          }
          const existingItem = existingMediaItems.find(
            (existing) => existing.order === clientItem.order || existing.order === index
          ) || existingMediaItems[index];
          if (existingItem) {
            return {
              type: clientItem.type || existingItem.type,
              url: existingItem.url,
              order: clientItem.order !== void 0 ? clientItem.order : index,
              isMain: clientItem.isMain === true
            };
          }
          return null;
        }).filter((item) => item && item.url);
        if (updatedMediaItems.length > 0) {
          mediaItems = updatedMediaItems;
          console.log(`Preserved URLs for ${updatedMediaItems.length} media items`);
        }
      }
      let mainItem = null;
      mainItem = mediaItems.find(
        (item) => item && item.isMain === true && item.url && item.url.trim() !== ""
      );
      if (!mainItem && mediaItems.length > 0) {
        mainItem = mediaItems.find(
          (item) => item && item.url && item.url.trim() !== ""
        );
        if (mainItem) {
          mediaItems = mediaItems.map((item) => ({
            ...item,
            isMain: item === mainItem
          }));
        }
      }
      if (mainItem && mainItem.url) {
        updateData.mainMediaUrl = mainItem.url;
        updateData.mainMediaType = mainItem.type || "photo";
        console.log(`Encontrado elemento principal en mediaItems: {
          tipo: '${mainItem.type}',
          url: '${mainItem.url}'
        }`);
      } else {
        updateData.mainMediaUrl = null;
        updateData.mainMediaType = "photo";
        console.log("No se encontr\xF3 elemento principal v\xE1lido, limpiando referencias");
      }
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
  app2.get("/api/events", async (req, res) => {
    try {
      const events2 = await storage.getEvents();
      res.json(events2);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });
  app2.get("/api/events/:id", async (req, res) => {
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
  app2.delete("/api/events", async (req, res) => {
    try {
      await storage.deleteAllEvents();
      res.json({ message: "All events deleted successfully" });
    } catch (error) {
      console.error("Error deleting all events:", error);
      res.status(500).json({ message: "Failed to delete all events" });
    }
  });
  app2.delete("/api/events/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
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
  app2.post("/api/events/:id/attend", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      const eventId = parseInt(req.params.id);
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      const attendeeData = {
        eventId,
        userId: user.id,
        status: "approved",
        paymentStatus: "completed",
        paymentIntentId: null
      };
      const attendee = await storage.insertEventAttendee(attendeeData);
      res.status(201).json(attendee);
    } catch (error) {
      console.error("Error attending event:", error);
      res.status(500).json({ message: "Failed to attend event" });
    }
  });
  app2.get("/api/events/:id/attendees", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const attendees = await storage.getEventAttendees(eventId);
      res.json(attendees);
    } catch (error) {
      console.error("Error fetching attendees:", error);
      res.status(500).json({ message: "Failed to fetch attendees" });
    }
  });
  app2.use(express.static("public"));
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs2 from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@db": path2.resolve(import.meta.dirname, "db"),
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path2.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/media-routes.ts
import express3 from "express";

// server/supabase-client.ts
import dotenv2 from "dotenv";
dotenv2.config();
console.log("Supabase disabled for local development");
var dummySupabase = {
  auth: { getSession: () => Promise.resolve({ data: null, error: null }) },
  from: () => ({ select: () => Promise.resolve({ data: [], error: null }) })
};
var supabase2 = dummySupabase;

// server/supabase-storage.ts
import { v4 as uuidv4 } from "uuid";
var BUCKET_NAME = "event-media";
var bucketAvailable = false;
async function deleteFile(fileUrl) {
  try {
    if (!bucketAvailable) {
      console.log(`Simulating deletion of file: ${fileUrl}`);
      return true;
    }
    const urlObj = new URL(fileUrl);
    const pathParts = urlObj.pathname.split("/");
    const storagePath = pathParts.slice(pathParts.indexOf("public") + 2).join("/");
    const { error } = await supabase2.storage.from(BUCKET_NAME).remove([storagePath]);
    if (error) {
      console.error("Error deleting file from Supabase Storage:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error in deleteFile:", error);
    return false;
  }
}

// server/helpers/media-preserver.ts
async function preserveExistingMedia(eventId, mediaItemsFromClient = []) {
  try {
    const event = await storage.getEventById(eventId);
    if (!event || !Array.isArray(event.mediaItems)) {
      console.log("No event found or no media items to preserve");
      return mediaItemsFromClient;
    }
    const clientMediaUrls = new Set(
      mediaItemsFromClient.filter((item) => !item.deleted && !item.toDelete).map((item) => item.url)
    );
    const itemsToDelete = mediaItemsFromClient.filter((item) => item.deleted || item.toDelete).map((item) => item.url).filter(Boolean);
    if (itemsToDelete.length > 0) {
      console.log(`Will delete ${itemsToDelete.length} media items`);
      for (const url of itemsToDelete) {
        try {
          await deleteFile(url);
          console.log(`Deleted file: ${url}`);
        } catch (error) {
          console.error(`Error deleting file ${url}:`, error);
        }
      }
    }
    const preservedItems = event.mediaItems.filter((item) => {
      return !itemsToDelete.includes(item.url);
    }).map((item) => ({
      id: item.id,
      type: item.type,
      url: item.url,
      order: item.order || 0,
      isMain: !!item.isMain
    }));
    const newItems = mediaItemsFromClient.filter((item) => {
      return !item.deleted && !item.toDelete && !preservedItems.some((p) => p.url === item.url);
    }).map((item) => ({
      type: item.type,
      url: item.url,
      order: item.order || 0,
      isMain: !!item.isMain
    }));
    const combinedItems = [...preservedItems, ...newItems];
    combinedItems.sort((a, b) => (a.order || 0) - (b.order || 0));
    console.log(`Media preservation result: ${preservedItems.length} preserved, ${newItems.length} new`);
    return combinedItems;
  } catch (error) {
    console.error("Error in preserveExistingMedia:", error);
    return mediaItemsFromClient;
  }
}

// server/media-routes.ts
var requireAuth = (req, res, next) => {
  next();
};
var mediaRouter = express3.Router();
mediaRouter.post("/api/events/:id/preserve-media", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const eventId = parseInt(req.params.id);
    const event = await storage.getEventById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }
    if (event.organizerId !== user.id) {
      return res.status(403).json({ message: "No autorizado para actualizar este evento" });
    }
    let mediaItems = [];
    let preserved = false;
    if (req.body && req.body.mediaItems) {
      try {
        if (typeof req.body.mediaItems === "string") {
          mediaItems = JSON.parse(req.body.mediaItems);
        } else if (Array.isArray(req.body.mediaItems)) {
          mediaItems = req.body.mediaItems;
        }
      } catch (error) {
        console.error("Error parseando mediaItems:", error);
        mediaItems = [];
      }
    }
    const updateData = {};
    preserved = preserveExistingMedia(event, mediaItems, updateData);
    if (preserved) {
      await storage.updateEvent(eventId, updateData);
      const updatedEvent = await storage.getEventById(eventId);
      if (!updatedEvent) {
        return res.status(500).json({
          success: false,
          message: "Error al obtener el evento actualizado"
        });
      }
      return res.json({
        success: true,
        preserved: true,
        message: "Medios preservados exitosamente",
        mediaItems: updatedEvent.mediaItems,
        mainMediaUrl: updatedEvent.mainMediaUrl,
        mainMediaType: updatedEvent.mainMediaType
      });
    }
    return res.json({
      success: true,
      preserved: false,
      message: "No fue necesario preservar medios",
      mediaItems: event.mediaItems,
      mainMediaUrl: event.mainMediaUrl,
      mainMediaType: event.mainMediaType
    });
  } catch (error) {
    console.error("Error preservando medios:", error);
    res.status(500).json({
      success: false,
      message: "Error al preservar medios",
      error: String(error)
    });
  }
});

// server/index.ts
import { sql } from "drizzle-orm";
import passport2 from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt2 from "bcrypt";
var app = express4();
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || "pipol-session-secret-key-2025",
  resave: false,
  saveUninitialized: false,
  name: "pipol_session",
  cookie: {
    secure: false,
    // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1e3,
    // 24 hours
    sameSite: "lax"
  },
  rolling: true
  // Extend session on activity
}));
app.use(passport2.initialize());
app.use(passport2.session());
passport2.serializeUser((user, done) => {
  done(null, user.id);
});
passport2.deserializeUser(async (id, done) => {
  try {
    console.log("Deserializing user with ID:", id);
    const user = await storage.getUserById(parseInt(id));
    if (user) {
      console.log("User deserialized successfully:", user.id, user.name);
      done(null, user);
    } else {
      console.log("User not found during deserialization");
      done(null, false);
    }
  } catch (error) {
    console.error("Error deserializing user:", error);
    done(error, null);
  }
});
passport2.use(new LocalStrategy({
  usernameField: "email",
  // Use email as username field
  passwordField: "password"
}, async (email, password, done) => {
  try {
    console.log("Local strategy: Authenticating user with email:", email);
    const user = await storage.getUserByEmail(email);
    if (!user) {
      console.log("Local strategy: User not found for email:", email);
      return done(null, false, { message: "Invalid email or password" });
    }
    if (!user.password) {
      console.log("Local strategy: User has no password set:", email);
      return done(null, false, { message: "Please use social login or reset your password" });
    }
    const isValidPassword = await bcrypt2.compare(password, user.password);
    if (!isValidPassword) {
      console.log("Local strategy: Invalid password for user:", email);
      return done(null, false, { message: "Invalid email or password" });
    }
    console.log("Local strategy: Authentication successful for user:", email);
    return done(null, user);
  } catch (error) {
    console.error("Local strategy: Authentication error:", error);
    return done(error);
  }
}));
app.use(express4.json({ limit: "10mb" }));
app.use(express4.urlencoded({ extended: true, limit: "10mb" }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("replit.dev"))) {
    res.header("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.header("Access-Control-Allow-Origin", "http://localhost:5000");
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.path.startsWith("/api/")) {
    if (req.method !== "OPTIONS") {
      res.header("Content-Type", "application/json");
    }
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api")) {
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  try {
    await db.execute(sql`SELECT 1`);
    console.log("Database connection successful");
  } catch (error) {
    console.error("Database connection failed:", error);
  }
  try {
    console.log("Creating user_interests table if needed...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_interests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, category)
      );
    `);
    console.log("user_interests table is ready");
  } catch (error) {
    console.log("user_interests table creation skipped (may already exist):", error.message);
  }
  console.log("Setting up local file storage...");
  try {
    const fs3 = await import("fs");
    const path4 = await import("path");
    const uploadsDir = path4.join(process.cwd(), "public", "uploads");
    const attachedDir = path4.join(process.cwd(), "attached_assets");
    if (!fs3.existsSync(uploadsDir)) {
      fs3.mkdirSync(uploadsDir, { recursive: true });
    }
    if (!fs3.existsSync(attachedDir)) {
      fs3.mkdirSync(attachedDir, { recursive: true });
    }
    console.log("Local storage directories ready");
  } catch (error) {
    console.error("Error setting up local storage:", error);
  }
  const logAuthStatus = (req, res, next) => {
    if (req.path.startsWith("/api/auth/")) {
      console.log(`Auth check for ${req.method} ${req.path}: ${req.user ? "Authenticated" : "Not authenticated"}`);
    }
    next();
  };
  app.use(logAuthStatus);
  app.use(mediaRouter);
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") && res.headersSent) {
      return;
    }
    next();
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const PORT = process.env.PORT || 4e3;
  log(`Attempting to start server on port ${PORT}...`);
  server.listen({
    port: PORT,
    host: "0.0.0.0"
  }, () => {
    log(`\u{1F680} Server started successfully on port ${PORT}`);
    log(`-------------------------------------------------------`);
    log(`Pipol Application is now running!`);
    log(`Access the app in your browser at: http://localhost:${PORT}`);
    log(`-------------------------------------------------------`);
  }).on("error", (err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Failed to start server: ${errorMessage}`);
    process.exit(1);
  });
})();
