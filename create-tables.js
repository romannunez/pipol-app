// Script to create database schema in Supabase using direct SQL
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Get Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('Setting up Supabase database tables...');
console.log('Using Supabase URL:', supabaseUrl);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to execute SQL via Supabase REST API
async function createSchema() {
  try {
    // Try to create just the users table to test if SQL execution works
    const { data, error } = await supabase.from('users').insert({
      username: 'test_user',
      email: 'test@example.com',
      name: 'Test User',
      password: 'password',
      created_at: new Date(),
      updated_at: new Date()
    }).select();

    if (error) {
      if (error.code === '42P01') {
        console.log('Users table does not exist, attempting to create it...');
        
        // Create users table using REST API
        const { data: createData, error: createError } = await supabase.rpc('create_users_table');
        
        if (createError) {
          console.error('Error creating users table:', createError);
          console.log('Please create database tables manually using the SQL in supabase-setup.sql');
        } else {
          console.log('Created users table successfully!', createData);
        }
      } else {
        console.error('Error testing users table:', error);
      }
    } else {
      console.log('Users table already exists and is working properly!');
      console.log('Test user created:', data);
    }
    
    console.log('\nDatabase setup process completed.');
    console.log('If tables were not created automatically, please run the SQL from supabase-setup.sql');
    console.log('in the Supabase SQL Editor to create the necessary database schema.');
  } catch (error) {
    console.error('Error setting up database:', error);
  }
}

// Run the setup
createSchema();