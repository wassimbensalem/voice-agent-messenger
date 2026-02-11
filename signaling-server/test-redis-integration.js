#!/usr/bin/env node
/**
 * Redis Integration Test Script
 * Tests all Redis services for the signaling server
 */

const Redis = require('ioredis');

async function runTests() {
  console.log('🧪 Starting Redis Integration Tests\n');

  const redis = new Redis('redis://localhost:6379');
  let passed = 0;
  let failed = 0;

  function test(name, condition) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}`);
      failed++;
    }
  }

  try {
    // Test 1: Basic Connection
    console.log('1. Redis Connection Tests');
    console.log('─'.repeat(40));
    const pong = await redis.ping();
    test('Redis responds to PING', pong === 'PONG');

    // Test 2: Session Storage
    console.log('\n2. Session Storage Tests');
    console.log('─'.repeat(40));
    const testSession = {
      id: 'test-session-123',
      agentId: 'agent-test',
      socketId: 'socket-test',
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    await redis.setex('session:test-session-123', 3600, JSON.stringify(testSession));
    const retrievedSession = JSON.parse(await redis.get('session:test-session-123'));
    test('Session storage and retrieval', retrievedSession.id === testSession.id);

    // Test session indexing
    await redis.sadd('session:agent:agent-test', 'test-session-123');
    const agentSessions = await redis.smembers('session:agent:agent-test');
    test('Session indexing by agent', agentSessions.includes('test-session-123'));

    // Test 3: Rate Limiting
    console.log('\n3. Rate Limiting Tests');
    console.log('─'.repeat(40));
    
    const rateLimitKey = 'ratelimit:test-api:0';
    const window = Math.floor(Date.now() / 60000);
    const rateKey = `ratelimit:test-api:${window}`;

    for (let i = 0; i < 5; i++) {
      await redis.incr(rateKey);
    }
    const count = await redis.get(rateKey);
    test('Rate limit counter increments', parseInt(count) === 5);

    const remaining = Math.max(0, 100 - parseInt(count));
    test('Rate limit remaining calculated', remaining === 95);

    // Test 4: Pub/Sub
    console.log('\n4. Pub/Sub Tests');
    console.log('─'.repeat(40));
    
    const subscriber = new Redis('redis://localhost:6379');
    let messageReceived = false;
    
    await subscriber.subscribe('signaling:test-channel');
    subscriber.on('message', (channel, message) => {
      if (channel === 'signaling:test-channel') {
        messageReceived = true;
      }
    });

    await redis.publish('signaling:test-channel', JSON.stringify({ test: 'data' }));
    await new Promise(resolve => setTimeout(resolve, 100));
    test('Pub/Sub message delivery', messageReceived);

    await subscriber.quit();

    // Test 5: Room Events
    console.log('\n5. Room Events Tests');
    console.log('─'.repeat(40));
    
    const roomData = {
      id: 'room-123',
      name: 'Test Room',
      type: 'voice',
      createdBy: 'agent-1',
      participantCount: 0,
      maxParticipants: 10
    };

    await redis.setex('room:room-123', 300, JSON.stringify(roomData));
    const retrievedRoom = JSON.parse(await redis.get('room:room-123'));
    test('Room storage and retrieval', retrievedRoom.id === roomData.id);

    // Room participant indexing
    await redis.sadd('room:room-123:participants', 'participant-1', 'participant-2');
    const participants = await redis.smembers('room:room-123:participants');
    test('Room participant indexing', participants.length === 2);

    // Test 6: Cleanup
    console.log('\n6. Cleanup Tests');
    console.log('─'.repeat(40));
    
    await redis.del('session:test-session-123');
    await redis.del('session:agent:agent-test');
    await redis.del(`room:room-123`);
    await redis.del(`room:room-123:participants`);
    await redis.del(rateKey);

    const cleanedSession = await redis.get('session:test-session-123');
    test('Cleanup removes session', cleanedSession === null);

    // Summary
    console.log('\n' + '═'.repeat(40));
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
    console.log('═'.repeat(40));

    if (failed === 0) {
      console.log('\n🎉 All Redis integration tests passed!\n');
    } else {
      console.log('\n⚠️  Some tests failed. Review the output above.\n');
    }

    await redis.quit();
    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    await redis.quit();
    process.exit(1);
  }
}

runTests();
