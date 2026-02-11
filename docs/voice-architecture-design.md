# Voice Streaming Architecture Design

## Executive Summary

This document outlines the architecture for real-time voice streaming between AI agents. The system enables two agents to connect, exchange voice data bidirectionally, and manage their communication sessions.

---

## 1. Room Structure

### 1.1 Concept
A **Room** is a virtual container that holds a communication session between agents. Rooms are identified by unique UUIDs and can accommodate 2 or more participants.

### 1.2 Room States

```
┌─────────────────────────────────────────────────────────────┐
│                        ROOM STATES                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ CREATED │───▶│ WAITING │───▶│ ACTIVE  │───▶│ CLOSED  │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       │              │              │              │         │
│       ▼              ▼              ▼              ▼         │
│   Room exists   Waiting for      Active        Cleanup &     │
│   no participants 2nd agent    voice exchange  archival     │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Room Lifecycle

| State | Description | Transitions To |
|-------|-------------|-----------------|
| CREATED | Room initialized, no agents | WAITING (1st agent joins) |
| WAITING | Waiting for minimum participants | ACTIVE (2+ agents) or CLOSED |
| ACTIVE | Voice streaming in progress | CLOSED (all leave or timeout) |
| CLOSED | Ended, pending cleanup | - |

### 1.4 Agent Connection Flow

```
Agent A                    Signaling Server                 Agent B
   │                            │                             │
   ├─ Create Room ─────────────▶│                             │
   │◀─ Room ID + Config ────────┤                             │
   │                            │                             │
   ├─ Join Room ───────────────▶│                             │
   │◀─ Participant ID ──────────┤                             │
   │                            │                             │
   │                            │◀─ Join Request ─────────────┤
   │◀─ Peer Available ──────────┤                             │
   │                            │                             │
   ├─ WebRTC Offer ────────────▶│──────── WebRTC Offer ──────▶│
   │                            │                             │
   │◀─ WebRTC Answer ───────────│───── WebRTC Answer ────────│
   │                            │                             │
   ├─ ICE Candidates ─────────▶│────── ICE Candidates ──────▶│
   │◀─ ICE Candidates ──────────│◀───── ICE Candidates ──────┤
   │                            │                             │
   ├─ P2P Voice Stream ───────▶│───── P2P Voice Stream ─────▶│
   │◀─ P2P Voice Stream ────────│◀──── P2P Voice Stream ──────┤
```

---

## 2. Voice Flow Architecture

### 2.1 Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          VOICE DATA FLOW                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐     ┌─────────────────┐     ┌─────────────────────┐   │
│  │  Agent A    │     │  Signaling Svr  │     │      Agent B         │   │
│  │  (Client)   │     │  (WebSocket)    │     │      (Client)        │   │
│  └──────┬──────┘     └────────┬────────┘     └──────────┬──────────┘   │
│         │                     │                         │               │
│         │  1. Join Request    │                         │               │
│         ├────────────────────▶│                         │               │
│         │                     │  2. Forward Join Req   │               │
│         │◀────────────────────┼─────────────────────────┤               │
│         │                     │                         │               │
│         │  3. WebRTC Offer    │                         │               │
│         ├────────────────────▶│──────── WebRTC Offer ──▶│               │
│         │                     │                         │               │
│         │  4. WebRTC Answer   │                         │               │
│         │◀────────────────────│◀────── WebRTC Answer ───┤               │
│         │                     │                         │               │
│         │  5. ICE Candidates  │                         │               │
│         ├────────────────────▶│──────── ICE Cand ──────▶│               │
│         │                     │                         │               │
│         │  6. ICE Candidates  │                         │               │
│         │◀────────────────────│◀────── ICE Cand ────────┤               │
│         │                     │                         │               │
│         │◀──────────────────────────────────────────────┤               │
│         │    7. Direct P2P Audio Stream (WebRTC)       │               │
│         ├──────────────────────────────────────────────▶│               │
│         │                     │                         │               │
│         └─────────────────────┴─────────────────────────┘               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Audio Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      AUDIO PROCESSING PIPELINE                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │
│  │   Input     │   │  Encoding   │   │  Network    │   │   Output    │  │
│  │  Device     │──▶│  (Opus/PCM) │──▶│  Transport  │──▶│   Device    │  │
│  │  (Mic)      │   │  (50ms)     │   │  (SRTP)     │   │  (Speaker) │  │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘  │
│       │                 │                  │                 │          │
│       ▼                 ▼                  ▼                 ▼          │
│  ┌─────────┐      ┌───────────┐     ┌────────────┐    ┌────────────┐   │
│  │ Sample  │      │ Compress  │     │ Encrypt &  │    │ Decrypt &  │   │
│  │ Rate:   │      │ 16kbps-   │     │  Packetize │    │  Depacket- │   │
│  │ 16/48kHz│      │  64kbps   │     │  (RTP)     │    │  ize (RTP) │   │
│  └─────────┘      └───────────┘     └────────────┘    └────────────┘   │
│                                                                          │
│  Codec: Opus (preferred) or G.711 fallback                              │
│  Bitrate: Adaptive based on network conditions                           │
│  Latency: Target < 100ms round-trip                                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 WebRTC Connection Types

| Type | Description | Use Case |
|------|-------------|----------|
| P2P | Direct connection between agents | Standard, low latency |
| TURN Relay | Relay through TURN server | NAT traversal, firewall |
| SFU | Selective Forwarding Unit | Multi-party (3+) |

For 2-agent scenario: **P2P preferred, TURN fallback**

---

## 3. API Endpoints Design

### 3.1 REST API Endpoints

#### Room Management

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/v1/rooms` | Create new room | `{name, maxParticipants}` | Room object |
| GET | `/api/v1/rooms/:id` | Get room details | - | Room object |
| GET | `/api/v1/rooms` | List all rooms | - | Room[] |
| DELETE | `/api/v1/rooms/:id` | Close/delete room | - | 204 No Content |
| PATCH | `/api/v1/rooms/:id` | Update room settings | `{name, settings}` | Room object |

