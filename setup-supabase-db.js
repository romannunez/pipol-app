// This script runs the SQL from supabase-setup.sql to set up the database
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  console.error('Make sure SUPABASE_URL and SUPABASE_ANON_KEY are defined in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Read the SQL file
const sqlContent = fs.readFileSync('./supabase-setup.sql', 'utf8');

// Split the SQL into individual statements (split by semicolons)
const statements = sqlContent
  .split(';')
  .map(statement => statement.trim())
  .filter(statement => statement.length > 0);

// Execute each statement
async function executeStatements() {
  console.log(`Found ${statements.length} SQL statements to execute`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    try {
      // Log the first 50 characters of the statement for debugging
      console.log(`Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
      
      // Execute the SQL statement
      const { error } = await supabase.rpc('exec_sql', { query: statement + ';' });
      
      if (error) {
        console.error(`Error executing statement ${i + 1}:`, error.message);
        // Continue with the next statement even if there's an error
      } else {
        console.log(`Successfully executed statement ${i + 1}`);
      }
    } catch (err) {
      console.error(`Exception executing statement ${i + 1}:`, err);
    }
  }
  
  console.log('Database setup completed');
}

// Run the setup
executeStatements().catch(err => {
  console.error('Failed to set up database:', err);
  process.exit(1);
});