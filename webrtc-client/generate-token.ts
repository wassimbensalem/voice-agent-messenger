/**
 * Generate a test JWT token for signaling server authentication
 */

import jwt from 'jsonwebtoken';

// JWT secret from the signaling server configuration
const JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';

// Test agent configuration
const AGENT_ID = 'agent-scout';
const ROOM_ID = 'voice-room-123';

// Generate a test JWT token
const token = jwt.sign(
  {
    agentId: AGENT_ID,
    roles: ['agent'],
    type: 'authentication'
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Generated JWT Token:');
console.log(token);
console.log('');

// Also generate a room join token
const roomToken = jwt.sign(
  {
    agentId: AGENT_ID,
    roomId: ROOM_ID,
    type: 'room_join'
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Room Join Token:');
console.log(roomToken);
console.log('');

// Verify the token
const decoded = jwt.verify(token, JWT_SECRET);
console.log('Decoded token:');
console.log(JSON.stringify(decoded, null, 2));
