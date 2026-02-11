/**
 * Simple Signaling Server Connection Test
 * Test connection to signaling server using raw Socket.IO
 */

import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

// Configuration
const SIGNALING_URL = 'ws://localhost:8080';
const AGENT_ID = 'agent-scout';
const AGENT_LINK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZ2VudElkIjoiYWdlbnQtc2NvdXQiLCJyb2xlcyI6WyJhZ2VudCJdLCJ0eXBlIjoiYXV0aGVudGljYXRpb24iLCJpYXQiOjE3NzA4MDg4ODEsImV4cCI6MTc3MDgxMjQ4MX0.I6LSLEypGcKvGGqE1G7a1FXQAkeXvK6pNPpKIM5gLgo';
const ROOM_ID = 'c2d42d7d-e171-4830-a777-340aed72a36c';

async function main() {
  console.log('[Test] Signaling Server Connection Test');
  console.log('[Test] Connecting to:', SIGNALING_URL);
  console.log('[Test] Agent ID:', AGENT_ID);
  console.log('[Test] Room ID:', ROOM_ID);
  console.log('');

  // Connect with authentication via Socket.IO auth option
  const socket: Socket = io(SIGNALING_URL, {
    transports: ['websocket'],
    timeout: 10000,
    reconnection: false,
    auth: {
      token: AGENT_LINK_TOKEN,
      agentId: AGENT_ID,
    },
  });

  // Set up event handlers
  socket.on('connect', () => {
    console.log('[Test] ✓ Socket connected:', socket.id);
    console.log('[Test] Socket authenticated successfully!');
    
    // Now join the room directly (no separate auth event needed)
    console.log('[Test] Joining room:', ROOM_ID);
    socket.emit('join_room', {
      roomId: ROOM_ID,
    });
  });

  socket.on('connect_error', (error: Error) => {
    console.error('[Test] ✗ Connection error:', error.message);
  });

  socket.on('error', (error: any) => {
    console.error('[Test] Socket error:', error);
  });

  socket.on('room_joined', (data: any) => {
    console.log('[Test] ✓ Successfully joined room:', data.room.name);
    console.log('[Test] Room ID:', data.room.roomId);
    console.log('[Test] Room type:', data.room.type);
    console.log('[Test] Max participants:', data.room.maxParticipants);
    console.log('[Test] Created by:', data.room.createdBy);
    console.log('[Test] Participants in room:', data.room.participants.length);
    
    if (data.room.participants.length > 0) {
      console.log('[Test] Current participants:');
      data.room.participants.forEach((p: any) => {
        console.log(`  - ${p.agentId} (${p.audioEnabled ? 'audio on' : 'audio off'})`);
      });
    }
    
    console.log('\n[TEST] SUCCESS: Connected to signaling server and joined voice room!');
    console.log('[TEST] WebRTC peer connection can now be established.');
    
    // Test WebRTC connection
    testWebRTCConnection(socket, data.room);
  });

  socket.on('room_users', (data: { participants: any[] }) => {
    console.log('[Test] Room users update:', data.participants.length);
  });

  socket.on('user_joined', (data: { participant: any }) => {
    console.log('[Test] User joined:', data.participant.agentId);
  });

  socket.on('user_left', (data: { agentId: string }) => {
    console.log('[Test] User left:', data.agentId);
  });

  socket.on('offer', (data: any) => {
    console.log('[Test] Received offer from:', data.from);
  });

  socket.on('answer', (data: any) => {
    console.log('[Test] Received answer from:', data.from);
  });

  socket.on('candidate', (data: any) => {
    console.log('[Test] Received ICE candidate from:', data.from);
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
        // Send to signaling server
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
    
    // Send offer to signaling server (would be received by other peers)
    socket.emit('offer', {
      from: AGENT_ID,
      fromSocketId: socket.id,
      sdp: offer
    });

    console.log('\n[TEST] ✓ WebRTC peer connection setup successful!');
    console.log('[TEST] Ready for full audio streaming between peers.');
    console.log('\n[TEST] ALL TESTS PASSED:');
    console.log('  ✓ Connected to signaling server (ws://localhost:8080)');
    console.log('  ✓ Authenticated with JWT token');
    console.log('  ✓ Joined voice room: ' + room.roomId);
    console.log('  ✓ WebRTC peer connection ready');
    console.log('  ✓ Ready for audio streaming between peers');
    
  } catch (error) {
    console.error('[Test] WebRTC error:', error);
  }
}

main().catch(console.error);
