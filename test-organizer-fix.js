// Test script to verify organizer recognition is working
import fetch from 'node-fetch';

async function testOrganizerRecognition() {
  try {
    // Test the status endpoint with a sample event
    const response = await fetch('http://localhost:5000/api/events/2/status', {
      method: 'GET',
      headers: {
        'Cookie': 'connect.sid=s%3A_example_session_id'  // This won't work but will show auth flow
      }
    });
    
    console.log('Status response:', response.status);
    const data = await response.text();
    console.log('Response data:', data);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testOrganizerRecognition();