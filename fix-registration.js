import { supabase } from './server/supabase-client.js';

const fixRegistration = async () => {
  console.log('Attempting to create users table via Supabase admin...');
  
  try {
    // Try to create the table using Supabase's admin capabilities
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (error) {
      console.log('Admin table creation failed, using alternative method...');
      
      // Alternative: Try to use Supabase's schema builder
      const { error: createError } = await supabase
        .schema('public')
        .createTable('users', (table) => {
          table.bigSerial('id').primary();
          table.text('username').notNull().unique();
          table.text('email').notNull().unique();
          table.text('password');
          table.text('name').notNull();
          table.text('bio');
          table.text('avatar');
          table.text('supabase_id').unique();
          table.text('stripe_customer_id');
          table.text('stripe_subscription_id');
          table.timestamptz('created_at').defaultNow().notNull();
          table.timestamptz('updated_at').defaultNow().notNull();
        });

      if (createError) {
        console.error('Table creation failed:', createError);
        return false;
      }
    }

    console.log('Users table created successfully');
    return true;
    
  } catch (error) {
    console.error('Error during table creation:', error);
    return false;
  }
};

fixRegistration().then(success => {
  console.log(success ? 'Registration fix complete' : 'Manual intervention required');
  process.exit(0);
});