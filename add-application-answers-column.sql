-- Add application_answers column to event_attendees table for private event requests
ALTER TABLE event_attendees 
ADD COLUMN application_answers TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN event_attendees.application_answers IS 'JSON string containing answers to private event application questions';