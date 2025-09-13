-- Create user_interests table to match the pipol-muestra reference implementation
CREATE TABLE IF NOT EXISTS user_interests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- Insert some sample interests for testing
INSERT INTO user_interests (user_id, category) VALUES 
(2, 'music'),
(2, 'technology')
ON CONFLICT (user_id, category) DO NOTHING;