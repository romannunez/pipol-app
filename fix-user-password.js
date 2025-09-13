import postgres from 'postgres';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

async function fixUserPassword() {
  const connectionString = process.env.DATABASE_URL;
  console.log('Connecting to database with URL:', connectionString.replace(/:[^@]*@/, ':***@'));
  
  const client = postgres(connectionString, {
    ssl: 'require',
    max: 1,
    connect_timeout: 10
  });
  
  try {
    console.log('Checking user...');
    
    // Check if user exists and password status
    const users = await client`SELECT id, email, username, name, password FROM users WHERE email = 'facundoroman203@gmail.com'`;
    
    if (users.length === 0) {
      console.log('User not found');
      return;
    }
    
    const user = users[0];
    console.log('User found:', {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      hasPassword: !!user.password
    });
    
    if (!user.password) {
      console.log('Setting temporary password "123456" for user...');
      
      // Set password '123456' for this user
      const hashedPassword = await bcrypt.hash('123456', 10);
      await client`UPDATE users SET password = ${hashedPassword} WHERE email = 'facundoroman203@gmail.com'`;
      
      console.log('✅ Password set successfully! You can now login with:');
      console.log('  Email: facundoroman203@gmail.com');  
      console.log('  Password: 123456');
    } else {
      console.log('✅ User already has a password set');
    }
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

fixUserPassword();