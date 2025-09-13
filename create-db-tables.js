import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const createTables = async () => {
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('Creating database tables...');
    
    // Create users table first
    await sql`
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
      )
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