#### Participant Management

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/v1/rooms/:id/participants` | Join room | `{agentId, metadata}` | Participant object |
| GET | `/api/v1/rooms/:id/participants` | List participants | - | Participant[] |
| DELETE | `/api/v1/rooms/:id/participants/:participantId` | Leave room | - | 204 No Content |

#### Session Management

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/sessions/:id` | Get session details | - | Session object |
| GET | `/api/v1/sessions` | List sessions | `?roomId=&status=` | Session[] |
| POST | `/api/v1/sessions/:id/end` | End session | `{reason}` | Session object |

### 3.2 WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `{roomId, agentId, metadata}` | Join a voice room |
| `room:leave` | `{roomId, participantId}` | Leave current room |
| `room:ready` | `{roomId}` | Ready to receive WebRTC offer |
| `webrtc:offer` | `{roomId, offer, participantId}` | WebRTC SDP offer |
| `webrtc:answer` | `{roomId, answer, participantId}` | WebRTC SDP answer |
| `webrtc:ice-candidate` | `{roomId, candidate, participantId}` | ICE candidate |
| `voice:start` | `{roomId}` | Start sending voice |
| `voice:stop` | `{roomId}` | Stop sending voice |
| `room:mute` | `{roomId, participantId, muted}` | Mute/unmute audio |
| `room:settings` | `{roomId, settings}` | Update room settings |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room:created` | `{roomId, ...}` | Room successfully created |
| `room:joined` | `{roomId, participantId, ...}` | Successfully joined room |
| `room:participant-joined` | `{participant}` | New participant joined |
| `room:participant-left` | `{participantId, reason}` | Participant left room |
| `room:ready` | `{roomId, participants[]}` | Room ready for voice |
| `webrtc:offer` | `{offer, fromParticipantId}` | Received WebRTC offer |
| `webrtc:answer` | `{answer, fromParticipantId}` | Received WebRTC answer |
| `webrtc:ice-candidate` | `{candidate, fromParticipantId}` | Received ICE candidate |
| `voice:stream-started` | `{participantId}` | Remote voice stream started |
| `voice:stream-stopped` | `{participantId}` | Remote voice stream stopped |
| `room:error` | `{code, message}` | Error occurred |
| `room:closed` | `{roomId, reason}` | Room was closed |

### 3.3 WebSocket Connection Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     WEBSOCKET CONNECTION FLOW                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Client                              Server                              │
│    │                                    │                                │
│    │───────── WebSocket Connect ───────▶│                                │
│    │◀──────── Connection ACK ───────────│                                │
│    │                                    │                                │
│    │─────────── auth (optional) ───────▶│                                │
│    │◀────────── auth response ──────────┤                                │
│    │                                    │                                │
│    │────── room:join {roomId, ...} ────▶│                                │
│    │◀───── room:joined {roomId, ...} ───│                                │
│    │                                    │                                │
│    │◀── room:participant-joined {peer} ─│  ← Peer joins notification     │
│    │                                    │                                │
│    │────── webrtc:offer {offer} ───────▶│──── webrtc:offer ────────▶     │
│    │                                    │                                │
│    │◀────── webrtc:answer {answer} ─────│◀── webrtc:answer ────────      │
│    │                                    │                                │
│    │───── webrtc:ice-candidate ───────▶│── webrtc:ice-candidate ──▶     │
│    │                                    │                                │
│    │◀── voice:stream-started {peer} ────│                                │
│    │                                    │                                │
│    │       [P2P Audio Established]      │                                │
│    │                                    │                                │
│    │─────── room:leave {roomId} ───────▶│                                │
│    │◀───── room:participant-left ───────│                                │
│    │                                    │                                │
│    └─────────── Disconnect ─────────────┘                                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### 4.1 Core Entities

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐                                                     │
│  │     rooms       │                                                     │
│  ├─────────────────┤                                                     │
│  │ id: UUID (PK)   │                                                     │
│  │ name: VARCHAR   │                                                     │
│  │ status: ENUM    │                                                     │
│  │ settings: JSONB │                                                     │
│  │ created_at      │                                                     │
│  │ updated_at      │                                                     │
│  └────────┬────────┘                                                     │
│           │                                                              │
│           │ 1:N                                                          │
│           ▼                                                              │
│  ┌─────────────────────┐      ┌─────────────────┐                        │
│  │    participants     │      │    sessions     │                        │
│  ├─────────────────────┤      ├─────────────────┤                        │
│  │ id: UUID (PK)       │      │ id: UUID (PK)   │                        │
│  │ room_id: UUID (FK)  │      │ room_id: UUID   │                        │
│  │ agent_id: UUID      │      │ participant_id  │                        │
│  │ status: ENUM        │      │ (FK)            │                        │
│  │ joined_at           │      │ start_time      │                        │
│  │ left_at             │      │ end_time        │                        │
│  │ metadata: JSONB     │      │ duration        │                        │
│  └─────────────────────┘      │ status: ENUM    │                        │
│                                │ stats: JSONB    │                        │
│                                └─────────────────┘                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Table Definitions

#### rooms

```sql
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'waiting', 'active', 'closed')),
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT rooms_status_idx ON rooms(status),
    CONSTRAINT rooms_created_idx ON rooms(created_at DESC)
);
```

#### participants

```sql
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'connecting'
        CHECK (status IN ('connecting', 'connected', 'disconnected', 'left')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT participants_room_idx ON participants(room_id),
    CONSTRAINT participants_agent_idx ON participants(agent_id),
    CONSTRAINT participants_status_idx ON participants(status)
);
```

#### sessions

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    participant_id UUID NOT NULL REFERENCES participants(id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'failed', 'timeout')),
    stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT sessions_room_idx ON sessions(room_id),
    CONSTRAINT sessions_participant_idx ON sessions(participant_id),
    CONSTRAINT sessions_status_idx ON sessions(status)
);
```

