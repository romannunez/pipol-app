import express, { Request, Response } from 'express';
import { storage } from './storage';
import { preserveExistingMedia } from './helpers/media-preserver';
// import { isAuthenticatedMiddleware as requireAuth } from './supabase-auth';

// Temporary auth middleware for local development
const requireAuth = (req: any, res: any, next: any) => { next(); };

// Crear un router separado para manejar la preservación de medios
const mediaRouter = express.Router();

// Endpoint para preservar los medios de un evento durante actualizaciones
mediaRouter.post('/api/events/:id/preserve-media', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const eventId = parseInt(req.params.id);
    
    // Verificar que el evento existe
    const event = await storage.getEventById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }
    
    // Verificar que el usuario es el organizador
    if (event.organizerId !== user.id) {
      return res.status(403).json({ message: "No autorizado para actualizar este evento" });
    }
    
    // Obtener mediaItems actuales del cuerpo de la solicitud
    let mediaItems: any[] = [];
    let preserved = false;
    
    if (req.body && req.body.mediaItems) {
      try {
        if (typeof req.body.mediaItems === 'string') {
          mediaItems = JSON.parse(req.body.mediaItems);
        } else if (Array.isArray(req.body.mediaItems)) {
          mediaItems = req.body.mediaItems;
        }
      } catch (error) {
        console.error("Error parseando mediaItems:", error);
        mediaItems = [];
      }
    }
    
    // Preparar la actualización
    const updateData: any = {};
    
    // Usar el helper para preservar medios si es necesario
    preserved = preserveExistingMedia(event, mediaItems, updateData);
    
    if (preserved) {
      // Actualizar el evento con los medios preservados
      await storage.updateEvent(eventId, updateData);
      
      // Devolver los medios preservados
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
    
    // Si no se preservaron medios, simplemente devolver el estado actual
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

export { mediaRouter };