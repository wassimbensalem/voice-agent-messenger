# WebRTC Voice Client API Documentation

## Overview

The WebRTC Voice Client is a TypeScript library that provides voice communication capabilities using WebRTC and Socket.IO signaling. It integrates with the agent-link system for authentication and supports Whisper STT and Piper TTS services.

## Installation

```bash
npm install socket.io-client uuid
npm install -D typescript ts-node @types/node @types/uuid
```

## Quick Start

```typescript
import { WebRTCVoiceClient } from 'webrtc-voice-client';

const client = new WebRTCVoiceClient({
  signalingUrl: 'ws://localhost:3000',
  agentId: 'agent-scout',
  agentLinkToken: process.env.AGENT_LINK_TOKEN,
  roomId: 'voice-room-123',
});

// Event handlers
client.on('room_joined', (room) => {
  console.log('Joined room:', room.name);
});

client.on('transcript', (transcript) => {
  console.log('Heard:', transcript.text);
});

// Initialize and connect
await client.initialize();
await client.connect();
await client.joinRoom({ roomId: 'voice-room-123' });
```

## WebRTCVoiceClient API

### Constructor

```typescript
constructor(config: WebRTCVoiceClientConfig)
```

Creates a new client instance with the specified configuration.

**Parameters:**
- `config` (WebRTCVoiceClientConfig): Configuration object

**Example:**
```typescript
const client = new WebRTCVoiceClient({
  signalingUrl: 'ws://localhost:3000',
  agentId: 'my-agent',
  agentLinkToken: 'jwt-token',
  roomId: 'room-1',
  audioConfig: {
    sampleRate: 48000,
    echoCancellation: true,
    noiseSuppression: true,
  },
});
```

### Methods

#### initialize()

```typescript
async initialize(): Promise<void>
```

Initialize the client, setting up audio context and local media stream.

**Throws:** Error if microphone access is denied

**Example:**
```typescript
await client.initialize();
```

#### connect()

```typescript
async connect(): Promise<void>
```

Connect to the signaling server. Authentication via agent-link token is handled automatically.

**Prerequisites:** Must call `initialize()` first (or this method will call it)

**Throws:** Error if connection fails after max retries

**Example:**
```typescript
await client.connect();
```

#### disconnect()

```typescript
disconnect(): void
```

Disconnect from the signaling server and clean up resources.

**Example:**
```typescript
client.disconnect();
```

#### joinRoom()

```typescript
async joinRoom(options: JoinRoomOptions): Promise<VoiceRoom | null>
```

Join a voice room.

**Parameters:**
- `options` (JoinRoomOptions): Room join options

**Returns:** VoiceRoom object or null if join fails

**Example:**
```typescript
const room = await client.joinRoom({
  roomId: 'main-room',
  audioEnabled: true,
  metadata: { role: 'speaker' },
});
```

#### leaveRoom()

```typescript
leaveRoom(options?: LeaveRoomOptions): void
```

Leave the current room.

**Parameters:**
- `options` (optional): Leave options with reason

**Example:**
```typescript
client.leaveRoom({ reason: 'User disconnected' });
```

#### enableAudio()

```typescript
async enableAudio(): Promise<void>
```

Enable audio transmission to peers.

**Example:**
```typescript
await client.enableAudio();
```

#### disableAudio()

```typescript
async disableAudio(): Promise<void>
```

Disable audio transmission to peers.

**Example:**
```typescript
await client.disableAudio();
```

#### speak()

```typescript
async speak(text: string, options?: Partial<TTSInput>): Promise<boolean>
```

Synthesize and speak text using Piper TTS.

**Parameters:**
- `text` (string): Text to speak
- `options` (optional): TTS options (voiceId, rate, pitch, volume)

**Returns:** true if speech started successfully

**Example:**
```typescript
await client.speak('Hello, world!', {
  voiceId: 'en_US-lessac-medium',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
});
```

#### transcribeAudio()

