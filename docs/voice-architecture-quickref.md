# Voice Architecture - Quick Reference

## Deliverables Summary

### ✅ Completed Documents

1. **`voice-architecture-design.md`** - Complete architecture document (31KB)

---

## Architecture Overview

### Room Structure
```
CREATED → WAITING → ACTIVE → CLOSED
```
- Room = virtual container for agent communication
- UUID identified
- Supports 2+ participants

### Voice Flow
```
Agent A ──► Signaling Server ◄── Agent B
             │                    │
             │◄── WebRTC Offer ───┤
             │── WebRTC Answer ──►│
             │◄── ICE Candidates ─┤
             └── ICE Candidates ─►│
                    │
                    ▼ (P2P Audio via WebRTC)
```

### API Endpoints

#### REST
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/rooms` | Create room |
| GET | `/api/v1/rooms/:id` | Get room details |
| POST | `/api/v1/rooms/:id/participants` | Join room |
| GET | `/api/v1/rooms/:id/participants` | List participants |

#### WebSocket Events
| Direction | Events |
|-----------|--------|
| Client→Server | `room:join`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate` |
| Server→Client | `room:joined`, `webrtc:offer`, `voice:stream-started` |

### Database Schema

```sql
rooms (id UUID PK, name, status, settings JSONB)
    │
    ├── 1:N
    │
    ▼
participants (id UUID PK, room_id FK, agent_id, status)
    │
    ├── 1:N
    │
    ▼
sessions (id UUID PK, room_id FK, participant_id FK, start_time, end_time, stats JSONB)
```

### Frontend Stack
- **React + TypeScript + Vite**
- **WebRTC** for P2P audio
- **Zustand** for state management
- **WebSocket** for signaling

### Key Components
```
<App />
└── <VoiceRoomProvider />
    └── <Layout />
        ├── <RoomList />
        └── <RoomView />
            ├── <ParticipantList />
            └── <AudioControls />
```

### Recommended Flow
1. Agent A creates room via REST
2. Both agents connect via WebSocket
3. Agents join room via WebSocket events
4. WebRTC signaling (offer/answer/ICE)
5. Direct P2P audio stream established
6. Clean disconnect when done

---

## Quick Start for Implementation

### Backend (Node.js/Go/Rust)
1. Set up WebSocket server
2. Implement REST API handlers
3. Connect to PostgreSQL
4. Integrate TURN server (Coturn recommended)
5. Add authentication middleware

### Frontend (React)
1. Initialize Vite + React + TypeScript
2. Implement WebSocket connection
3. Build WebRTC peer connection logic
4. Create UI components
5. Test with local signaling server

### Infrastructure
- PostgreSQL database
- Redis (optional, for pub/sub scaling)
- TURN server (Coturn)
- STUN server (public or self-hosted)
- Load balancer (Nginx/Traefik)

---

**Full documentation**: `voice-architecture-design.md`
