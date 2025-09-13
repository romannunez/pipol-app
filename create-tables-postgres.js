import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const createTables = async () => {
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('Creating users table...');
    
    await sql`
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
      )
    `;

    console.log('Creating indexes...');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON public.users(supabase_id)`;

    console.log('Setting up RLS...');
    
    await sql`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`;

    console.log('Creating policies...');
    
    await sql`
      CREATE POLICY IF NOT EXISTS "Enable insert for registration" ON public.users
          FOR INSERT WITH CHECK (true)
    `;

    console.log('Users table created successfully');
    
    await sql.end();
    return true;
    
  } catch (error) {
    console.error('Error creating tables:', error);
    await sql.end();
    return false;
  }
};

createTables().then(success => {
  console.log(success ? 'Database setup complete' : 'Database setup failed');
  process.exit(success ? 0 : 1);
});