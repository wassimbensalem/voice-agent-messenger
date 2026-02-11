# WebRTC Voice Client Library

A TypeScript library for WebRTC voice communication with Socket.IO signaling and integration with Whisper STT and Piper TTS.

## Installation

```bash
# Install dependencies
npm install socket.io-client uuid

# For TypeScript projects
npm install -D typescript ts-node @types/node @types/uuid
```

## Quick Start

```typescript
import { WebRTCVoiceClient } from 'webrtc-voice-client';

const client = new WebRTCVoiceClient({
  signalingUrl: 'ws://localhost:3000',
  agentId: 'agent-scout',
  agentLinkToken: 'your-jwt-token',
  roomId: 'voice-room-123',
  audioConfig: {
    sampleRate: 48000,
    echoCancellation: true,
    noiseSuppression: true,
  },
  sttConfig: {
    serverUrl: 'http://localhost:8001',
    language: 'en',
  },
  ttsConfig: {
    serverUrl: 'http://localhost:5000',
    voice: 'en_US-lessac-medium',
  },
});

// Set up event handlers
client.on('room_joined', (room) => {
  console.log('Joined room:', room.name);
});

client.on('transcript', (transcript) => {
  console.log('Heard:', transcript.text);
});

// Connect and join
await client.initialize();
await client.connect();
await client.joinRoom({ roomId: 'voice-room-123' });

// Speak
await client.speak('Hello everyone!');
```

## Features

- **Socket.IO Signaling** - WebSocket-based signaling server integration
- **WebRTC Peer Connections** - Full mesh peer-to-peer audio communication
- **Voice Pipeline** - Built-in integration with Whisper STT and Piper TTS
- **Agent-Link Integration** - JWT-based authentication with agent-link system
- **Event-Driven API** - Simple event subscription model
- **TypeScript Support** - Full type definitions included

## API Reference

### WebRTCVoiceClient

#### `constructor(config: WebRTCVoiceClientConfig)`
Create a new client instance.

#### `initialize(): Promise<void>`
Initialize audio context and local media stream.

#### `connect(): Promise<void>`
Connect to the signaling server.

#### `disconnect(): void`
Disconnect and clean up resources.

#### `joinRoom(options: JoinRoomOptions): Promise<VoiceRoom | null>`
Join a voice room.

#### `leaveRoom(options?: LeaveRoomOptions): void`
Leave the current room.

#### `enableAudio(): Promise<void>`
Enable audio transmission.

#### `disableAudio(): Promise<void>`
Disable audio transmission.

#### `speak(text: string, options?: TTSInput): Promise<boolean>`
Synthesize and speak text.

#### `transcribeAudio(audioData: Float32Array, isFinal: boolean): Promise<TranscriptResult | null>`
Transcribe audio data.

#### `getCurrentRoom(): VoiceRoom | null`
Get the current room information.

#### `getConnectionState(): ConnectionState`
Get the current connection state.

### Events

| Event | Description |
|-------|-------------|
| `state_changed` | Connection state changed |
| `room_joined` | Successfully joined a room |
| `room_users` | List of room participants received |
| `user_joined` | A user joined the room |
| `user_left` | A user left the room |
| `transcript` | Final transcription received |
| `partial_transcript` | Partial transcription (streaming) |
| `remote_track` | Remote audio track received |
| `error` | An error occurred |
| `disconnected` | Disconnected from server |

## Configuration

```typescript
interface WebRTCVoiceClientConfig {
  // Required
  signalingUrl: string;
  agentId: string;
  
  // Optional
  agentLinkToken?: string;
  roomId?: string;
  iceServers?: RTCIceServer[];
  
  // Audio configuration
  audioConfig?: {
    sampleRate?: number;
    channels?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
  };
  
  // Whisper STT configuration
  sttConfig?: {
    serverUrl: string;
    language?: string;
    enablePartialResults?: boolean;
  };
  
  // Piper TTS configuration
  ttsConfig?: {
    serverUrl: string;
    voice?: string;
    outputSampleRate?: number;
  };
}
```

## Signaling Server Protocol

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `authenticate` | `{ token, agentId }` | Authenticate with agent-link token |
| `join_room` | `{ roomId, agentId, audioEnabled, metadata }` | Join a voice room |
| `leave_room` | `{ reason }` | Leave current room |
| `offer` | `{ from, fromSocketId, sdp }` | Send SDP offer |
| `answer` | `{ from, fromSocketId, sdp }` | Send SDP answer |
| `candidate` | `{ from, fromSocketId, candidate }` | Send ICE candidate |
| `broadcast` | `{ data, from }` | Broadcast data to room |
| `data` | `{ data, from }` | Send data to specific peer |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `auth_ok` | - | Authentication successful |
| `auth_error` | `{ message }` | Authentication failed |
| `room_joined` | `{ room }` | Successfully joined room |
| `room_users` | `{ participants }` | List of room participants |
| `user_joined` | `{ participant }` | A user joined |
| `user_left` | `{ participantId, agentId }` | A user left |
| `offer` | `{ from, fromSocketId, sdp }` | Received SDP offer |
| `answer` | `{ from, fromSocketId, sdp }` | Received SDP answer |
| `candidate` | `{ from, fromSocketId, candidate }` | Received ICE candidate |
| `data` | `{ from, data }` | Received data message |

## Examples

See the `examples/` directory for complete examples.

### Basic Voice Chat

```typescript
// examples/basic-usage.ts
import { WebRTCVoiceClient } from './src';

const client = new WebRTCVoiceClient({
  signalingUrl: 'ws://localhost:3000',
  agentId: 'agent-max',
});

client.on('transcript', async (transcript) => {
  // Process speech input
  const response = await generateResponse(transcript.text);
  await client.speak(response);
});

await client.initialize();
await client.connect();
await client.joinRoom({ roomId: 'main-room' });
```

### Custom Signaling Server

```typescript
// server/signaling-server.ts
import { Server } from 'socket.io';
import { createServer } from 'http';

const io = new Server(createServer(), {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  socket.on('join_room', (data) => {
    socket.join(data.roomId);
    socket.to(data.roomId).emit('user_joined', data);
  });
  
  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', data);
  });
  
  // ... handle other signaling events
});

io.listen(3000);
```

## Integration with Agent-Link

The client integrates with the agent-link system for authentication:

```typescript
const client = new WebRTCVoiceClient({
  signalingUrl: 'ws://localhost:3000',
  agentId: 'agent-scout',
  agentLinkToken: process.env.AGENT_LINK_TOKEN, // JWT from agent-link
});

// Token is automatically sent during connection
await client.connect();
```

## License

MIT