```typescript
async transcribeAudio(audioData: Float32Array, isFinal?: boolean): Promise<TranscriptResult | null>
```

Transcribe audio data using Whisper STT.

**Parameters:**
- `audioData` (Float32Array): PCM audio data
- `isFinal` (optional): Whether this is final transcription

**Returns:** TranscriptResult or null

**Example:**
```typescript
const result = await client.transcribeAudio(audioData, true);
console.log(result?.text);
```

#### getCurrentRoom()

```typescript
getCurrentRoom(): VoiceRoom | null
```

Get the current room information.

**Returns:** VoiceRoom object or null if not in a room

**Example:**
```typescript
const room = client.getCurrentRoom();
console.log(room?.roomId, room?.participants.length);
```

#### getConnectionState()

```typescript
getConnectionState(): ConnectionState
```

Get the current connection state.

**Returns:** ConnectionState ('disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed')

**Example:**
```typescript
const state = client.getConnectionState();
console.log('State:', state);
```

#### getLocalStream()

```typescript
getLocalStream(): MediaStream | null
```

Get the local audio stream.

**Returns:** MediaStream or null

#### getAgentId()

```typescript
getAgentId(): string
```

Get the agent ID.

**Returns:** Agent ID string

### Event Handlers

#### on()

```typescript
on<Event extends ClientEventType>(
  event: Event,
  callback: EventCallback
): this
```

Subscribe to an event.

**Parameters:**
- `event` (ClientEventType): Event name
- `callback` (EventCallback): Event handler

**Returns:** this for chaining

**Example:**
```typescript
client.on('transcript', (data) => {
  console.log('Heard:', data.text);
});
```

#### once()

```typescript
once<Event extends ClientEventType>(
  event: Event,
  callback: EventCallback
): this
```

Subscribe to an event once.

#### off()

```typescript
off<Event extends ClientEventType>(
  event: Event,
  callback?: EventCallback
): this
```

Unsubscribe from an event.

## Events

### Connection Events

| Event | Payload | Description |
|-------|---------|-------------|
| `state_changed` | `{ state: ConnectionState, ... }` | Connection state changed |
| `connected` | - | Connected to signaling server |
| `disconnected` | `{ reason?: string }` | Disconnected from server |
| `error` | ClientError | An error occurred |

### Room Events

| Event | Payload | Description |
|-------|---------|-------------|
| `room_joined` | VoiceRoom | Successfully joined a room |
| `room_left` | - | Left the current room |
| `room_users` | RoomParticipant[] | List of room participants |
| `user_joined` | RoomParticipant | A user joined the room |
| `user_left` | `{ participantId: string, agentId: string }` | A user left the room |

### Audio Events

| Event | Payload | Description |
|-------|---------|-------------|
| `transcript` | TranscriptResult | Final transcription received |
| `partial_transcript` | TranscriptResult | Partial transcription (streaming) |
| `remote_track` | `{ socketId, agentId, stream, track }` | Remote audio track received |
| `audio_input` | AudioBuffer | Local audio input data |
| `audio_output` | AudioBuffer | Audio data being sent to TTS |

## Configuration Types

### WebRTCVoiceClientConfig

```typescript
interface WebRTCVoiceClientConfig {
  signalingUrl: string;        // Signaling server URL
  agentLinkToken?: string;      // Agent-Link JWT token
  agentId: string;             // Agent identifier
  roomId?: string;              // Room to join
  iceServers?: RTCIceServer[];  // ICE servers
  socketOptions?: {
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
    timeout?: number;
  };
  audioConfig?: {
    sampleRate?: number;
    channels?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
  };
  sttConfig?: {
    serverUrl: string;
    language?: string;
    enablePartialResults?: boolean;
  };
  ttsConfig?: {
    serverUrl: string;
    voice?: string;
    outputSampleRate?: number;
  };
}
```

### VoiceRoom

