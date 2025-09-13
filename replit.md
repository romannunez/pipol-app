# Overview

Pipol is a full-stack social event discovery and coordination platform that enables users to create, find, and attend events based on location and interests. The application features real-time messaging, multimedia support, user authentication, and an interactive map-based interface for event exploration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: wouter for lightweight client-side routing
- **UI Components**: shadcn/ui components built on Radix UI primitives with Tailwind CSS
- **State Management**: TanStack Query for server state management and React hooks for local state
- **Maps Integration**: Mapbox GL for interactive map functionality
- **Real-time Communication**: WebSocket client for chat messaging
- **Authentication**: Context-based auth management with session persistence

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL schema definitions
- **Authentication**: Dual authentication system supporting both Supabase Auth and session-based authentication
- **File Upload**: Multer middleware for handling multimedia file uploads
- **Real-time Features**: WebSocket server for chat functionality
- **API Design**: RESTful API with dedicated route modules for different features

## Database Design
- **Primary Database**: PostgreSQL with comprehensive schema including users, events, attendees, and chat messages
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Key Tables**: users, events, event_attendees, chat_messages, notifications, user_interests
- **Enums**: Strongly typed enums for event categories, privacy types, payment types, and multimedia types

## Authentication & Authorization
- **Dual Auth System**: Supports both Supabase authentication and session-based authentication
- **Session Management**: Express sessions with passport.js integration
- **Authorization**: Role-based access control for event organizers vs attendees
- **Security**: Password hashing with bcrypt, secure session configuration

## File Storage & Media Management
- **Upload Strategy**: Multer-based file upload system with configurable storage destinations
- **Media Types**: Support for photos and videos with automatic type detection
- **File Organization**: Structured file storage in public/uploads/events directory
- **Media Processing**: Comprehensive media item management with main media selection

## Real-time Features
- **WebSocket Server**: Custom WebSocket implementation for chat functionality
- **Room Management**: Event-based chat rooms with user authentication
- **Message Types**: Support for different message types including replies
- **Connection Management**: Client tracking and room subscription management

# External Dependencies

## Database Services
- **Supabase**: PostgreSQL database hosting with real-time capabilities and authentication services
- **Connection**: Environment-based configuration for Supabase URL and API keys

## Map Services
- **Mapbox**: Interactive mapping functionality with custom markers and user location services
- **Configuration**: Mapbox GL with custom styling and event visualization

## Payment Processing
- **Stripe**: Payment gateway integration (currently disabled in configuration)
- **Implementation**: Stripe customer and subscription management infrastructure in place

## Development Tools
- **Vite**: Frontend build tool with HMR and development server
- **TypeScript**: Full TypeScript implementation across frontend and backend
- **Tailwind CSS**: Utility-first CSS framework with custom component styling

## Authentication Services
- **Supabase Auth**: User authentication and authorization with JWT token management
- **Passport.js**: Session-based authentication fallback with local strategy

## Real-time Infrastructure
- **WebSocket**: Native WebSocket implementation for chat features
- **Event Broadcasting**: Real-time event updates and notifications

## File Upload & Storage
- **Multer**: Multipart file upload handling with validation and processing
- **File System**: Local file storage with organized directory structure