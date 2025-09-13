import { supabase } from './server/supabase-client.js';

const createDatabaseTables = async () => {
  console.log('Creating database tables...');

  // Create users table
  const { error: usersError } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (usersError && usersError.code === 'PGRST116') {
    // Table doesn't exist, create it using SQL
    const { error: createError } = await supabase.rpc('exec_sql', {
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
        
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
      `
    });

    if (createError) {
      console.error('Error creating users table:', createError);
      return false;
    }
    console.log('Users table created successfully');
  } else {
    console.log('Users table already exists');
  }

  return true;
};

// Initialize database
createDatabaseTables()
  .then(success => {
    console.log(success ? 'Database initialization complete' : 'Database initialization failed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Database initialization error:', error);
    process.exit(1);
  });