/**
 * Connection Test Script for WebRTC Voice Client
 * Tests connectivity to signaling server and agent-link authentication
 */

import { WebRTCVoiceClient } from './src';

// Test configuration
const TEST_CONFIG = {
  signalingUrl: process.env.SIGNALING_URL || 'ws://localhost:3000',
  agentId: process.env.AGENT_ID || 'test-agent',
  agentLinkToken: process.env.AGENT_LINK_TOKEN || '',
  roomId: process.env.ROOM_ID || 'test-room',
};

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
  error?: unknown;
}

const testResults: TestResult[] = [];

function logResult(result: TestResult): void {
  console.log(`[${result.passed ? '✓' : '✗'}] ${result.name}: ${result.message || (result.passed ? 'PASSED' : 'FAILED')}`);
  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }
  testResults.push(result);
}

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('WebRTC Voice Client - Connection Tests');
  console.log('='.repeat(60));
  console.log(`Signaling URL: ${TEST_CONFIG.signalingUrl}`);
  console.log(`Agent ID: ${TEST_CONFIG.agentId}`);
  console.log(`Room ID: ${TEST_CONFIG.roomId}`);
  console.log(`Token: ${TEST_CONFIG.agentLinkToken ? '***provided***' : 'NOT PROVIDED'}`);
  console.log('='.repeat(60));
  console.log('');

  // Test 1: Client instantiation
  console.log('--- Test 1: Client Instantiation ---');
  try {
    const client = new WebRTCVoiceClient({
      signalingUrl: TEST_CONFIG.signalingUrl,
      agentId: TEST_CONFIG.agentId,
      agentLinkToken: TEST_CONFIG.agentLinkToken,
      roomId: TEST_CONFIG.roomId,
    });
    logResult({
      name: 'Client Instantiation',
      passed: true,
      message: 'WebRTCVoiceClient created successfully',
    });

    // Test 2: Event handlers registration
    console.log('\n--- Test 2: Event Handler Registration ---');
    let stateChangedCount = 0;
    let errorCount = 0;

    client.on('state_changed', (data) => {
      stateChangedCount++;
      console.log(`  State changed: ${JSON.stringify(data)}`);
    });

    client.on('error', (error) => {
      errorCount++;
      console.log(`  Error event: ${JSON.stringify(error)}`);
    });

    logResult({
      name: 'Event Handler Registration',
      passed: true,
      message: `Registered 2 event handlers`,
    });

    // Test 3: Initialize client
    console.log('\n--- Test 3: Client Initialization ---');
    try {
      await client.initialize();
      logResult({
        name: 'Client Initialization',
        passed: true,
        message: 'Audio context and local stream initialized',
      });
    } catch (error) {
      logResult({
        name: 'Client Initialization',
        passed: false,
        message: 'Failed to initialize',
        error,
      });
    }

    // Test 4: Connection state check (before connect)
    console.log('\n--- Test 4: Pre-connection State ---');
    const preConnectState = client.getConnectionState();
    logResult({
      name: 'Pre-connection State Check',
      passed: preConnectState === 'disconnected',
      message: `State is: ${preConnectState}`,
    });

    // Test 5: Connect to server (with timeout)
    console.log('\n--- Test 5: Server Connection ---');
    const connectPromise = client.connect();
    const connectTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000);
    });

    try {
      await Promise.race([connectPromise, connectTimeout]);
      logResult({
        name: 'Server Connection',
        passed: true,
        message: 'Connected to signaling server',
      });
    } catch (error) {
      logResult({
        name: 'Server Connection',
        passed: false,
        message: 'Failed to connect to server',
        error,
      });
    }

    // Test 6: Post-connection state check
    console.log('\n--- Test 6: Post-connection State ---');
    const postConnectState = client.getConnectionState();
    logResult({
      name: 'Post-connection State Check',
      passed: postConnectState === 'connected',
      message: `State is: ${postConnectState}`,
    });

    // Test 7: Join room (if connected)
    console.log('\n--- Test 7: Room Join ---');
    if (postConnectState === 'connected') {
      try {
        const roomPromise = client.joinRoom({ roomId: TEST_CONFIG.roomId });
        const roomTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Room join timeout (10s)')), 10000);
        });

        await Promise.race([roomPromise, roomTimeout]);
        logResult({
          name: 'Room Join',
          passed: true,
          message: 'Joined room successfully',
        });
      } catch (error) {
        logResult({
          name: 'Room Join',
          passed: false,
          message: 'Failed to join room (server may not be available)',
          error,
        });
      }
    } else {
      logResult({
        name: 'Room Join',
        passed: false,
        message: 'Skipped - not connected to server',
      });
    }

    // Test 8: Cleanup
    console.log('\n--- Test 8: Cleanup ---');
    try {
      client.disconnect();
      logResult({
        name: 'Cleanup',
        passed: true,
        message: 'Client disconnected and cleaned up',
      });
    } catch (error) {
      logResult({
        name: 'Cleanup',
        passed: false,
        message: 'Error during cleanup',
        error,
      });
    }

  } catch (error) {
    logResult({
      name: 'Client Instantiation',
      passed: false,
      message: 'Failed to create client',
      error,
    });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(60));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