### 4.3 Entity Relationships

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      ENTITY RELATIONSHIPS                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│     ┌──────────┐                                                       │
│     │  rooms   │◀────────────────────────────────────────┐               │
│     └────┬─────┘                                          │               │
│          │ 1:N                                            │               │
│          ▼                                                │               │
│     ┌──────────────┐                                      │               │
│     │ participants │──────────┐                           │               │
│     └──────┬───────┘          │ N:1                       │               │
│            │                   ▼                           │               │
│            │           ┌──────────────┐                    │               │
│            │           │   sessions    │                    │               │
│            │           └──────────────┘                    │               │
│            │                   │                           │               │
│            │                   │ N:1                       │               │
│            ▼                   ▼                           │               │
│     ┌──────────────┐     ┌──────────────┐                  │               │
│     │   agents     │     │ice_candidates│◀──────────────────┘               │
│     │  (external)  │     │   (optional) │                                   │
│     └──────────────┘     └──────────────┘                                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Frontend Architecture

### 5.1 Technology Stack

| Layer | Technology |
|-------|------------|
| UI Framework | React + TypeScript |
| Build Tool | Vite |
| State Management | Zustand / Redux Toolkit |
| Real-time Comms | WebSocket API + RTCPeerConnection |
| Audio Processing | Web Audio API |
| Routing | React Router |

