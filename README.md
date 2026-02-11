# Voice Agent Messenger

A unified voice agent messaging system combining WebRTC signaling, speech-to-text (Whisper), and text-to-speech (Piper) capabilities.

## Repository Structure

```
voice-agent-messenger/
├── signaling-server/        # WebRTC signaling server (Node.js + Socket.IO)
├── webrtc-client/           # WebRTC client library (TypeScript)
├── whisper/                 # Whisper STT implementations
│   ├── whisper_server.py   # FastAPI Whisper server
│   ├── whisper.cpp/        # Native Whisper C++ implementation
│   └── WHISPER_DEPLOYMENT.md
├── piper/                   # Piper TTS implementation
│   └── piper_server.py     # FastAPI Piper TTS server
├── docs/                    # All documentation
├── tests/                   # All test suites
├── docker/                  # Docker configurations
└── README.md               # This file
```

## Components

### Signaling Server
Node.js + Socket.IO signaling server for WebRTC peer-to-peer communication.
- **Location:** `signaling-server/`
- **Tech:** Node.js, TypeScript, Socket.IO, Redis
- **Features:** Room management, JWT auth, ICE candidate exchange

### WebRTC Client
TypeScript client library for voice agent communication.
- **Location:** `webrtc-client/`
- **Tech:** TypeScript, WebRTC, Socket.IO
- **Features:** Multi-peer mesh, audio tracks, signaling integration

### Whisper STT
Speech-to-text using OpenAI's Whisper model.
- **Location:** `whisper/`
- **Implementations:**
  - `whisper_server.py` - FastAPI server (Python, faster-whisper)
  - `whisper.cpp/` - Native C++ implementation
- **Port:** 8001

### Piper TTS
Text-to-speech using Piper neural TTS.
- **Location:** `piper/`
- **Implementation:** `piper_server.py` - FastAPI server
- **Port:** 5000



All## Documentation documentation is in the `docs/` directory:
- Architecture designs
- API specifications
- Research reports
- Deployment guides

## Quick Start

### Start Signaling Server
```bash
cd signaling-server
npm install
npm start
```

### Start WebRTC Client
```bash
cd webrtc-client
npm install
npm run build
```

### Start Whisper STT Server
```bash
cd whisper
python3 whisper_server.py
# Or use native server:
cd whisper.cpp
./main -m models/ggml-small.bin -f samples/jfk.wav -p 8001
```

### Start Piper TTS Server
```bash
cd piper
python3 piper_server.py
```

## Docker

Deploy using Docker:
```bash
cd docker
docker build -t voice-agent-signaling -f Dockerfile ..
```

## Testing

All tests are in the `tests/` directory:
- Unit tests for each component
- Integration tests
- E2E tests

## Authors

- **Max** - Signaling server, Piper TTS, Whisper STT (Python)
- **Scout** - WebRTC client, Whisper.cpp, Research

## License

MIT License
