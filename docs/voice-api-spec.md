# Voice Streaming API Specification

## Base URL
```
Development: ws://localhost:3000 (WebSocket)
             http://localhost:3000 (REST)
Production:  wss://api.voice-service.example.com (WebSocket)
             https://api.voice-service.example.com (REST)
```

---

## REST API

### Rooms

#### Create Room
```http
POST /api/v1/rooms
Content-Type: application/json

{
  "name": "Agent Conversation",
  "settings": {
    "max_participants": 2,
    "voice": {
      "codec": "opus",
      "bitrate": 64000
    }
  }
}
```

**Response (201 Created)**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Agent Conversation",
  "status": "created",
  "settings": {
    "max_participants": 2,
    "voice": {
      "codec": "opus",
      "bitrate": 64000
    }
  },
  "created_at": "2026-02-10T17:00:00Z",
  "updated_at": "2026-02-10T17:00:00Z"
}
```

#### Get Room
```http
GET /api/v1/rooms/:roomId
```

**Response (200 OK)**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Agent Conversation",
  "status": "active",
  "participants_count": 2,
  "settings": {},
  "created_at": "2026-02-10T17:00:00Z",
  "updated_at": "2026-02-10T17:05:00Z"
}
```

#### List Rooms
```http
GET /api/v1/rooms?status=active&limit=10
```

**Response (200 OK)**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Agent Conversation",
      "status": "active",
      "participants_count": 2,
      "created_at": "2026-02-10T17:00:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

#### Update Room
```http
PATCH /api/v1/rooms/:roomId
Content-Type: application/json

{
  "name": "Updated Room Name",
  "settings": {
    "recording": {
      "enabled": true
    }
  }
}
```

#### Delete Room
```http
DELETE /api/v1/rooms/:roomId
```

**Response (204 No Content)**

---

### Participants

#### Join Room
```http
POST /api/v1/rooms/:roomId/participants
Content-Type: application/json

{
  "agent_id": "agent-alpha-001",
  "metadata": {
    "display_name": "Agent Alpha",
    "capabilities": ["opus", "dtmf"]
  }
}
```

**Response (201 Created)**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "agent_id": "agent-alpha-001",
  "status": "connecting",
  "metadata": {
    "display_name": "Agent Alpha",
    "capabilities": ["opus", "dtmf"]
  },
  "joined_at": "2026-02-10T17:00:00Z"
}
```

#### List Participants
```http
GET /api/v1/rooms/:roomId/participants
```

**Response (200 OK)**
```json
{
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "agent_id": "agent-alpha-001",
      "status": "connected",
      "display_name": "Agent Alpha",
      "joined_at": "2026-02-10T17:00:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "agent_id": "agent-beta-001",
      "status": "connected",
      "display_name": "Agent Beta",
      "joined_at": "2026-02-10T17:01:00Z"
    }
  ]
}
```

#### Leave Room
```http
DELETE /api/v1/rooms/:roomId/participants/:participantId
```

**Response (204 No Content)**

---

### Sessions

#### Get Session
```http
GET /api/v1/sessions/:sessionId
```

**Response (200 OK)**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "participant_id": "660e8400-e29b-41d4-a716-446655440001",
  "start_time": "2026-02-10T17:00:00Z",
  "end_time": "2026-02-10T17:30:00Z",
  "duration": 1800,
  "status": "completed",
  "stats": {
    "voice_packets_sent": 45000,
    "voice_packets_received": 44500,
    "bytes_sent": 36000000,
    "bytes_received": 35600000,
    "packet_loss_percent": 0.3,
    "avg_latency_ms": 42
  }
}
```

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('wss://api.voice-service.example.com/ws');

