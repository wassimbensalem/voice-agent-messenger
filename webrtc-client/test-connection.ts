/**
 * WebRTC Client Connection Test
 * Connect to signaling server and establish voice call
 */

import { WebRTCVoiceClient } from './src/index';

// Configuration for connecting to Max's signaling server
const config = {
  signalingUrl: 'ws://localhost:8080',
  agentId: 'agent-scout',
  agentLinkToken: 'test-token',
  roomId: 'voice-room-123',
  audioConfig: {
    sampleRate: 48000,
    channels: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

/**
 * Main test function
 */
async function main() {
  console.log('[Test] Starting WebRTC Client Connection Test...');
  console.log('[Test] Connecting to:', config.signalingUrl);
  console.log('[Test] Agent ID:', config.agentId);
  console.log('[Test] Room ID:', config.roomId);
  console.log('');

  // Create client
  const client = new WebRTCVoiceClient(config);

  // Set up event handlers using any type to avoid TypeScript issues
  const setupHandlers = (c: any) => {
    // Connection state changed
    c.on('state_changed', (data: any) => {
      console.log('[Test] State changed:', data.state);
    });

    // Room events
    c.on('room_joined', (room: any) => {
      console.log('[Test] ✓ Room joined:', room.name);
      console.log('[Test] Participants:', room.participants?.length || 0);
    });

    c.on('room_left', () => {
      console.log('[Test] Room left');
    });

    c.on('user_joined', (participant: any) => {
      console.log('[Test] User joined:', participant.agentId);
    });

    c.on('user_left', (data: any) => {
      console.log('[Test] User left:', data.agentId);
    });

    // Audio events
    c.on('remote_track', (data: any) => {
      console.log('[Test] ✓ Received audio from:', data.agentId);
    });

    c.on('transcript', (transcript: any) => {
      console.log('[Test] Transcript:', transcript.text);
    });

    // Errors
    c.on('error', (error: any) => {
      console.error('[Test] Client error:', error.code, error.message);
    });

    // Disconnected
    c.on('disconnected', (data: any) => {
      console.log('[Test] Disconnected:', data?.reason);
    });
  };

  setupHandlers(client);

  // Initialize and connect
  try {
    console.log('[Test] Initializing client...');
    await client.initialize();
    console.log('[Test] ✓ Client initialized successfully');

    console.log('[Test] Connecting to signaling server...');
    await client.connect();
    console.log('[Test] ✓ Connected to signaling server');

    console.log('[Test] Joining room...');
    const room = await client.joinRoom({
      roomId: config.roomId!,
      audioEnabled: true,
    });

    console.log('[Test] Room join initiated, waiting for confirmation...');

    // Wait a bit to receive events
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check current state
    const currentRoom = client.getCurrentRoom();
    const state = client.getConnectionState();
    
    console.log('\n[Test] Current state:');
    console.log('  - Connection state:', state);
    console.log('  - In room:', currentRoom?.roomId || 'none');
    
    if (currentRoom) {
      console.log('  - Room name:', currentRoom.name);
      console.log('  - Participants:', currentRoom.participants.length);
    }

    console.log('\n[Test] ✓ SUCCESS: WebRTC client connected to signaling server!');
    console.log('[Test] Ready for peer connection and audio streaming...');

    // Keep the connection alive
    console.log('\n[Test] Keeping connection alive for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Clean up
    console.log('\n[Test] Disconnecting...');
    client.disconnect();
    console.log('[Test] Test completed successfully!');

    process.exit(0);

  } catch (error) {
    console.error('[Test] ERROR:', error);
    process.exit(1);
  }
}

// Run test
main().catch(console.error);