### 5.2 Component Hierarchy

```
<App />
└── <VoiceRoomProvider />
    └── <Layout />
        ├── <Header />
        ├── <RoomList /> (if no active room)
        └── <RoomView /> (when in room)
            ├── <ConnectionPanel />
            │   ├── <ParticipantList />
            │   │   └── <ParticipantCard />
            │   │       ├── <Avatar />
            │   │       ├── <Name />
            │   │       └── <StatusIndicator />
            │   └── <AudioControls />
            │       ├── <MuteButton />
            │       ├── <DeafenButton />
            │       └── <EndCallButton />
```

### 5.3 Custom Hooks

```typescript
// useVoiceRoom - Main hook for voice room functionality
const {
  room,
  participants,
  localStream,
  remoteStreams,
  isConnected,
  joinRoom,
  leaveRoom,
  muteLocal,
  unmuteLocal
} = useVoiceRoom(roomId);

// useWebRTC - Low-level WebRTC management
const {
  peerConnection,
  localStream,
  remoteStream,
  createOffer,
  createAnswer,
  addIceCandidate
} = useWebRTC(signalingServer, roomId);

// useAudioContext - Audio processing
const {
  context,
  analyser,
  gainNode,
  mute,
  unmute,
  setVolume
} = useAudioContext(localStream);
```

---

