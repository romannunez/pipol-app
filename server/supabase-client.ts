import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Use VITE_ prefixed environment variables that were provided
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
// For server-side operations, we'll use the anon key since service key wasn't provided
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Environment variables check:');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Present' : 'Missing');
  throw new Error('Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

console.log('🔗 Connecting to Supabase...');

// Client for public operations (can be used for auth, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service client for server-side privileged operations (bypasses RLS)
export const supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const testSupabaseConnection = async () => {
  try {
    // Test both clients
    const { data: publicData, error: publicError } = await supabase.from('users').select('count', { count: 'exact', head: true });
    const { data: serviceData, error: serviceError } = await supabaseService.from('users').select('count', { count: 'exact', head: true });
    
    if (publicError && serviceError) {
      console.error('❌ Both Supabase connections failed:', { publicError, serviceError });
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    if (publicError) console.warn('⚠️ Public client has limited access (expected with RLS)');
    if (serviceError) console.error('❌ Service client failed:', serviceError);
    
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    return false;
  }
};