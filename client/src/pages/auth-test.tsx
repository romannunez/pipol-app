import React, { useState } from 'react';
import { TokenManager } from '@/lib/token-manager';

export default function AuthTest() {
  const [email, setEmail] = useState('facundoroman203@gmail.com');
  const [password, setPassword] = useState('123456');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    setLoading(true);
    setResult('Testing login...');
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (response.ok && data.token) {
        TokenManager.setToken(data.token);
        TokenManager.setUser(data.user);
        setResult('Login successful! Token stored.');
        
        // Test immediate verification
        const verifyResponse = await fetch('/api/auth/me', {
          headers: TokenManager.createAuthHeaders(),
        });
        
        if (verifyResponse.ok) {
          const userData = await verifyResponse.json();
          setResult(prev => prev + `\nVerification successful: ${userData.name}`);
        } else {
          setResult(prev => prev + '\nVerification failed');
        }
      } else {
        setResult(`Login failed: ${data.message}`);
      }
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testStoredToken = async () => {
    const token = TokenManager.getToken();
    if (!token) {
      setResult('No token found in storage');
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: TokenManager.createAuthHeaders(),
      });

      if (response.ok) {
        const userData = await response.json();
        setResult(`Stored token works! User: ${userData.name}`);
      } else {
        setResult('Stored token invalid or expired');
      }
    } catch (error) {
      setResult(`Error testing stored token: ${error}`);
    }
  };

  const clearAuth = () => {
    TokenManager.clearAuth();
    setResult('Authentication data cleared');
  };

  const testLocalStorage = () => {
    try {
      // Test basic localStorage functionality
      const testKey = 'test_storage_key';
      const testValue = 'test_storage_value';
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (retrieved === testValue) {
        setResult('LocalStorage test: PASSED');
      } else {
        setResult('LocalStorage test: FAILED - retrieval mismatch');
      }
    } catch (error) {
      setResult(`LocalStorage test: FAILED - ${error}`);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Authentication Test</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="space-y-2">
          <button
            onClick={testLogin}
            disabled={loading}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Login'}
          </button>
          
          <button
            onClick={testStoredToken}
            className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
          >
            Test Stored Token
          </button>
          
          <button
            onClick={clearAuth}
            className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600"
          >
            Clear Auth Data
          </button>
          
          <button
            onClick={testLocalStorage}
            className="w-full bg-purple-500 text-white p-2 rounded hover:bg-purple-600"
          >
            Test LocalStorage
          </button>
        </div>
        
        {result && (
          <div className="mt-4 p-3 bg-gray-100 rounded whitespace-pre-wrap text-sm">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}