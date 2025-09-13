// Script to setup database tables in Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Validate Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Read SQL file
const sql = fs.readFileSync('./supabase-setup.sql', 'utf8');

// Extract CREATE TABLE statements from SQL
const tableStatements = sql.match(/CREATE TABLE\s+\w+\s*\([^;]+\);/g) || [];

async function setupDatabase() {
  console.log('Setting up database tables...');

  // Check if users table exists
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (userError && userError.code === '42P01') {
    console.log('Users table does not exist, creating tables...');
    
    try {
      // Execute SQL in Supabase SQL Editor
      console.log('Please execute the SQL statements in supabase-setup.sql manually in the Supabase SQL Editor.');
      console.log('The application will continue to run, but data operations may fail until tables are created.');
      
      // Create a simple users table for testing
      const { error } = await supabase.rpc('exec_sql', {
        query: `
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password TEXT,
            name TEXT,
            bio TEXT,
            avatar TEXT,
            supabase_id TEXT UNIQUE,
            stripe_customer_id TEXT,
            stripe_subscription_id TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `
      });
      
      if (error) {
        console.error('Error creating users table:', error.message);
        // If the exec_sql function doesn't exist or fails, we'll proceed anyway
        console.log('Could not create users table via RPC, application may have limited functionality');
      } else {
        console.log('Created users table successfully');
      }
    } catch (error) {
      console.error('Error setting up database:', error);
    }
  } else {
    console.log('Users table already exists, skipping table creation');
  }

  console.log('Database setup complete');
}

setupDatabase().catch(err => {
  console.error('Failed to setup database:', err);
});