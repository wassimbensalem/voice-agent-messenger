# WebRTC Signaling Server Architecture Research

**Date:** 2026-02-11  
**Researcher:** Scout (Research Subagent)  
**Goal:** Research WebRTC signaling server requirements and architecture for agent-link integration

---

## Executive Summary

This document outlines the architecture and requirements for a WebRTC signaling server designed to support multi-participant voice/video rooms, with specific integration requirements for the agent-link system.

**Key Findings:**
- WebRTC requires a separate signaling server to coordinate peer connections
- The signaling protocol handles SDP (offer/answer) and ICE candidate exchange
- Room-based architecture is essential for multi-participant support
- Integration with agent-link requires careful API design and authentication

---

## 1. WebRTC Signaling Fundamentals

### 1.1 What is Signaling?

Signaling is the process of coordinating communication between peers before and during a WebRTC connection. **It is not part of the WebRTC specification**, meaning developers can choose their own signaling protocol.

**Core Signaling Responsibilities:**
1. **Session Initiation** - Discover users and invite them to sessions
2. **Session Negotiation** - Exchange SDP (Session Description Protocol) messages
3. **ICE Candidate Exchange** - Share network path information
4. **Session Management** - Handle joins, leaves, and connection state

### 1.2 Key Signaling Messages

#### SDP Messages (Session Description Protocol)

| Message Type | Description | Direction |
|-------------|-------------|-----------|
| **Offer** | Initiator's session description (capabilities, codecs, IP addresses) | Client → Server → Peers |
| **Answer** | Responder's session description (accepting/rejecting capabilities) | Client → Server → Peers |

#### ICE Candidates (Interactive Connectivity Establishment)

| Type | Description |
|------|-------------|
| **host** | Local IP address and port |
| **srflx** | Server-reflexive address (NAT mapped) |
| **relay** | TURN server relayed address |

### 1.3 The Signaling Flow

```
Peer A                          Signaling Server                         Peer B
  |                                    |                                    |
  |----------- join(room) ------------>|                                    |
  |                                    |----------- user_joined ------------>|
  |<---------- room_users -------------|                                    |
  |                                    |<---------- join(room) -------------|
  |                                    |----------- user_joined ------------>|
  |                                    |                                    |
  |<========== create offer ==========>|                                    |
  |----------- offer(sdp) ------------>|----------- offer(sdp) ------------>|
  |                                    |<---------- answer(sdp) ------------|
  |<---------- answer(sdp) ------------|                                    |
  |                                    |                                    |
  |<========== ICE candidates ========|                                    |
  |----------- candidate ------------>|----------- candidate ------------>|
  |                                    |<---------- candidate -------------|
  |<---------- candidate -------------|                                    |
  |                                    |                                    |
  |<========== P2P Connection Established ============>|
  |                                    |                                    |
```

---

## 2. Room-Based Signaling Architecture

### 2.1 Room Management

The signaling server must manage rooms as isolated communication spaces:

```javascript
// Room Data Structure
{
  roomId: "voice-room-123",
  participants: [
    {
      id: "socket-abc123",
      agentId: "agent-fawzi",
      joinedAt: "2026-02-11T10:00:00Z",
      role: "owner" // or "participant"
    }
  ],
  createdAt: "2026-02-11T09:00:00Z",
  maxParticipants: 10,
  type: "voice" // or "video"
}
```

### 2.2 Socket-to-Room Mapping

```javascript
// Mapping for efficient room lookups
{
  "socket-abc123": {
    roomId: "voice-room-123",
    agentId: "agent-fawzi"
  }
}
```

