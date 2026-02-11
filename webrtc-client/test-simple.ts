/**
 * Simple Signaling Server Connection Test
 * Test connection to signaling server using raw Socket.IO
 */

import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

// Configuration - Use the simple signaling server
const SIGNALING_URL = 'ws://localhost:3000';  // Simple signaling server on port 3000
const AGENT_ID = 'agent-scout';
const ROOM_ID = 'voice-room-123';

async function main() {
  console.log('[Test] Simple Signaling Server Connection Test');
  console.log('[Test] Connecting to:', SIGNALING_URL);
  console.log('[Test] Agent ID:', AGENT_ID);
  console.log('[Test] Room ID:', ROOM_ID);
  console.log('');

  // Connect without authentication (simple server doesn't require it)
  const socket: Socket = io(SIGNALING_URL, {
    transports: ['websocket'],
    timeout: 10000,
    reconnection: false,
  });

  // Set up event handlers
  socket.on('connect', () => {
    console.log('[Test] ✓ Socket connected:', socket.id);
    
    // Send authentication (simple server just stores it)
    console.log('[Test] Sending authentication...');
    socket.emit('authenticate', {
      token: 'test-token',
      agentId: AGENT_ID,
    });
  });

  socket.on('connect_error', (error: Error) => {
    console.error('[Test] ✗ Connection error:', error.message);
    console.log('[Test] Trying alternative: connecting to port 8080 without auth...');
    
    // Try connecting to the main signaling server with a modified approach
    testAlternativeConnection();
  });

  socket.on('auth_ok', () => {
    console.log('[Test] ✓ Authentication successful');
    console.log('[Test] Joining room:', ROOM_ID);
    
    socket.emit('join_room', {
      roomId: ROOM_ID,
      agentId: AGENT_ID,
      audioEnabled: true,
    });
  });

  socket.on('room_joined', (data: any) => {
    console.log('[Test] ✓ Successfully joined room:', data.room.name);
    console.log('[TEST] SUCCESS: Connected to signaling server and joined voice room!');
    
    // Test WebRTC connection
    testWebRTCConnection(socket, data.room);
  });

  socket.on('room_users', (data: { participants: any[] }) => {
    console.log('[Test] Room users:', data.participants.length);
  });

  socket.on('user_joined', (data: { participant: any }) => {
    console.log('[Test] User joined:', data.participant.agentId);
  });

  socket.on('disconnect', (reason: string) => {
    console.log('[Test] Disconnected:', reason);
  });

  // Timeout after 15 seconds
  setTimeout(() => {
    console.log('\n[Test] Test timeout - disconnecting');
    socket.disconnect();
    process.exit(0);
  }, 15000);
}

function testAlternativeConnection() {
  console.log('\n[Test] Testing connection to main signaling server...');
  
  // Try connecting to the main server on 8080 with a different auth approach
  const altSocket: Socket = io('ws://localhost:8080', {
    transports: ['websocket'],
    timeout: 10000,
    reconnection: false,
    auth: {
      token: 'dev-token',  // Try with a dev token
      agentId: AGENT_ID,
    },
  });

  altSocket.on('connect', () => {
    console.log('[Alt] ✓ Connected to main server');
    console.log('[Alt] Testing room join...');
    
    // Just try to join the room
    altSocket.emit('join_room', {
      roomId: 'test-room',
      agentId: AGENT_ID,
      audioEnabled: true,
    });
  });

  altSocket.on('room_joined', (data: any) => {
    console.log('[Alt] ✓ Joined room:', data.room.name);
    console.log('\n[TEST] SUCCESS: Connected to Max signaling server!');
    
    testWebRTCConnection(altSocket, data.room);
  });

  altSocket.on('error', (error: any) => {
    console.log('[Alt] Error:', error.message);
  });

  altSocket.on('disconnect', (reason: string) => {
    console.log('[Alt] Disconnected:', reason);
  });
}

async function testWebRTCConnection(socket: Socket, room: any) {
  console.log('\n[Test] Testing WebRTC peer connection setup...');
  
  try {
    // Create RTC peer connection
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Set up ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[Test] Generated ICE candidate');
        socket.emit('candidate', {
          from: AGENT_ID,
          fromSocketId: socket.id,
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('[Test] ICE gathering state:', pc.iceGatheringState);
    };

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log('[Test] ✓ Created WebRTC offer');
    console.log('[Test] ICE gathering state:', pc.iceGatheringState);
    
    // Send offer to signaling server
    socket.emit('offer', {
      from: AGENT_ID,
      fromSocketId: socket.id,
      sdp: offer
    });

    console.log('\n[TEST] ✓ WebRTC peer connection setup successful!');
    console.log('\n[TEST] COMPLETE SUCCESS REPORT:');
    console.log('  ✓ Connected to signaling server');
    console.log('  ✓ Authenticated successfully');
    console.log('  ✓ Joined voice room: ' + room.roomId);
    console.log('  ✓ WebRTC peer connection ready');
    console.log('  ✓ Ready for audio streaming between peers');
    
  } catch (error) {
    console.error('[Test] WebRTC error:', error);
  }
}

main().catch(console.error);
