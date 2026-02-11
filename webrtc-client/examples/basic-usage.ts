/**
 * WebRTC Voice Client Example
 * Demonstrates how to use the WebRTC voice client for agent communication
 */

import { WebRTCVoiceClient } from './src/index';
import type { VoiceRoom, RoomParticipant, TranscriptResult, ClientError } from './src/types';

/**
 * Example configuration
 */
const config = {
  signalingUrl: 'ws://localhost:3000',
  agentLinkToken: 'your-agent-link-jwt-token',
  agentId: 'agent-scout',
  roomId: 'voice-room-123',
  audioConfig: {
    sampleRate: 48000,
    channels: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  sttConfig: {
    serverUrl: 'http://localhost:8001',
    language: 'en',
    enablePartialResults: true,
  },
  ttsConfig: {
    serverUrl: 'http://localhost:5000',
    voice: 'en_US-lessac-medium',
    outputSampleRate: 22050,
  },
};

/**
 * Main example function
 */
async function main() {
  console.log('[Example] Starting WebRTC Voice Client...');

  // Create client
  const client = new WebRTCVoiceClient(config);

  // Set up event handlers
  setupEventHandlers(client);

  // Initialize and connect
  try {
    await client.initialize();
    await client.connect();
    console.log('[Example] Connected to signaling server');

    // Join room
    await client.joinRoom({
      roomId: config.roomId!,
      audioEnabled: true,
    });
    console.log('[Example] Joined room:', config.roomId);

    // Example: Enable audio
    await client.enableAudio();

    // Example: Speak a message
    await client.speak('Hello! I have joined the voice room.');
    console.log('[Example] Spoke greeting');

    // Example: Wait for transcripts
    console.log('[Example] Listening for speech...');

    // Keep the client running
    console.log('[Example] Client is ready. Press Ctrl+C to exit.');

  } catch (error) {
    console.error('[Example] Error:', error);
    process.exit(1);
  }
}

/**
 * Set up event handlers
 */
function setupEventHandlers(client: WebRTCVoiceClient) {
  // Connection state changed
  client.on('state_changed', (data: any) => {
    console.log('[Example] State changed:', data.state);
  });

  // Joined room
  client.on('room_joined', (room: VoiceRoom) => {
    console.log('[Example] Room joined:', room.name);
    console.log('[Example] Participants:', room.participants.length);
    
    // List participants
    room.participants.forEach((p) => {
      console.log(`  - ${p.agentId} (${p.audioEnabled ? 'audio on' : 'audio off'})`);
    });
  });

  // User joined
  client.on('user_joined', (participant: RoomParticipant) => {
    console.log('[Example] User joined:', participant.agentId);
  });

  // User left
  client.on('user_left', (data: { participantId: string; agentId: string }) => {
    console.log('[Example] User left:', data.agentId);
  });

  // Transcript received
  client.on('transcript', (transcript: TranscriptResult) => {
    console.log('[Example] Transcript:', transcript.text);
    
    // Example: Respond to transcript
    if (transcript.text.toLowerCase().includes('hello')) {
      client.speak('Hello! How can I help you?');
    }
  });

  // Partial transcript (for streaming)
  client.on('partial_transcript', (transcript: TranscriptResult) => {
    // Update UI with partial result
    console.log('[Example] Partial:', transcript.text);
  });

  // Remote track received
  client.on('remote_track', (data: { agentId: string; stream: MediaStream }) => {
    console.log('[Example] Received audio from:', data.agentId);
    
    // Play remote audio
    const audio = new Audio();
    audio.srcObject = data.stream;
    audio.play();
  });

  // Data channel message
  client.on('data_channel_message', (data: { agentId: string; data: any }) => {
    console.log('[Example] Data from', data.agentId, ':', data.data);
  });

  // Error
  client.on('error', (error: ClientError) => {
    console.error('[Example] Client error:', error.code, error.message);
  });

  // Disconnected
  client.on('disconnected', (data: any) => {
    console.log('[Example] Disconnected:', data.reason);
  });
}

// Run example
main().catch(console.error);
