import { supabase } from './server/supabase-client.js';

const setupTables = async () => {
  console.log('Setting up database tables...');

  // Create the users table first
  const { error: usersError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        name TEXT NOT NULL,
        bio TEXT,
        avatar TEXT,
        supabase_id TEXT UNIQUE,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `
  });

  if (usersError) {
    console.error('Error creating users table:', usersError);
    return false;
  }

  console.log('Users table created successfully');
  return true;
};

setupTables().then(success => {
  console.log(success ? 'Database setup complete' : 'Database setup failed');
  process.exit(success ? 0 : 1);
});