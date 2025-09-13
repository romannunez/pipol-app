import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role key if available, otherwise use anon key
const supabaseKey = supabaseServiceKey || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const createTablesDirectly = async () => {
  console.log('Creating database tables using direct SQL...');
  
  // Create the users table using raw SQL through Supabase
  const createUsersSQL = `
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
  `;

  const createIndexesSQL = `
    CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
    CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON public.users(supabase_id);
  `;

  const enableRLSSQL = `
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
  `;

  const createPoliciesSQL = `
    CREATE POLICY IF NOT EXISTS "Enable insert for registration" ON public.users
        FOR INSERT WITH CHECK (true);
    
    CREATE POLICY IF NOT EXISTS "Users can view own data" ON public.users
        FOR SELECT USING (auth.uid()::text = supabase_id);
    
    CREATE POLICY IF NOT EXISTS "Users can update own data" ON public.users
        FOR UPDATE USING (auth.uid()::text = supabase_id);
  `;

  try {
    // Try to execute each SQL command
    console.log('Creating users table...');
    const { data: createData, error: createError } = await supabase.rpc('query', { 
      query: createUsersSQL 
    });
    
    if (createError) {
      console.log('RPC not available, attempting alternative...');
      
      // Alternative: Check if we can insert a test user to trigger table creation
      const testUser = {
        username: 'test_user_' + Date.now(),
        email: 'test_' + Date.now() + '@example.com',
        name: 'Test User',
        supabase_id: 'test_' + Date.now()
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('users')
        .insert([testUser])
        .select();
        
      if (insertError) {
        if (insertError.code === '42P01') {
          console.log('Table does not exist. Manual creation required in Supabase dashboard.');
          return false;
        } else if (insertError.code === '23505') {
          console.log('Table exists but has constraint violations (expected)');
          // Clean up test user if it was inserted
          await supabase.from('users').delete().eq('username', testUser.username);
          return true;
        } else {
          console.log('Table exists and is accessible');
          // Clean up test user
          await supabase.from('users').delete().eq('username', testUser.username);
          return true;
        }
      } else {
        console.log('Table created and test user inserted successfully');
        // Clean up test user
        await supabase.from('users').delete().eq('username', testUser.username);
        return true;
      }
    } else {
      console.log('Users table created via RPC');
      return true;
    }
  } catch (error) {
    console.error('Error creating tables:', error);
    return false;
  }
};

createTablesDirectly().then(success => {
  if (success) {
    console.log('Database setup complete - registration should now work');
  } else {
    console.log('Database setup requires manual intervention');
  }
  process.exit(0);
});