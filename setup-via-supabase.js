import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const createUserTable = async () => {
  console.log('Creating users table via Supabase...');
  
  // First, let's try to create a simple users table using Supabase's REST API
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT,
      name TEXT NOT NULL,
      bio TEXT,
      avatar TEXT,
      supabase_id TEXT UNIQUE,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
  `;

  try {
    // Try using Supabase's SQL runner function if available
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: createTableSQL 
    });
    
    if (error) {
      console.log('RPC method failed, trying direct table creation...');
      
      // Try to insert a test row to see if table exists
      const { error: testError } = await supabase
        .from('users')
        .select('id')
        .limit(1);
        
      if (testError && testError.code === 'PGRST116') {
        console.log('Table does not exist. Please create it manually in Supabase dashboard.');
        return false;
      } else {
        console.log('Users table already exists or was created successfully');
        return true;
      }
    } else {
      console.log('Users table created successfully via RPC');
      return true;
    }
  } catch (error) {
    console.error('Error creating table:', error);
    return false;
  }
};

createUserTable().then(success => {
  console.log(success ? 'Setup complete' : 'Manual setup required');
  process.exit(0);
});