import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createUserInterestsTable() {
  try {
    console.log('Creating user_interests table...');
    
    // Create the table using raw SQL
    const { data, error } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_interests (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, category)
        );
      `
    });

    if (error) {
      console.error('Error creating user_interests table with rpc:', error);
      
      // Try direct SQL approach
      console.log('Trying direct SQL execution...');
      
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS user_interests (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, category)
        );
      `;
      
      // Use fetch for direct SQL execution
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({ sql: createTableQuery })
      });
      
      if (response.ok) {
        console.log('Table created successfully using direct SQL');
      } else {
        const errorText = await response.text();
        console.log('Direct SQL response:', errorText);
        
        // Fallback: Try using SQL editor approach
        console.log('Attempting to insert into supabase directly...');
        const { data: insertData, error: insertError } = await supabase
          .from('user_interests')
          .insert([])
          .select();
          
        if (insertError) {
          console.log('Table does not exist yet, this is expected:', insertError.message);
        }
      }
    } else {
      console.log('Table created successfully:', data);
    }

    // Test if we can query the table
    console.log('Testing table access...');
    const { data: testData, error: testError } = await supabase
      .from('user_interests')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('Table verification failed:', testError);
      console.log('Please create the user_interests table manually in Supabase SQL editor with:');
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
    } else {
      console.log('Table verification successful - user_interests table exists!');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createUserInterestsTable();