## 6. Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         VOICE STREAMING SYSTEM ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         EXTERNAL SERVICES                                │   │
│  │                                                                           │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │   │
│  │  │   Agent A   │   │   Agent B   │   │  TURN Server │   │  STUN Server│  │   │
│  │  │  (Client)   │   │  (Client)   │   │   (Relay)    │   │  (NAT Fix)  │  │   │
│  │  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘  │   │
│  └─────────┼─────────────────┼─────────────────┼─────────────────┼────────┘   │
│            │                 │                 │                 │            │
│            │  HTTPS/WSS      │                 │                 │            │
│            │  REST           │                 │                 │            │
│            └─────────────────┴─────────────────┴─────────────────┘            │
│                                      │                                          │
│                                      ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         API GATEWAY / LOAD BALANCER                       │   │
│  │                    (Nginx / Traefik / Cloud Load Balancer)               │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│  ┌──────────────────────────────────┼────────────────────────────────────────┐  │
│  │                                  ▼                                         │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                     VOICE SERVER (Node.js / Go / Rust)               │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐  │ │  │
│  │  │  │                   REST API HANDLERS                             │  │ │  │
│  │  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │  │ │  │
│  │  │  │  │   Rooms    │ │Participants│ │  Sessions  │ │   Admin    │  │  │ │  │
│  │  │  │  │  /api/v1/  │ │  /api/v1/   │ │  /api/v1/  │ │  /api/v1/  │  │  │ │  │
│  │  │  │  │   rooms    │ │ participants│ │  sessions  │ │   admin    │  │  │ │  │
│  │  │  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │  │ │  │
│  │  │  └─────────────────────────────────────────────────────────────────┘  │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐  │ │  │
│  │  │  │                 WEBSOCKET SIGNALING SERVER                       │  │ │  │
│  │  │  │                                                               │  │ │  │
│  │  │  │  ┌─────────────────────────────────────────────────────────┐  │  │ │  │
│  │  │  │  │  Connection Manager                                      │  │  │ │  │
│  │  │  │  │  - WebSocket connections                                 │  │  │ │  │
│  │  │  │  │  - Heartbeat/keepalive                                   │  │  │ │  │
│  │  │  │  └─────────────────────────────────────────────────────────┘  │  │ │  │
│  │  │  │                                                               │  │ │  │
│  │  │  │  ┌─────────────────────────────────────────────────────────┐  │  │ │  │
│  │  │  │  │  Room Manager                                           │  │  │ │  │
│  │  │  │  │  - Create/join/leave rooms                             │  │  │ │  │
│  │  │  │  │  - Participant tracking                                 │  │  │ │  │
│  │  │  │  └─────────────────────────────────────────────────────────┘  │  │ │  │
│  │  │  │                                                               │  │ │  │
│  │  │  │  ┌─────────────────────────────────────────────────────────┐  │  │ │  │
│  │  │  │  │  Signaling Handler                                      │  │  │ │  │
│  │  │  │  │  - WebRTC offer/answer forwarding                      │  │  │ │  │
│  │  │  │  │  - ICE candidate exchange                              │  │  │ │  │
│  │  │  │  │  - Connection state notifications                      │  │  │ │  │
│  │  │  │  └─────────────────────────────────────────────────────────┘  │  │ │  │
│  │  │  └─────────────────────────────────────────────────────────────────┘  │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐  │ │  │
│  │  │  │                   AUTHENTICATION LAYER                         │  │ │  │
│  │  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │  │ │  │
│  │  │  │  │ JWT Token    │ │ API Key       │ │ OAuth 2.0    │          │  │ │  │
│  │  │  │  │ Validation  │ │ Validation    │ │ Integration  │          │  │ │  │
│  │  │  │  └──────────────┘ └──────────────┘ └──────────────┘          │  │ │  │
│  │  │  └─────────────────────────────────────────────────────────────────┘  │ │  │
│  │  └──────────────────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                          │
│                                      │                                          │
│  ┌──────────────────────────────────┼────────────────────────────────────────┐  │
│  │                                  ▼                                         │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                     DATA LAYER (PostgreSQL)                          │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐  │ │  │
│  │  │  │                    TABLES                                        │  │ │  │
│  │  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │  │ │  │
│  │  │  │  │    rooms     │ │  participants │ │   sessions   │          │  │ │  │
│  │  │  │  │   (UUID PK)  │ │   (UUID PK)   │ │   (UUID PK)   │          │  │ │  │
│  │  │  │  └──────────────┘ └──────────────┘ └──────────────┘          │  │ │  │
│  │  │  │  ┌──────────────┐ ┌──────────────┐                           │  │ │  │
│  │  │  │  │ice_candidates│ │   analytics   │                           │  │ │  │
│  │  │  │  │  (optional)  │ │   (optional)  │                           │  │ │  │
│  │  │  │  └──────────────┘ └──────────────┘                           │  │ │  │
│  │  │  └─────────────────────────────────────────────────────────────────┘  │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐  │ │  │
│  │  │  │                   INDEXES                                         │  │ │  │
│  │  │  │  - rooms(status), rooms(created_at)                            │  │ │  │
│  │  │  │  - participants(room_id), participants(agent_id)               │  │ │  │
│  │  │  │  - sessions(room_id), sessions(participant_id)                 │  │ │  │
│  │  │  └─────────────────────────────────────────────────────────────────┘  │ │  │
│  │  └──────────────────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Priority

### Phase 1 (MVP)
- [x] Room creation and joining
- [x] Basic WebRTC signaling
- [x] P2P audio streaming (Opus codec)
- [x] Participant state management
- [x] Room lifecycle (create → join → leave → close)

### Phase 2 (Enhancements)
- [ ] TURN server integration for NAT traversal
- [ ] Audio quality monitoring (packet loss, jitter)
- [ ] Recording capability
- [ ] Mute/deafen controls
- [ ] Connection quality indicators

### Phase 3 (Advanced)
- [ ] Multi-party rooms (3+ agents)
- [ ] SFU architecture for scaling
- [ ] Transcription integration
- [ ] AI voice activity detection
- [ ] Dynamic bitrate adaptation

---

## 8. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Authentication | JWT tokens / API keys for all endpoints |
| Authorization | Room-level permissions, participant validation |
| TLS | All connections (WSS, HTTPS) encrypted |
| Rate Limiting | Prevent DoS attacks on signaling server |
| ICE Binding | Validate ICE candidates to prevent injection |
| Audio Injection | Authenticate WebRTC signaling messages |

---

## 9. Scalability Considerations

- **Horizontal Scaling**: Voice servers can be stateless for signaling, scale with load balancer
- **TURN Servers**: Scale independently, use anycast for geo-distribution
- **Database**: Use connection pooling, read replicas for queries
- **WebSocket Connections**: Consider Redis Pub/Sub for multi-instance signaling

---

## Document Info

- **Version**: 1.0
- **Last Updated**: 2026-02-10
- **Author**: Max (Build Specialist)
