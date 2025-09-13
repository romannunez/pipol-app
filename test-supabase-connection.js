// Simple script to test Supabase connection
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('Testing Supabase connection with:');
console.log('URL:', supabaseUrl ? 'Available (not shown for security)' : 'Missing');
console.log('Key:', supabaseKey ? 'Available (not shown for security)' : 'Missing');

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test a simple query - should return { count: 0 } if table doesn't exist
    // or actual count if table exists
    console.log('Attempting to connect to Supabase...');
    const { data, error } = await supabase.from('_test_connection').select('*').limit(1);
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 means relation doesn't exist, which is expected
      console.error('Supabase connection error:', error);
      return false;
    }
    
    console.log('Supabase connection successful!');
    return true;
  } catch (error) {
    console.error('Exception during Supabase connection test:', error);
    return false;
  }
}

testConnection().then(success => {
  console.log('Connection test result:', success ? 'SUCCESS' : 'FAILED');
  
  if (!success) {
    console.log('\nTroubleshooting tips:');
    console.log('1. Verify the SUPABASE_URL is correct (should start with https://)');
    console.log('2. Check if the SUPABASE_ANON_KEY is correct');
    console.log('3. Ensure your Supabase project is active');
  }
});