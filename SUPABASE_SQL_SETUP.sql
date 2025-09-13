-- Execute this SQL in your Supabase SQL Editor to create the user_ratings table
-- This will fix the "Error saving rating" issue

CREATE TABLE user_ratings (
  id SERIAL PRIMARY KEY,
  rated_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rater_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(rated_user_id, rater_user_id)
);

CREATE INDEX idx_user_ratings_rated_user ON user_ratings(rated_user_id);
CREATE INDEX idx_user_ratings_rater_user ON user_ratings(rater_user_id);

-- Test that the table was created successfully
SELECT 'user_ratings table created successfully!' as status;