```typescript
interface VoiceRoom {
  roomId: string;
  name: string;
  type: 'voice' | 'video';
  maxParticipants: number;
  participants: RoomParticipant[];
  createdBy: string;
  createdAt: Date;
}
```

### RoomParticipant

```typescript
interface RoomParticipant {
  id: string;
  agentId: string;
  socketId: string;
  audioEnabled: boolean;
  joinedAt: Date;
}
```

### TranscriptResult

```typescript
interface TranscriptResult {
  text: string;
  isPartial: boolean;
  timestamp: Date;
  confidence?: number;
}
```

### ConnectionState

```typescript
type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';
```

## Signaling Protocol

### Client → Server Events

| Event | Payload |
|-------|---------|
| `authenticate` | `{ token, agentId }` |
| `join_room` | `{ roomId, agentId, audioEnabled, metadata }` |
| `leave_room` | `{ reason }` |
| `offer` | `{ from, fromSocketId, sdp }` |
| `answer` | `{ from, fromSocketId, sdp }` |
| `candidate` | `{ from, fromSocketId, candidate }` |
| `broadcast` | `{ data, from }` |
| `data` | `{ data, from }` |

### Server → Client Events

| Event | Payload |
|-------|---------|
| `auth_ok` | - |
| `auth_error` | `{ message }` |
| `room_joined` | `{ room }` |
| `room_users` | `{ participants }` |
| `user_joined` | `{ participant }` |
| `user_left` | `{ participantId, agentId }` |
| `offer` | `{ from, fromSocketId, sdp }` |
| `answer` | `{ from, fromSocketId, sdp }` |
| `candidate` | `{ from, fromSocketId, candidate }` |
| `data` | `{ from, data }` |

## Authentication

The client uses agent-link JWT tokens for authentication:

```typescript
const client = new WebRTCVoiceClient({
  signalingUrl: 'ws://localhost:3000',
  agentId: 'agent-scout',
  agentLinkToken: process.env.AGENT_LINK_TOKEN, // JWT from agent-link
});
```

The token is automatically sent during connection via Socket.IO auth mechanism.

## Error Handling

### ClientError

```typescript
interface ClientError {
  code: string;        // Error code
  message: string;     // Human-readable message
  originalError?: Error;
  timestamp: Date;
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `CONNECTION_FAILED` | Failed to connect to signaling server |
| `AUTH_FAILED` | Authentication failed (invalid token) |
| `ROOM_FULL` | Room has reached maximum capacity |
| `ROOM_NOT_FOUND` | Room does not exist |
| `OFFER_FAILED` | Failed to create WebRTC offer |
| `ANSWER_HANDLING_FAILED` | Failed to handle WebRTC answer |
| `PEER_CONNECTION_FAILED` | WebRTC peer connection failed |

## Complete Example

```typescript
import { WebRTCVoiceClient } from 'webrtc-voice-client';

async function main() {
  const client = new WebRTCVoiceClient({
    signalingUrl: 'ws://localhost:3000',
    agentId: 'agent-scout',
    agentLinkToken: process.env.AGENT_LINK_TOKEN,
    roomId: 'main-room',
  });

  // Connection events
  client.on('state_changed', (data) => {
    console.log('State:', data.state);
  });

  client.on('error', (error) => {
    console.error('Error:', error.message);
  });

  // Room events
  client.on('room_joined', (room) => {
    console.log(`Joined room: ${room.name}`);
  });

  client.on('user_joined', (participant) => {
    console.log(`${participant.agentId} joined`);
  });

  client.on('user_left', (data) => {
    console.log(`${data.agentId} left`);
  });

  // Voice events
  client.on('transcript', async (transcript) => {
    console.log(`Heard: "${transcript.text}"`);
    
    // Generate response
    const response = await generateResponse(transcript.text);
    await client.speak(response);
  });

  // Connect and join
  await client.initialize();
  await client.connect();
  await client.joinRoom({ roomId: 'main-room' });
}
