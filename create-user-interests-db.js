import { db } from './db/index.ts';
import { sql } from 'drizzle-orm';

async function createUserInterestsTable() {
  try {
    console.log('Creating user_interests table...');
    
    // Create the table using Drizzle's raw SQL execution
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_interests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, category)
      );
    `);
    
    console.log('user_interests table created successfully');
    
    // Test the table by checking if it exists
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM user_interests;
    `);
    
    console.log('Table verification successful - user_interests table exists!');
    
    // Add sample data for user ID 2 (facu)
    await db.execute(sql`
      INSERT INTO user_interests (user_id, category) 
      VALUES (2, 'music'), (2, 'technology') 
      ON CONFLICT (user_id, category) DO NOTHING;
    `);
    
    console.log('Sample interests added for testing');
    
  } catch (error) {
    console.error('Error creating user_interests table:', error);
    if (error.message.includes('already exists')) {
      console.log('Table already exists, that\'s fine!');
    }
  }
}

createUserInterestsTable();