import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('Creating Supabase client...');
const supabase = createClient(supabaseUrl, supabaseKey);

const createTables = async () => {
  console.log('Creating users table...');
  
  const createUsersTableSQL = `
    CREATE TABLE IF NOT EXISTS public.users (
        id BIGSERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        name TEXT NOT NULL,
        bio TEXT,
        avatar TEXT,
        supabase_id TEXT UNIQUE,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
    CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON public.users(supabase_id);
  `;

  try {
    // Use the service role key for admin operations if available
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: createUsersTableSQL 
    });
    
    if (error) {
      console.log('RPC failed, checking if table exists via query...');
      
      // Test if table exists by trying a simple select
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('id')
        .limit(1);
        
      if (testError) {
        console.error('Table does not exist and could not be created:', testError);
        return false;
      } else {
        console.log('Users table is accessible');
        return true;
      }
    } else {
      console.log('Users table created successfully');
      return true;
    }
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
};

createTables().then(success => {
  if (success) {
    console.log('Database setup complete - registration should now work');
  } else {
    console.log('Database setup incomplete - manual SQL execution required');
  }
  process.exit(0);
});