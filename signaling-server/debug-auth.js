/**
 * Debug auth test script
 */

const jwt = require('jsonwebtoken');

const secret = 'your-secret-key-change-in-production';

// Test 1: Token without exp
const token1 = jwt.sign({agentId: 'test-agent'}, secret);
console.log('Token 1 (no exp):', token1);

// Test 2: Token with exp
const token2 = jwt.sign({agentId: 'test-agent', exp: Math.floor(Date.now() / 1000) + 3600}, secret);
console.log('Token 2 (with exp):', token2);

// Test 3: Token with expiresIn
const token3 = jwt.sign({agentId: 'test-agent'}, secret, {expiresIn: '1h'});
console.log('Token 3 (expiresIn):', token3);

// Decode all tokens
console.log('\nDecoded tokens:');
console.log('Token 1:', JSON.stringify(jwt.decode(token1), null, 2));
console.log('Token 2:', JSON.stringify(jwt.decode(token2), null, 2));
console.log('Token 3:', JSON.stringify(jwt.decode(token3), null, 2));

// Verify all tokens
console.log('\nVerification:');
try {
  console.log('Token 1 valid:', jwt.verify(token1, secret) !== null);
} catch(e) { console.log('Token 1 error:', e.message); }

try {
  console.log('Token 2 valid:', jwt.verify(token2, secret) !== null);
} catch(e) { console.log('Token 2 error:', e.message); }

try {
  console.log('Token 3 valid:', jwt.verify(token3, secret) !== null);
} catch(e) { console.log('Token 3 error:', e.message); }
