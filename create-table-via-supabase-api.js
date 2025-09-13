import fetch from 'node-fetch';

const createUsersTable = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  console.log('Creating users table via Supabase REST API...');
  
  const sql = `
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

    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

    CREATE POLICY IF NOT EXISTS "Enable insert for registration" ON public.users
        FOR INSERT WITH CHECK (true);

    CREATE POLICY IF NOT EXISTS "Users can view own data" ON public.users
        FOR SELECT USING (auth.uid()::text = supabase_id);

    CREATE POLICY IF NOT EXISTS "Users can update own data" ON public.users
        FOR UPDATE USING (auth.uid()::text = supabase_id);
  `;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      console.log('Direct SQL execution not available, checking table existence...');
      
      // Check if table exists by querying it
      const checkResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=id&limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (checkResponse.status === 404 || checkResponse.status === 406) {
        console.log('Users table does not exist - manual creation required');
        return false;
      } else if (checkResponse.ok) {
        console.log('Users table already exists');
        return true;
      } else {
        console.log('Unable to verify table status');
        return false;
      }
    }

    const result = await response.json();
    console.log('Table creation result:', result);
    return true;

  } catch (error) {
    console.error('Error creating table:', error);
    return false;
  }
};

createUsersTable().then(success => {
  if (success) {
    console.log('Users table is ready - registration should work');
  } else {
    console.log('Table creation incomplete - run SQL manually in Supabase dashboard');
  }
  process.exit(0);
});