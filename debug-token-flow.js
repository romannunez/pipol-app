// Debug script to test token persistence directly
console.log('=== Token Persistence Debug ===');

// Test 1: Basic localStorage functionality
console.log('\n1. Testing localStorage functionality:');
try {
  localStorage.setItem('test_key', 'test_value');
  const retrieved = localStorage.getItem('test_key');
  localStorage.removeItem('test_key');
  console.log('localStorage test:', retrieved === 'test_value' ? 'PASSED' : 'FAILED');
} catch (error) {
  console.log('localStorage test: FAILED -', error.message);
}

// Test 2: Token storage simulation
console.log('\n2. Testing token storage:');
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
const TOKEN_KEY = 'pipol_auth_token';

try {
  // Store token
  localStorage.setItem(TOKEN_KEY, mockToken);
  console.log('Token stored successfully');
  
  // Retrieve token immediately
  const retrievedToken = localStorage.getItem(TOKEN_KEY);
  console.log('Token retrieved:', retrievedToken === mockToken ? 'SUCCESS' : 'FAILED');
  
  // Clean up
  localStorage.removeItem(TOKEN_KEY);
} catch (error) {
  console.log('Token storage failed:', error.message);
}

// Test 3: Check current token state
console.log('\n3. Current token state:');
const currentToken = localStorage.getItem('pipol_auth_token');
console.log('Current pipol_auth_token:', currentToken ? 'EXISTS' : 'NOT_FOUND');

// Test 4: Login API test
console.log('\n4. Testing login API:');
fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'facundoroman203@gmail.com',
    password: '123456'
  }),
})
.then(response => response.json())
.then(data => {
  console.log('Login API response:', data.message);
  if (data.token) {
    console.log('Token received:', data.token.substring(0, 30) + '...');
    
    // Test immediate storage
    localStorage.setItem('pipol_auth_token', data.token);
    const stored = localStorage.getItem('pipol_auth_token');
    console.log('Immediate storage test:', stored === data.token ? 'SUCCESS' : 'FAILED');
    
    // Test auth endpoint
    return fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${data.token}`,
        'Content-Type': 'application/json'
      }
    });
  }
})
.then(response => {
  if (response) {
    console.log('Auth verification status:', response.status);
    return response.json();
  }
})
.then(userData => {
  if (userData) {
    console.log('Auth verification result:', userData.name ? 'SUCCESS' : 'FAILED');
  }
})
.catch(error => {
  console.error('Test failed:', error.message);
});