### 2.3 Event Types

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join` | Client → Server | Request to join a room |
| `joined` | Server → Room | Notification that user joined |
| `leave` | Client → Server | Request to leave room |
| `user_exit` | Server → Room | Notification of user departure |
| `offer` | Client → Server | SDP offer message |
| `answer` | Client → Server | SDP answer message |
| `candidate` | Client → Server | ICE candidate message |
| `getOffer` | Server → Client | Forwarded offer |
| `getAnswer` | Server → Client | Forwarded answer |
| `getCandidate` | Server → Client | Forwarded ICE candidate |
| `room_users` | Server → Client | List of current participants |

---

## 3. Multi-Participant Considerations

### 3.1 Mesh Topology (P2P)

For small groups (2-4 participants), each peer connects directly to every other peer:

```
    Peer A
      / \
     /   \
    /     \
 Peer B - Peer C
```

**Pros:** Low latency, no server media processing  
**Cons:** Bandwidth grows O(n²), limited scalability

### 3.2 Selective Forwarding Unit (SFU)

For larger groups, an SFU receives media from all participants and selectively forwards it:

```
          SFU Server
         / | \    \
        /  |  \    \
   PeerA PeerB PeerC PeerD
```

**Pros:** Scales to hundreds of participants  
**Cons:** Higher server costs, more complex implementation

### 3.3 Recommendation for Agent-Link

**Recommended: Hybrid Approach**
- **Small rooms (2-5):** Mesh topology via signaling server
- **Large rooms (5+):** Consider SFU integration (future)

---

## 4. Integration with Agent-Link System

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent-Link System                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ WebRTC      │  │ Agent-Link      │  │ Voice Room     │  │
│  │ Signaling   │◄─┤ Authentication  │  │ Management     │  │
│  │ Server      │  │ Service         │  │                │  │
│  └──────┬──────┘  └─────────────────┘  └───────┬────────┘  │
│         │                                        │          │
│         ▼                                        ▼          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Shared Redis/PostgreSQL State           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Required API Endpoints

#### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/rooms` | Create a new voice room |
| `GET` | `/api/rooms/:id` | Get room details |
| `DELETE` | `/api/rooms/:id` | Delete a room |
| `GET` | `/api/rooms/:id/participants` | List participants |
| `POST` | `/api/rooms/:id/join` | Generate join token |

#### WebSocket Events

| Direction | Event | Description |
|-----------|-------|-------------|
| C→S | `authenticate` | Initial connection with agent-link token |
| S→C | `auth_ok` / `auth_error` | Authentication result |
| C→S | `join_room` | Join a specific room |
| C→S | `leave_room` | Leave current room |
| C→S | `offer` | Send SDP offer |
| C→S | `answer` | Send SDP answer |
| C→S | `candidate` | Send ICE candidate |
| S→C | `offer` | Forwarded SDP offer |
| S→C | `answer` | Forwarded SDP answer |
| S→C | `candidate` | Forwarded ICE candidate |
| S→C | `user_joined` | Notification of new participant |
| S→C | `user_left` | Notification of participant leaving |

### 4.3 Authentication Flow

1. Agent connects to WebSocket with agent-link JWT token
2. Signaling server validates token with agent-link service
3. On success, agent receives `auth_ok` and can join rooms
4. On failure, agent receives `auth_error` and connection closes

### 4.4 Voice Room Specifications (Max's Spec)

Based on requirements for Max's voice room implementation:

```
Room Properties:
- roomId: Unique identifier (UUID)
- name: Human-readable name
- type: "voice" | "video"
- maxParticipants: Number (default: 10)
- createdBy: Agent ID
- createdAt: Timestamp
- settings: {
    muteOnEntry: boolean,
    allowRecording: boolean,
    maxDuration: number (minutes)
  }
```

---

## 5. Implementation Recommendations

### 5.1 Technology Stack

| Component | Recommendation | Reason |
|-----------|---------------|--------|
| Runtime | Node.js | Excellent WebSocket support, async I/O |
| WebSocket Library | Socket.IO | Auto-reconnection, rooms, broadcast |
| Database | Redis | Fast state management, pub/sub |
| Authentication | Shared with agent-link | JWT validation |
| Deployment | Docker container | Isolated, reproducible |

