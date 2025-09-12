import { db } from '../db';
import { sql } from 'drizzle-orm';

// This script adds the supabase_id column to the users table
async function addSupabaseIdColumn() {
  try {
    console.log('Adding supabase_id column to users table...');
    
    // Check if column already exists
    const checkColumnQuery = sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'supabase_id'
    `;
    
    const columnExists = await db.execute(checkColumnQuery);
    
    if (columnExists.length === 0) {
      // Add the column if it doesn't exist
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN supabase_id TEXT UNIQUE
      `);
      console.log('Successfully added supabase_id column to users table');
    } else {
      console.log('Column supabase_id already exists in users table');
    }
    
  } catch (error) {
    console.error('Error adding supabase_id column:', error);
    throw error;
  }
}

// Execute the migration
(async () => {
  try {
    await addSupabaseIdColumn();
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
})();