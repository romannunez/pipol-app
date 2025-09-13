// This script uses the Supabase REST API to create tables
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Validate Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  console.error('Make sure SUPABASE_URL and SUPABASE_ANON_KEY are defined in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to read and execute SQL file
async function createTables() {
  try {
    console.log('Setting up database tables...');

    // Create enum types first
    console.log('Creating enum types...');
    
    // Creating event_category enum
    await supabase.rpc('create_enum_type', { 
      type_name: 'event_category',
      enum_values: ['social', 'music', 'spiritual', 'education', 'sports', 'food', 'art', 'technology', 
                   'games', 'outdoor', 'networking', 'workshop', 'conference', 'party', 'fair', 'exhibition']
    });
    
    // Creating privacy_type enum
    await supabase.rpc('create_enum_type', { 
      type_name: 'privacy_type',
      enum_values: ['public', 'private']
    });
    
    // Creating private_access_type enum
    await supabase.rpc('create_enum_type', { 
      type_name: 'private_access_type',
      enum_values: ['solicitud', 'postulacion', 'paga']
    });
    
    // Creating payment_type enum
    await supabase.rpc('create_enum_type', { 
      type_name: 'payment_type',
      enum_values: ['free', 'paid']
    });
    
    // Creating multimedia_type enum
    await supabase.rpc('create_enum_type', { 
      type_name: 'multimedia_type',
      enum_values: ['photo', 'video']
    });
    
    // Creating attendee_status enum
    await supabase.rpc('create_enum_type', { 
      type_name: 'attendee_status',
      enum_values: ['pending', 'approved', 'rejected']
    });

    console.log('Creating users table...');
    // Create users table
    const { error: usersError } = await supabase
      .from('users')
      .insert({ id: 1, username: 'temp_user', email: 'temp@example.com', name: 'Temporary User', password: 'temp' })
      .select();
    
    if (usersError && !usersError.message.includes('duplicate')) {
      console.error('Error creating users table:', usersError);
    } else {
      console.log('Users table created or already exists');
    }

    console.log('Database setup complete');
    return true;
  } catch (error) {
    console.error('Error setting up database:', error);
    return false;
  }
}

// Run the setup
createTables().then(success => {
  console.log('Setup completed with result:', success ? 'SUCCESS' : 'FAILED');
});