// Authentication (optional token)
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
});
```

### Client → Server Events

#### Join Room
```javascript
{
  "type": "room:join",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "agentId": "agent-alpha-001",
  "metadata": {
    "display_name": "Agent Alpha"
  }
}
```

#### Leave Room
```javascript
{
  "type": "room:leave",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "participantId": "660e8400-e29b-41d4-a716-446655440001"
}
```

#### WebRTC Offer
```javascript
{
  "type": "webrtc:offer",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "participantId": "660e8400-e29b-41d4-a716-446655440001",
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- 123456789 0 IN IP4 0.0.0.0\r\n..."
  }
}
```

#### WebRTC Answer
```javascript
{
  "type": "webrtc:answer",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "participantId": "660e8400-e29b-41d4-a716-446655440002",
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- 987654321 0 IN IP4 0.0.0.0\r\n..."
  }
}
```

#### ICE Candidate
```javascript
{
  "type": "webrtc:ice-candidate",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "participantId": "660e8400-e29b-41d4-a716-446655440001",
  "candidate": {
    "candidate": "candidate:1 1 udp 2113937151 192.168.1.100 54321 typ host",
    "sdpMid": "audio",
    "sdpMLineIndex": 0
  }
}
```

#### Mute/Unmute
```javascript
{
  "type": "room:mute",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "participantId": "660e8400-e29b-41d4-a716-446655440001",
  "muted": true
}
```

---

### Server → Client Events

#### Room Joined (Confirmation)
```javascript
{
  "type": "room:joined",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "participantId": "660e8400-e29b-41d4-a716-446655440001",
  "status": "connecting"
}
```

#### Participant Joined
```javascript
{
  "type": "room:participant-joined",
  "participant": {
    "id": "660e8400-e29b-41d4-a716-446655440002",
    "agentId": "agent-beta-001",
    "display_name": "Agent Beta",
    "status": "connecting"
  }
}
```

#### Participant Left
```javascript
{
  "type": "room:participant-left",
  "participantId": "660e8400-e29b-41d4-a716-446655440002",
  "reason": "user_left"
}
```

#### WebRTC Offer (Received from peer)
```javascript
{
  "type": "webrtc:offer",
  "fromParticipantId": "660e8400-e29b-41d4-a716-446655440002",
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- 987654321 0 IN IP4 0.0.0.0\r\n..."
  }
}
```

#### WebRTC Answer (Received from peer)
```javascript
{
  "type": "webrtc:answer",
  "fromParticipantId": "660e8400-e29b-41d4-a716-446655440002",
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- 123456789 0 IN IP4 0.0.0.0\r\n..."
  }
}
```

#### ICE Candidate (Received from peer)
```javascript
{
  "type": "webrtc:ice-candidate",
  "fromParticipantId": "660e8400-e29b-41d4-a716-446655440002",
  "candidate": {
    "candidate": "candidate:1 1 udp 2113937151 192.168.1.100 54321 typ host",
    "sdpMid": "audio",
    "sdpMLineIndex": 0
  }
}
```

#### Voice Stream Started
```javascript
{
  "type": "voice:stream-started",
  "participantId": "660e8400-e29b-41d4-a716-446655440002"
}
```

#### Voice Stream Stopped
```javascript
{
  "type": "voice:stream-stopped",
  "participantId": "660e8400-e29b-41d4-a716-446655440002"
}
```

#### Room Error
```javascript
{
  "type": "room:error",
  "code": "ROOM_FULL",
  "message": "Room has reached maximum participants"
}
```

#### Room Closed
```javascript
{
  "type": "room:closed",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "all_participants_left"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `ROOM_NOT_FOUND` | Room does not exist |
| `ROOM_FULL` | Room has reached max participants |
| `ALREADY_JOINED` | Already in the room |
| `NOT_IN_ROOM` | Not currently in the room |
| `INVALID_TOKEN` | Authentication failed |
| `WEBCRTC_ERROR` | WebRTC negotiation failed |
| `CONNECTION_TIMEOUT` | Connection timed out |

---

## Connection States

```javascript
// Client-side connection states
const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed'
};

// Room states
const ROOM_STATES = {
  CREATED: 'created',
  WAITING: 'waiting',
  ACTIVE: 'active',
  CLOSED: 'closed'
};

// Participant states
const PARTICIPANT_STATES = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  LEFT: 'left'
};
```
