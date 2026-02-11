# Voice Agent Messenger

A unified voice agent messaging system combining WebRTC signaling, speech-to-text (Whisper), and text-to-speech (Piper) capabilities.

## Quick Start

Get up and running in 5 commands:

```bash
git clone https://github.com/wassimbensalem/voice-agent-messenger.git
cd voice-agent-messenger
cp .env.example .env
docker compose up -d
curl http://localhost:8080/api/health
```

That's it! All services will be running:

| Service | URL | Description |
|---------|-----|-------------|
| **Web UI** | http://localhost:3000 | Voice chat interface |
| Signaling Server | http://localhost:8080 | WebRTC signaling |
| Whisper STT | http://localhost:8001 | Speech-to-text |
| Piper TTS | http://localhost:5001 | Text-to-speech |
| Redis | localhost:6379 | Session storage |

## Using the Web Interface

Open your browser and navigate to **http://localhost:3000** to access the voice agent messenger interface.

### Features:
- 🎙️ **Voice Chat Rooms** - Create or join rooms for real-time voice communication
- 🎤 **Speech-to-Text** - Record audio and get instant transcriptions
- 🔊 **Text-to-Speech** - Convert text to natural-sounding speech
- 📊 **Audio Visualization** - Real-time audio waveform display
- 👥 **Participant Management** - See who's in your room

## Stopping Services

```bash
docker compose down
```

## Repository Structure

```
voice-agent-messenger/
├── signaling-server/        # WebRTC signaling server (Node.js + Socket.IO)
├── webrtc-client/           # WebRTC client library (TypeScript)
├── whisper/                 # Whisper STT implementations
│   ├── whisper_server.py   # FastAPI Whisper server
│   └── Dockerfile
├── piper/                   # Piper TTS implementation
│   └── piper_server.py     # FastAPI Piper TTS server
├── docker-compose.yml       # All services orchestration
├── .env.example             # Environment template
└── README.md               # This file
```

## Components

### Signaling Server
- **Port:** 8080
- **Tech:** Node.js, TypeScript, Socket.IO, Redis
- **Features:** Room management, JWT auth, ICE candidate exchange

### Whisper STT
- **Port:** 8001
- **Tech:** Python, FastAPI, faster-whisper
- **Model:** base (configurable via WHISPER_MODEL_SIZE)

### Piper TTS
- **Port:** 5000
- **Tech:** Python, FastAPI, Piper
- **Model:** en_US-amy-medium (configurable via PIPER_MODEL_PATH)

## API Endpoints

### Signaling Server
- `GET /api/health` - Health check
- `GET /api/rooms` - List rooms
- `POST /api/rooms` - Create room
- `GET /api/redis-health` - Redis status

### Whisper STT
- `POST /transcribe` - Transcribe audio
- `GET /health` - Health check

### Piper TTS
- `POST /synthesize` - Text to speech
- `GET /health` - Health check

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Required
JWT_SECRET=your-secure-secret

# Optional - Whisper settings
WHISPER_MODEL_SIZE=base      # tiny, base, small, medium, large
WHISPER_DEVICE=cpu           # cpu, cuda
WHISPER_COMPUTE_TYPE=int8    # int8, int8_float16, float16

# Optional - Piper settings
PIPER_MODEL_PATH=/models/en_US-amy-medium.onnx
```

## Development

### Run services manually:

```bash
# Start Redis
redis-server

# Signaling server
cd signaling-server
npm install
npm start

# Whisper server
cd whisper
python3 -m venv venv
source venv/bin/activate
pip install -r whisper_requirements.txt
python whisper_server.py

# Piper server
cd piper
python3 -m venv venv
source venv/bin/activate
pip install -r piper_requirements.txt
python piper_server.py
```

## Testing

```bash
# Test transcription
curl -X POST -F "audio=@test.wav" http://localhost:8001/transcribe

# Test TTS
curl -X POST http://localhost:5000/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!"}'

# Check all services
curl http://localhost:8080/api/health
curl http://localhost:8001/health
curl http://localhost:5000/health
```

## License

MIT License
