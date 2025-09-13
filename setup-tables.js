// Script to set up database tables in Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTables() {
  try {
    console.log('Setting up database tables in Supabase...');
    
    // Check if users table exists by trying to query it
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (userError && userError.code === '42P01') {
      console.log('Users table does not exist, creating it...');
      
      // Create users table
      const createUsersResult = await supabase.rpc('create_users_table');
      console.log('Create users table result:', createUsersResult);
      
      console.log('To complete database setup, please execute the SQL in supabase-setup.sql');
      console.log('in the Supabase SQL Editor. This will create all necessary tables and indexes.');
    } else {
      console.log('Users table exists, no need to create it');
    }
    
    // Create a test user for login testing
    console.log('Creating a test user via Supabase Auth...');
    const { data: authUserData, error: authUserError } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'testpassword123',
    });
    
    if (authUserError) {
      console.error('Error creating test user:', authUserError);
    } else {
      console.log('Test user created or already exists:', authUserData);
      
      // Add user to our database table
      if (authUserData.user) {
        const { data: dbUserData, error: dbUserError } = await supabase
          .from('users')
          .upsert(
            {
              email: 'test@example.com',
              username: 'testuser',
              name: 'Test User',
              supabase_id: authUserData.user.id,
            },
            { onConflict: 'email' }
          );
        
        if (dbUserError) {
          console.error('Error adding user to database:', dbUserError);
        } else {
          console.log('User added to database');
        }
      }
    }
    
    console.log('Database setup process complete');
    
  } catch (error) {
    console.error('Error in createTables:', error);
  }
}

createTables();