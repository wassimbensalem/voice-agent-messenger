# Integration Test Plan

## Overview

This document outlines the integration test plan for the WebRTC Voice Client with the signaling server and agent-link authentication system.

## Test Environment

### Prerequisites
- Node.js v18+
- npm or yarn
- Signaling server (Socket.IO) running
- Agent-Link service for JWT token generation
- Optional: Whisper STT server (http://localhost:8001)
- Optional: Piper TTS server (http://localhost:5000)

### Environment Variables
```bash
export SIGNALING_URL='ws://localhost:3000'
export AGENT_LINK_TOKEN='your-jwt-token'
export AGENT_ID='test-agent'
export ROOM_ID='test-room'
```

## Test Phases

### Phase 1: Unit Tests (Build Verification)

**Objective:** Verify the TypeScript code compiles correctly

**Tests:**
1. `npm run build` - Compile TypeScript
2. Type declarations generated in `dist/`
3. JavaScript output in `dist/`

**Success Criteria:**
- Build completes without errors
- `dist/index.js` exists
- `dist/index.d.ts` exists

**Run:**
```bash
npm run build
```

### Phase 2: Connection Tests

**Objective:** Test basic connectivity to server components

**Tests:**

#### Test 2.1: Client Instantiation
- Create WebRTCVoiceClient instance
- Verify configuration is stored correctly

#### Test 2.2: Event Handler Registration
- Register handlers for all event types
- Verify handlers are called correctly

#### Test 2.3: Audio Context Initialization
- Initialize audio context
- Obtain local microphone stream
- Verify stream has audio track

#### Test 2.4: Server Connection
- Connect to signaling server
- Handle authentication
- Verify connection state transitions

#### Test 2.5: Room Operations
- Join a room
- Receive room state
- Leave room

**Run:**
```bash
npx ts-node tests/connection-test.ts
```

**Expected Results:**
| Test | Expected Result |
|------|-----------------|
| Client Instantiation | Client created successfully |
| Event Handlers | 2+ handlers registered |
| Audio Init | Local stream obtained |
| Server Connection | State = 'connected' |
| Room Join | room_joined event fired |

### Phase 3: Authentication Tests

**Objective:** Verify agent-link JWT authentication

**Tests:**

#### Test 3.1: Valid Token Authentication
- Connect with valid agent-link token
- Verify `auth_ok` event received

#### Test 3.2: Invalid Token Handling
- Connect with invalid token
- Verify `auth_error` event received
- Verify proper error message

#### Test 3.3: Token Expiration
- Connect with expired token
- Verify rejection

**Run:**
```bash
# Valid token test
AGENT_LINK_TOKEN='valid-token' npx ts-node tests/auth-test.ts

# Invalid token test  
AGENT_LINK_TOKEN='invalid-token' npx ts-node tests/auth-test.ts
```

### Phase 4: WebRTC Connection Tests

**Objective:** Verify peer-to-peer audio connections

**Tests:**

#### Test 4.1: ICE Candidate Exchange
- Two clients join same room
- ICE candidates exchanged
- ICE connection established

#### Test 4.2: Audio Streaming
- Client A speaks
- Client B receives audio
- Verify audio track received

#### Test 4.3: Multiple Peers
- 3+ clients in room
- Full mesh connection
- All peers connected

#### Test 4.4: Audio Toggle
- Disable audio
- Verify no audio sent
- Re-enable audio
- Verify audio resumes

**Run:**
```bash
npx ts-node tests/webrtc-test.ts
```

### Phase 5: Voice Pipeline Tests

**Objective:** Test STT and TTS integration

**Tests:**

#### Test 5.1: Whisper STT
- Send audio to Whisper server
- Verify transcription returned
- Check confidence score

#### Test 5.2: Piper TTS
- Send text to Piper
- Verify audio returned
- Play audio locally

#### Test 5.3: Full Voice Loop
- Client A speaks
- Whisper transcribes
- Response generated
- Piper synthesizes
- Client A hears response

**Run:**
```bash
# STT test
npx ts-node tests/stt-test.ts

# TTS test
npx ts-node tests/tts-test.ts

# Full loop test
npx ts-node tests/voice-loop-test.ts
```

### Phase 6: Stress Tests

**Objective:** Verify stability under load

**Tests:**

#### Test 6.1: Reconnection
- Disconnect from server
- Automatic reconnection
- Verify state restoration

#### Test 6.2: Rapid Join/Leave
- Join room
- Leave room immediately
- Repeat 10 times
- Verify no memory leaks

#### Test 6.3: Long-Running Session
- Connect for 1 hour
- Periodic audio activity
- Verify no crashes

### Phase 7: Error Handling Tests

**Objective:** Verify proper error recovery

**Tests:**

#### Test 7.1: Server Unavailable
- Start client without server
- Verify proper error
- Connect when server available

#### Test 7.2: Invalid Room
- Join non-existent room
- Verify room_not_found error

#### Test 7.3: Network Interruption
- Simulate network loss
- Verify reconnection
- Verify state consistency

## Test Suite Organization

```
tests/
├── connection-test.ts      # Phase 2 tests
├── auth-test.ts            # Phase 3 tests
├── webrtc-test.ts          # Phase 4 tests
├── stt-test.ts             # Phase 5.1 tests
├── tts-test.ts             # Phase 5.2 tests
├── voice-loop-test.ts      # Phase 5.3 tests
├── stress-test.ts          # Phase 6 tests
└── error-test.ts           # Phase 7 tests
```

## Running All Tests

```bash
# Install dependencies
npm install

# Build
npm run build

# Run connection tests
npx ts-node tests/connection-test.ts

# Run full test suite
npm test
```

## Test Results Format

Each test should output:

```
[✓/✗] Test Name: PASSED/FAILED
  Details: ...
  Duration: Xms
```

Summary at end:
```
Total: N | Passed: M | Failed: K
Exit code: 0 (success) or 1 (failure)
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm test
        env:
          SIGNALING_URL: ${{ secrets.SIGNALING_URL }}
          AGENT_LINK_TOKEN: ${{ secrets.AGENT_LINK_TOKEN }}
```

## Troubleshooting

### Common Issues

1. **Build fails with TypeScript errors**
   - Check Node.js version (needs 18+)
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check tsconfig.json settings

2. **Connection timeout**
   - Verify signaling server is running
   - Check network connectivity
   - Verify firewall allows WebSocket connections

3. **Microphone access denied**
   - Browser requires HTTPS for getUserMedia
   - User must grant permission
   - Check browser console for errors

4. **JWT authentication fails**
   - Verify token is not expired
   - Check agent-link service is running
   - Verify token claims are correct

### Debug Mode

Enable verbose logging:

```typescript
const client = new WebRTCVoiceClient({
  signalingUrl: 'ws://localhost:3000',
  agentId: 'test',
});

// Enable debug output
process.env.DEBUG = 'webrtc:*';
```

## Acceptance Criteria

| Criterion | Target | Status |
|-----------|--------|--------|
| Build succeeds | 100% | ⬜ |
| Connection tests pass | 100% | ⬜ |
| Auth tests pass | 100% | ⬜ |
| WebRTC tests pass | 100% | ⬜ |
| Voice pipeline tests pass | 100% | ⬜ |
| Error handling correct | 100% | ⬜ |
| Documentation complete | 100% | ⬜ |

## Timeline

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Phase 1: Unit Tests | 10 min | Build verified |
| Phase 2: Connection | 15 min | Client connects |
| Phase 3: Auth | 10 min | JWT verified |
| Phase 4: WebRTC | 20 min | Audio works |
| Phase 5: Voice Pipeline | 15 min | STT/TTS work |
| Phase 6: Stress Tests | 30 min | Stability verified |
| Phase 7: Error Handling | 15 min | Errors handled |

**Total estimated time: ~2 hours**

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Reviewer | | | |
| QA | | | |
