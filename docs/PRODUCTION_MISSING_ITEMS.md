# Production-Ready Voice Messenger: Missing Items

## Summary
After reviewing the current implementation, the voice messenger is **~20% complete**. Key components (agent-link messaging, Piper TTS skeleton) exist, but core voice streaming functionality is not implemented.

---

## CRITICAL (Must Have for Basic Functionality)

### 1. Whisper Speech-to-Text Integration
- **Status:** Not implemented
- **Effort:** 2-3 days
- **Description:** Real-time speech-to-text for voice input
- **Files needed:**
  - `whisper_server.py` - STT API server
  - Whisper model configuration
  - Audio preprocessing pipeline

### 2. WebRTC Signaling Server
- **Status:** Not implemented
- **Effort:** 3-4 days
- **Description:** Core signaling infrastructure for P2P voice streaming
- **Components missing:**
  - WebSocket signaling handler
  - ICE candidate exchange
  - SDP offer/answer forwarding
  - Connection state management

### 3. Voice Room Management System
- **Status:** Not implemented
- **Effort:** 2-3 days
- **Description:** Create/join/leave rooms, participant tracking
- **Components missing:**
  - Room CRUD API endpoints
  - Participant management
  - Room state machine (created → waiting → active → closed)
  - In-memory room storage (Redis/PostgreSQL for production)

### 4. Frontend Voice UI Components
- **Status:** Not implemented (only agent-link dashboard exists)
- **Effort:** 4-5 days
- **Description:** React-based voice messenger interface
- **Components missing:**
  - Voice room view
  - Microphone controls (mute/unmute)
  - Participant list
  - Connection status indicators
  - Audio visualization (waveform)

### 5. Complete WebRTC Client Implementation
- **Status:** Not implemented
- **Effort:** 3-4 days
- **Description:** Browser-side WebRTC handling
- **Components missing:**
  - `useWebRTC` hook
  - `RTCPeerConnection` management
  - ICE candidate handling
  - Audio stream capture/playback
  - Codec negotiation (Opus)

---

## IMPORTANT (Should Have for Reliability)

### 6. Database Integration (PostgreSQL)
- **Status:** Schema designed, not implemented
- **Effort:** 2 days
- **Items:**
  - Create `rooms`, `participants`, `sessions` tables
  - Connection pooling
  - Migration scripts

### 7. TURN Server Configuration
- **Status:** Not configured
- **Effort:** 1 day
- **Items:**
  - TURN server setup (Coturn/Google TURNS)
  - NAT traversal fallback
  - ICE server configuration

### 8. Audio Quality Monitoring
- **Status:** Not implemented
- **Effort:** 1-2 days
- **Items:**
  - Packet loss tracking
  - Jitter buffering statistics
  - Latency measurements
  - Connection quality indicators

### 9. Mute/Deafen Controls
- **Status:** Not implemented
- **Effort:** 0.5 day
- **Items:**
  - Client-side audio muting
  - Server-side mute state sync
  - UI toggle buttons

### 10. Connection Recovery/Reconnection Logic
- **Status:** Not implemented
- **Effort:** 1-2 days
- **Items:**
  - WebSocket auto-reconnect
  - WebRTC ICE restart
  - Session state recovery

### 11. Input Validation & Rate Limiting
- **Status:** Partial (agent-link has it)
- **Effort:** 0.5 day
- **Items:**
  - Voice API request validation
  - Rate limiting on room creation
  - Audio file size limits

---

## NICE-TO-HAVE (Future Improvements)

### 12. Voice Activity Detection (VAD)
- **Status:** Not implemented
- **Effort:** 2-3 days
- **Items:**
  - Silence detection
  - Automatic stream start/stop
  - Noise gating

### 13. Recording Capability
- **Status:** Not implemented
- **Effort:** 2 days
- **Items:**
  - Server-side audio recording
  - Recording controls
  - Audio playback/download

### 14. Transcription Integration
- **Status:** Not implemented
- **Effort:** 2 days
- **Items:**
  - Real-time transcription display
  - Chat message generation from voice
  - Message history sync

### 15. Multi-Party Rooms (3+ agents)
- **Status:** Architecture designed
- **Effort:** 4-5 days
- **Items:**
  - SFU architecture (MediaSoup/Janus)
  - Selective forwarding
  - Multiple participant UI

### 16. Dynamic Bitrate Adaptation
- **Status:** Not implemented
- **Effort:** 1-2 days
- **Items:**
  - Bandwidth detection
  - Opus bitrate adjustment
  - Quality throttling

### 17. Push-to-Talk (PTT) Mode
- **Status:** Not implemented
- **Effort:** 0.5 day
- **Items:**
  - Keyboard shortcut support
  - PTT UI indicator
  - Mode toggle

### 18. Audio Effects/Processing
- **Status:** Not implemented
- **Effort:** 2 days
- **Items:**
  - Noise suppression
  - Echo cancellation
  - Gain normalization

### 19. Comprehensive Test Suite
- **Status:** Partial (agent-link tests exist)
- **Effort:** 3-4 days
- **Items:**
  - WebRTC connection tests
  - Room management tests
  - Audio pipeline tests
  - Load/performance tests

### 20. Deployment Documentation
- **Status:** Not complete
- **Effort:** 1 day
- **Items:**
  - Docker configuration
  - Environment variables
  - Production deployment guide
  - Monitoring setup

---

## Effort Summary

| Category | Items | Total Effort |
|----------|-------|--------------|
| Critical | 5 | 14-19 days |
| Important | 6 | 8-11 days |
| Nice-to-have | 10 | 19-25 days |
| **TOTAL** | 21 | **41-55 days** |

---

## What's Currently Working

✅ **Agent Link System**
- Agent registry with reputation
- Message sending/broadcasting
- Session management
- Basic dashboard UI

✅ **Piper TTS (Basic)**
- Text-to-speech endpoint
- Health check
- Audio file output

✅ **Architecture Documentation**
- API specifications
- Component diagrams
- Database schemas

---

## Immediate Next Steps

1. **Week 1:** Implement Whisper STT + WebRTC signaling basics
2. **Week 2:** Build frontend voice UI + room management
3. **Week 3:** TURN configuration + audio quality monitoring
4. **Week 4:** Testing + documentation + deployment

---

*Generated: 2026-02-11*
*Review needed: @fawzi in #live-tea*