### 5.2 Key Code Patterns

#### Join Room Handler
```javascript
socket.on("join_room", async (data) => {
  const { roomId, agentId, token } = data;
  
  // Validate agent-link token
  const isValid = await validateAgentToken(token, agentId);
  if (!isValid) {
    socket.emit("auth_error", { message: "Invalid token" });
    return;
  }
  
  // Join the socket room
  socket.join(roomId);
  socketToRoom[socket.id] = roomId;
  socketToAgent[socket.id] = agentId;
  
  // Track participant
  rooms[roomId] = rooms[roomId] || [];
  rooms[roomId].push({ socketId: socket.id, agentId });
  
  // Notify others
  socket.to(roomId).emit("user_joined", { agentId, socketId: socket.id });
  
  // Send current participants to new joiner
  socket.emit("room_users", rooms[roomId]);
});
```

#### Signaling Handler
```javascript
socket.on("offer", (sdp) => {
  const roomId = socketToRoom[socket.id];
  socket.to(roomId).emit("offer", {
    from: socketToAgent[socket.id],
    sdp: sdp
  });
});

socket.on("answer", (sdp) => {
  const roomId = socketToRoom[socket.id];
  socket.to(roomId).emit("answer", {
    from: socketToAgent[socket.id],
    sdp: sdp
  });
});

socket.on("candidate", (candidate) => {
  const roomId = socketToRoom[socket.id];
  socket.to(roomId).emit("candidate", {
    from: socketToAgent[socket.id],
    candidate: candidate
  });
});
```

#### Disconnect Handler
```javascript
socket.on("disconnect", () => {
  const roomId = socketToRoom[socket.id];
  const agentId = socketToAgent[socket.id];
  
  if (roomId && rooms[roomId]) {
    // Remove from room
    rooms[roomId] = rooms[roomId].filter(
      p => p.socketId !== socket.id
    );
    
    // Notify others
    socket.to(roomId).emit("user_left", { agentId });
  }
  
  // Cleanup mappings
  delete socketToRoom[socket.id];
  delete socketToAgent[socket.id];
});
```

### 5.3 Scalability Considerations

1. **Horizontal Scaling:** Use Redis pub/sub to synchronize state across multiple signaling server instances
2. **Connection Limits:** Implement per-agent and per-room connection limits
3. **Rate Limiting:** Prevent abuse with token bucket rate limiting
4. **Monitoring:** Track connection counts, message rates, and latency

---

## 6. Security Considerations

### 6.1 Authentication
- All connections must authenticate via agent-link JWT
- Tokens validated on connection and periodically renewed
- Room access controlled by agent-link permissions

### 6.2 Message Validation
- Validate SDP messages before forwarding
- Sanitize ICE candidate data
- Rate limit signaling messages

### 6.3 Privacy
- Only forward messages to intended recipients
- Don't log SDP/ICE data (contains network info)
- Implement room-specific access controls

---

## 7. Next Steps

1. **Prototype:** Build minimal signaling server with Socket.IO
2. **Integration:** Connect with agent-link authentication
3. **Testing:** Implement WebRTC connection tests
4. **Scaling:** Add Redis for multi-instance support
5. **Monitoring:** Add metrics and alerting

---

## 8. Sources

- [Stream WebRTC Signaling Server Guide](https://getstream.io/resources/projects/webrtc/basics/signaling-server/) - Retrieved 2026-02-11
- [WebRTC Video Conferencing Documentation](https://www.webrtc-experiment.com/docs/how-to-WebRTC-video-conferencing.html) - Retrieved 2026-02-11
- [Ant Media Server WebRTC Signaling](https://github.com/ant-media/Ant-Media-Server/wiki/WebRTC-Signalling-Server) - Retrieved 2026-02-11

---

*Research completed by Scout - 2026-02-11*
