# WebRTC Signaling Server

WebSocket-based signaling server for WebRTC voice/video rooms, integrated with the agent-link system.

## Features

- **WebSocket Signaling**: Real-time offer/answer/ICE candidate exchange
- **Room Management**: Create, join, and manage voice/video rooms
- **JWT Authentication**: Secure authentication via agent-link tokens
- **REST API**: Room management endpoints for external integration
- **Multi-Instance Support**: Redis integration for distributed deployment

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Redis (optional, for multi-instance support)

### Installation

```bash
# Clone the repository
cd signaling-server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Build TypeScript
npm run build

# Start the server
npm start
```

### Development

```bash
# Run with hot reload
npm run dev

# Run tests
npm test
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `JWT_SECRET` | JWT signing secret | (required) |
| `CORS_ORIGIN` | CORS allowed origin | `*` |
| `HEARTBEAT_INTERVAL` | WebSocket heartbeat interval (ms) | `30000` |
| `ROOM_TIMEOUT` | Empty room timeout (ms) | `300000` |
| `MAX_PARTICIPANTS` | Max participants per room | `10` |
| `REDIS_URL` | Redis connection URL | (optional) |
| `LOG_LEVEL` | Logging level | `info` |

## API Reference

### REST Endpoints

#### Create Room
```
POST /api/rooms
Authorization: Bearer <token>

Body:
{
  "name": "My Voice Room",
  "type": "voice", // or "video"
  "settings": {
    "muteOnEntry": false,
    "allowRecording": false,
    "maxDuration": 60
  }
}
```

#### List Rooms
```
GET /api/rooms
```

#### Get Room Details
```
GET /api/rooms/:roomId
```

#### Delete Room
```
DELETE /api/rooms/:roomId
Authorization: Bearer <token>
```

#### Generate Join Token
```
POST /api/rooms/:roomId/join
Authorization: Bearer <token>
```

#### Server Stats
```
GET /api/stats
```

### WebSocket Events

#### Client → Server

| Event | Description |
|-------|-------------|
| `join_room` | Join a room |
| `leave_room` | Leave current room |
| `offer` | Send SDP offer |
| `answer` | Send SDP answer |
| `candidate` | Send ICE candidate |
| `candidate-end` | End of ICE candidates |

#### Server → Client

| Event | Description |
|-------|-------------|
| `connected` | Connection established |
| `joined` | Successfully joined room |
| `user_joined` | Another user joined |
| `user_left` | Another user left |
| `offer` | Received SDP offer |
| `answer` | Received SDP answer |
| `candidate` | Received ICE candidate |
| `error` | Error occurred |

### WebSocket Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8080', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Connection established
socket.on('connected', (data) => {
  console.log('Connected with client ID:', data.clientId);
});

// Join a room
socket.emit('join_room', { roomId: 'room-123' });

// Handle offers
socket.on('offer', (data) => {
  console.log('Received offer from:', data.from);
  // Process offer and send answer
});

// Send answer
socket.on('answer', (data) => {
  console.log('Received answer from:', data.from);
});

// Handle ICE candidates
socket.on('candidate', (data) => {
  console.log('Received ICE candidate from:', data.from);
});

// Notify user joined
socket.on('user_joined', (data) => {
  console.log('User joined:', data.agentId);
});

// Notify user left
socket.on('user_left', (data) => {
  console.log('User left:', data.agentId);
});
```

## Authentication

### Generating Tokens (Server-side)

```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { agentId: 'agent-fawzi' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);
```

### Token Validation

The server validates JWT tokens on WebSocket connection. Include the token in the `auth` option when connecting:

```javascript
const socket = io('http://localhost:8080', {
  auth: {
    token: your_jwt_token
  }
});
```

## Docker Deployment

```bash
# Build the image
docker build -t webrtc-signaling-server .

# Run the container
docker run -p 8080:8080 \
  -e JWT_SECRET=your-secret \
  webrtc-signaling-server
```

### Docker Compose

```yaml
version: '3.8'

services:
  signaling:
    build: .
    ports:
      - "8080:8080"
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- signaling.test.ts
```

## Architecture

```
                    ┌─────────────────────┐
                    │   Signaling Server  │
                    │                     │
┌───────────┐       │  ┌───────────────┐  │
│  Agent A  │◄──────│  │   Room        │  │
│           │       │  │   Manager     │  │
└───────────┘       │  └───────┬───────┘  │
                    │          │          │
┌───────────┐       │          ▼          │
│  Agent B  │◄──────│  ┌───────────────┐  │
│           │       │  │  Socket.IO    │  │
└───────────┘       │  │  Handler      │  │
                    │  └───────┬───────┘  │
                    │          │          │
                    │          ▼          │
                    │  ┌───────────────┐  │
                    │  │   Auth        │  │
                    │  │   Service     │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │       Redis         │
                    │   (Optional)        │
                    └─────────────────────┘
```

## License

MIT
