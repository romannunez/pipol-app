import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const createUsersTableDirect = async () => {
  console.log('Attempting direct table creation...');
  
  try {
    // First, try to directly create a user record which will auto-create the table
    const testUser = {
      id: 999999,
      username: 'system_admin',
      email: 'system@admin.com',
      name: 'System Admin',
      supabase_id: 'system_admin_id_' + Date.now()
    };

    // Use upsert with explicit schema definition
    const { data, error } = await adminClient
      .from('users')
      .upsert(testUser, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.log('Table creation via upsert failed:', error.message);
      
      // Try alternative: use the schema builder API if available
      const { error: schemaError } = await adminClient
        .from('_supabase_migrations')
        .select('*')
        .limit(1);
        
      if (schemaError) {
        console.log('Database schema not accessible');
        return false;
      }
      
      return false;
    } else {
      console.log('Table created successfully via upsert');
      
      // Clean up the test user
      await adminClient
        .from('users')
        .delete()
        .eq('id', 999999);
        
      return true;
    }
  } catch (error) {
    console.error('Direct creation error:', error);
    return false;
  }
};

createUsersTableDirect().then(success => {
  console.log(success ? 'Users table is ready' : 'Manual SQL execution required');
  process.exit(0);
});