import express from 'express';
import { checkEventConflicts, canUserAttendEvent } from './conflict-detection';

const router = express.Router();

// Check for conflicts when creating/editing events
router.post('/check-conflicts', async (req, res) => {
  try {
    const { startTime, endTime, paymentType, excludeEventId } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'Start time and end time are required' });
    }

    const result = await checkEventConflicts({
      userId: req.user.id,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      paymentType: paymentType || 'free',
      excludeEventId
    });

    res.json(result);
  } catch (error) {
    console.error('Error checking event conflicts:', error);
    res.status(500).json({ 
      hasConflict: false, 
      conflictingEvents: [],
      message: 'Error checking conflicts' 
    });
  }
});

// Check if user can attend a specific event
router.post('/can-attend/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const result = await canUserAttendEvent(req.user.id, parseInt(eventId));
    
    res.json(result);
  } catch (error) {
    console.error('Error checking if user can attend event:', error);
    res.status(500).json({ 
      hasConflict: true, 
      conflictingEvents: [],
      message: 'Error checking attendance eligibility' 
    });
  }
});

export default router;