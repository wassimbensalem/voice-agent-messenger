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
| Signaling Server | http://localhost:8080 | WebRTC signaling |
| Whisper STT | http://localhost:8001 | Speech-to-text |
| Piper TTS | http://localhost:5000 | Text-to-speech |
| Redis | localhost:6379 | Session storage |

### Expected Output After Running

```
$ curl http://localhost:8080/api/health
{"status":"healthy","services":{"signaling":"up","redis":"up"}}

$ curl http://localhost:8001/health
{"status":"healthy","model":"base","device":"cpu"}

$ curl http://localhost:5000/health
{"status":"healthy","model":"en_US-amy-medium"}
```

---

## Stopping Services

```bash
docker compose down
```

---

## Common Issues

### 🔴 Docker Services Not Starting

**Symptom:** `docker compose up -d` fails or containers exit immediately

**Solutions:**
```bash
# Check container logs
docker compose logs

# Common fix: Ensure Docker is running
sudo systemctl start docker

# Rebuild containers
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 🔴 Port Already in Use

**Symptom:** `Error response from daemon: port is already allocated`

**Solutions:**
```bash
# Find what's using the port
sudo lsof -i :8080
sudo lsof -i :8001
sudo lsof -i :5000

# Kill the process or change the port in docker-compose.yml
```

### 🔴 Redis Connection Failed

**Symptom:** `Error: Redis connection refused` in signaling server logs

**Solutions:**
```bash
# Ensure Redis container is running
docker ps | grep redis

# Restart Redis
docker compose restart redis

# Check Redis health
docker exec -it voice-agent-messenger-redis-1 redis-cli ping
```

### 🔴 Whisper Model Download Fails

**Symptom:** `Error downloading model` or `Model not found`

**Solutions:**
```bash
# Check Whisper container logs
docker logs voice-agent-messenger-whisper-1

# Manually pull the model (CPU)
docker exec -it voice-agent-messenger-whisper-1 python -c "
import faster_whisper
faster_whisper.WhisperModel('base', device='cpu', compute_type='int8')
"

# Or use a smaller model in .env
WHISPER_MODEL_SIZE=tiny
```

### 🔴 Out of Memory (OOM)

**Symptom:** `Killed` or `MemoryError` in Whisper/Piper logs

**Solutions:**
```bash
# Use smaller models
WHISPER_MODEL_SIZE=tiny
WHISPER_COMPUTE_TYPE=int8

# Restart with memory limits
docker compose down
docker compose up -d
```

### 🔴 JWT Token Errors

**Symptom:** `401 Unauthorized` or `Token expired`

**Solutions:**
```bash
# Generate a new secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update .env and restart
docker compose restart signaling-server
```

---

## Troubleshooting Guide

### Step 1: Check Service Health

```bash
# All services health check
echo "=== Signaling ===" && curl -s http://localhost:8080/api/health
echo "=== Whisper ===" && curl -s http://localhost:8001/health
echo "=== Piper ===" && curl -s http://localhost:5000/health
echo "=== Redis ===" && docker exec -it voice-agent-messenger-redis-1 redis-cli ping
```

### Step 2: View Container Logs

```bash
# All logs
docker compose logs

# Specific service
docker compose logs signaling-server
docker compose logs whisper
docker compose logs piper
docker compose logs redis

# Follow logs in real-time
docker compose logs -f whisper
```

### Step 3: Verify Docker Network

```bash
# Check network connectivity
docker network ls
docker network inspect voice-agent-messenger_default

# Test inter-container communication
docker exec -it voice-agent-messenger-whisper-1 ping whisper
docker exec -it voice-agent-messenger-piper-1 ping piper
```

### Step 4: Check Resource Usage

```bash
# CPU and memory usage
docker stats

# Disk space
df -h
docker system df
```

---

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

---

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

---

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

---

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

---

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

---

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

---

## Getting Help

1. **Check logs first** - `docker compose logs`
2. **Verify health endpoints** - Use the health check commands above
3. **Search existing issues** - https://github.com/wassimbensalem/voice-agent-messenger/issues
4. **Open a new issue** with:
   - Full error message
   - `docker compose logs` output
   - Your environment (OS, Docker version)

---

## License

MIT License
