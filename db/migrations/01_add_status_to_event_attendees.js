// Importar módulo pg
const { Pool } = require('pg');

async function run() {
  console.log('Running migration: Add status column to event_attendees');
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Create the enum type if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendee_status') THEN
          CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected');
        END IF;
      END
      $$;
    `);
    
    // Check if the column already exists to avoid errors
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'event_attendees' AND column_name = 'status';
    `);
    
    if (checkResult.rows.length === 0) {
      // Add status column with default value 'approved' for existing records
      await pool.query(`
        ALTER TABLE event_attendees
        ADD COLUMN status attendee_status NOT NULL DEFAULT 'approved';
      `);
      console.log('Status column added successfully');
    } else {
      console.log('Status column already exists, skipping');
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Execute the migration
run()
  .then(() => console.log('Migration completed'))
  .catch(err => {
    console.error('Error in migration:', err);
    process.exit(1);
  });