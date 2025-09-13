import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

const createUsersTable = async () => {
  console.log('Creating users table with service role key...');
  
  try {
    // Create the table using direct SQL execution with service role
    const { data, error } = await supabase
      .from('_schema')
      .select('*')
      .limit(1);

    // If that fails, try creating via insert which will auto-create the table structure
    const testUser = {
      username: 'admin_test',
      email: 'admin@test.com',
      name: 'Admin Test',
      supabase_id: 'admin_test_id'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert([testUser])
      .select();

    if (insertError) {
      if (insertError.code === '42P01') {
        console.log('Table does not exist, creating manually...');
        
        // Use service role to execute raw SQL
        const { data: sqlData, error: sqlError } = await supabase.rpc('query', {
          query: `
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
          `
        });

        if (sqlError) {
          console.error('SQL execution failed:', sqlError);
          return false;
        } else {
          console.log('Table created via SQL execution');
          return true;
        }
      } else {
        console.log('Table exists, insert failed for other reason:', insertError);
        return true;
      }
    } else {
      console.log('Table exists and working, cleaning up test user...');
      await supabase.from('users').delete().eq('username', 'admin_test');
      return true;
    }
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
};

createUsersTable().then(success => {
  console.log(success ? 'Database ready for registration' : 'Manual table creation required');
  process.exit(0);
});