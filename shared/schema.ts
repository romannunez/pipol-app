import { pgTable, text, serial, integer, boolean, timestamp, decimal, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Create enums for categories
export const eventCategoryEnum = pgEnum('event_category', [
  'social', 'music', 'spiritual', 'education', 
  'sports', 'food', 'art', 'technology',
  'games', 'outdoor', 'networking', 'workshop',
  'conference', 'party', 'fair', 'exhibition'
]);

// Create enums for privacy
export const privacyTypeEnum = pgEnum('privacy_type', ['public', 'private']);

// Create enums for private event access type
export const privateAccessTypeEnum = pgEnum('private_access_type', ['solicitud', 'postulacion', 'paga']);

// Create enums for payment type (keeping for schema compatibility, but will disable in UI)
export const paymentTypeEnum = pgEnum('payment_type', ['free', 'paid']);

// Create enums for gender
export const genderEnum = pgEnum('gender', ['hombre', 'mujer', 'otro', 'no_especificar']);

// Create enums for gender preference in events
export const genderPreferenceEnum = pgEnum('gender_preference', ['all_people', 'men', 'women']);

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password"), // No longer required with Supabase auth
  name: text("name").notNull(),
  bio: text("bio"),
  avatar: text("avatar"),
  gender: genderEnum("gender"), // User's gender
  supabaseId: text("supabase_id").unique(), // Add Supabase user ID reference
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Multimedia type enum
export const multimediaTypeEnum = pgEnum('multimedia_type', ['photo', 'video']);

// Events Table
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: eventCategoryEnum("category").notNull(),
  date: timestamp("date").notNull(),
  endTime: timestamp("end_time"),
  latitude: decimal("latitude", { precision: 10, scale: 6 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 6 }).notNull(),
  locationName: text("location_name").notNull(),
  locationAddress: text("location_address").notNull(),
  paymentType: paymentTypeEnum("payment_type").notNull().default('free'),
  price: decimal("price", { precision: 10, scale: 2 }),
  maxCapacity: integer("max_capacity"),
  privacyType: privacyTypeEnum("privacy_type").notNull().default('public'),
  privateAccessType: privateAccessTypeEnum("private_access_type").default('solicitud'),
  mediaItems: text("media_items"),
  mainMediaType: text("main_media_type"),
  mainMediaUrl: text("main_media_url"),
  genderPreference: genderPreferenceEnum("gender_preference").default('all_people'), // Gender preference for the event
  organizerId: integer("organizer_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Attendee status enum (pending, approved, rejected)
export const attendeeStatusEnum = pgEnum('attendee_status', ['pending', 'approved', 'rejected']);

// Event Attendees Junction Table
export const eventAttendees = pgTable("event_attendees", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  status: attendeeStatusEnum("status").default('approved').notNull(),
  paymentStatus: text("payment_status").default('pending'),
  paymentIntentId: text("payment_intent_id"),
  applicationAnswers: text("application_answers"), // JSON string for private event application answers
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Interests Table (for future recommendations)
export const userInterests = pgTable("user_interests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  category: eventCategoryEnum("category").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chat Messages Table for event conversations
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: 'cascade' }).notNull(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").default('text').notNull(), // 'text', 'image', 'file', 'system'
  replyToId: integer("reply_to_id"), // For threaded conversations - self-reference added later
  edited: boolean("edited").default(false).notNull(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"), // Soft delete
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notification type enum
export const notificationTypeEnum = pgEnum('notification_type', ['request_approved', 'request_rejected', 'new_request']);

// Notifications Table for user notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  eventId: integer("event_id").references(() => events.id),
  requestId: integer("request_id").references(() => eventAttendees.id),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Ratings Table for aura system
export const userRatings = pgTable("user_ratings", {
  id: serial("id").primaryKey(),
  ratedUserId: integer("rated_user_id").references(() => users.id).notNull(),
  raterUserId: integer("rater_user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  organizedEvents: many(events, { relationName: "organizer" }),
  attendedEvents: many(eventAttendees, { relationName: "attendee" }),
  interests: many(userInterests),
  sentMessages: many(chatMessages, { relationName: "sender" }),
  notifications: many(notifications),
  ratingsGiven: many(userRatings, { relationName: "rater" }),
  ratingsReceived: many(userRatings, { relationName: "rated" }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, { fields: [events.organizerId], references: [users.id], relationName: "organizer" }),
  attendees: many(eventAttendees),
  chatMessages: many(chatMessages),
}));

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(events, { fields: [eventAttendees.eventId], references: [events.id] }),
  user: one(users, { fields: [eventAttendees.userId], references: [users.id], relationName: "attendee" }),
}));

export const userInterestsRelations = relations(userInterests, ({ one }) => ({
  user: one(users, { fields: [userInterests.userId], references: [users.id] }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  event: one(events, { fields: [chatMessages.eventId], references: [events.id] }),
  sender: one(users, { fields: [chatMessages.senderId], references: [users.id], relationName: "sender" }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  event: one(events, { fields: [notifications.eventId], references: [events.id] }),
  request: one(eventAttendees, { fields: [notifications.requestId], references: [eventAttendees.id] }),
}));

export const userRatingsRelations = relations(userRatings, ({ one }) => ({
  ratedUser: one(users, { fields: [userRatings.ratedUserId], references: [users.id], relationName: "rated" }),
  raterUser: one(users, { fields: [userRatings.raterUserId], references: [users.id], relationName: "rater" }),
}));

// Validation Schemas
export const insertUserSchema = createInsertSchema(users).extend({
  email: z.string().email("Dirección de correo electrónico inválida"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
  username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
});

export const loginUserSchema = z.object({
  email: z.string().email("Dirección de correo electrónico inválida"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// Esquema personalizado con transformaciones para eventos
export const insertEventSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  category: z.enum(eventCategoryEnum.enumValues),
  date: z.string().or(z.date()).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ),
  endTime: z.string().or(z.date()).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ),
  latitude: z.string().or(z.number()).transform(val => 
    typeof val === 'string' ? parseFloat(val) : val
  ),
  longitude: z.string().or(z.number()).transform(val => 
    typeof val === 'string' ? parseFloat(val) : val
  ),
  locationName: z.string().min(3, "El nombre del lugar debe tener al menos 3 caracteres"),
  locationAddress: z.string().min(5, "La dirección debe tener al menos 5 caracteres"),
  paymentType: z.enum(paymentTypeEnum.enumValues).default('free'),
  price: z.string().or(z.number()).transform(val => 
    typeof val === 'string' ? parseFloat(val) || 0 : val
  ).optional().nullable(),
  maxCapacity: z.string().or(z.number()).transform(val => 
    typeof val === 'string' ? parseFloat(val) || null : val
  ).optional().nullable(),
  privacyType: z.enum(privacyTypeEnum.enumValues).default('public'),
  privateAccessType: z.enum(privateAccessTypeEnum.enumValues).optional().nullable(),
  applicationQuestions: z.string().optional().nullable(), // JSON string for questions
  // Campos existentes (mantenidos por compatibilidad)
  photoUrl: z.string().optional().nullable(),
  photoUrls: z.string().optional().nullable(), // Almacenar array como JSON string
  videoUrl: z.string().optional().nullable(),
  videoUrls: z.string().optional().nullable(),
  // Nuevos campos para multimedia
  mediaItems: z.string().optional().nullable(), // Array JSON de items multimedia
  mainMediaType: z.enum(multimediaTypeEnum.enumValues).optional().default('photo'),
  mainMediaUrl: z.string().optional().nullable(),
  genderPreference: z.enum(genderPreferenceEnum.enumValues).default('all_people'),
  organizerId: z.number(),
});

export const insertEventAttendeeSchema = createInsertSchema(eventAttendees);

// Export types
export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventAttendee = typeof eventAttendees.$inferSelect;
export type UserInterest = typeof userInterests.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type UserRating = typeof userRatings.$inferSelect;

// Chat message insert schema
export const insertChatMessageSchema = createInsertSchema(chatMessages);
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// User rating insert schema
export const insertUserRatingSchema = createInsertSchema(userRatings, {
  rating: (schema) => schema.min(1, "Rating must be at least 1").max(10, "Rating must be at most 10"),
});
export type InsertUserRating = z.infer<typeof insertUserRatingSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type InsertEventAttendee = z.infer<typeof insertEventAttendeeSchema>;
