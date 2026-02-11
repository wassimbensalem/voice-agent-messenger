/**
 * Debug server auth test
 */

const http = require('http');
const jwt = require('jsonwebtoken');

// The secret should match what's in the server
const secret = 'your-secret-key-change-in-production';

console.log('Using secret:', secret);

// Generate a fresh token
const token = jwt.sign({agentId: 'test-agent'}, secret, {expiresIn: '5m'});
console.log('Fresh token:', token);

// Decode to verify
const decoded = jwt.decode(token);
console.log('Decoded:', JSON.stringify(decoded, null, 2));

// Make the request
const postData = JSON.stringify({
  name: 'Test Room',
  type: 'voice'
});

const options = {
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

console.log('\nMaking request...');
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(postData);
req.end();

console.log('Request sent, waiting for response...');
