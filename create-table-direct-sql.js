import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUserInterestsTable() {
  try {
    console.log('Creating user_interests table using direct SQL...');
    
    // Create the table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_interests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, category)
      );
    `;
    
    // Use the SQL editor endpoint directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        query: createTableSQL
      })
    });

    if (!response.ok) {
      console.log('Direct SQL approach failed, trying alternative...');
      
      // Alternative: Use pg client
      const pg = await import('pg');
      const { Client } = pg.default;
      
      // Extract connection details from Supabase URL
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        const client = new Client({ connectionString: dbUrl });
        
        try {
          await client.connect();
          console.log('Connected to database via pg client');
          
          await client.query(createTableSQL);
          console.log('Table created successfully via pg client');
          
          // Test the table
          const result = await client.query('SELECT COUNT(*) FROM user_interests');
          console.log('Table verification successful - user_interests table exists!');
          
          await client.end();
          return;
        } catch (pgError) {
          console.error('PG client error:', pgError.message);
          await client.end();
        }
      }
    } else {
      console.log('Table created successfully via Supabase SQL endpoint');
    }

    // Test if we can access the table
    const { data, error } = await supabase
      .from('user_interests')
      .select('count', { count: 'exact' });
    
    if (error) {
      console.error('Table verification failed:', error.message);
      console.log('\nPlease manually create the table in Supabase SQL Editor:');
      console.log(createTableSQL);
    } else {
      console.log('Table verification successful - user_interests table exists!');
    }

  } catch (error) {
    console.error('Error creating table:', error.message);
    console.log('\nPlease manually create the table in Supabase SQL Editor:');
    console.log(`
CREATE TABLE IF NOT EXISTS user_interests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category)
);
    `);
  }
}

createUserInterestsTable();