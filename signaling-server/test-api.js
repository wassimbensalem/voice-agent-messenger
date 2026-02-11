/**
 * Quick integration test script
 */

const http = require('http');
const jwt = require('jsonwebtoken');

const secret = 'your-secret-key-change-in-production';
const token = jwt.sign({agentId: 'test-agent'}, secret, {expiresIn: '1h'});

console.log('Generated token:', token);
console.log('');

// Test POST /api/rooms
const postData = JSON.stringify({
  name: 'Test Voice Room',
  type: 'voice'
});

const postOptions = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/rooms',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing POST /api/rooms on port 8080...');
const req = http.request(postOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
