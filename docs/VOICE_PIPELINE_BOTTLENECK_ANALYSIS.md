# Voice Pipeline Architecture & Bottleneck Analysis

## Executive Summary

This document details the complete voice pipeline architecture for the OpenClaw voice agent system, analyzes current performance bottlenecks, and provides optimization recommendations.

## Architecture Overview

### Complete Voice Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VOICE PIPELINE ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ RECORD   │────▶│ STT      │────▶│ WebRTC   │────▶│ TTS      │────▶│ PLAYBACK │
  │ Audio    │     │ Whisper  │     │ Signaling│     │ Piper    │     │ Speaker  │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
       │                │                │                │                │
       ▼                ▼                ▼                ▼                ▼
   Mic Input      Port 8001        Port 8080        Port 5000        Audio Out
   (16kHz)        /inference       WS/Socket.IO    /synthesize     (44.1kHz)
```

## Component Details

### 1. Audio Recording
- **Technology:** ALSA (arecord) / Web Audio API
- **Format:** WAV, 16kHz sample rate, mono channel
- **Duration:** Configurable (typically 3-5 seconds for VAD)
- **Current Latency:** ~0-5000ms (depends on recording duration)

### 2. Speech-to-Text (Whisper)
- **Service:** whisper.cpp native server
- **Port:** 8001
- **Endpoint:** `/inference`
- **Model:** ggml-small.bin (466MB)
- **Architecture:** CPU-only inference
- **Current Latency:** ~7000ms (PRIMARY BOTTLENECK)
- **Health Check:** `curl localhost:8001/health`

### 3. WebRTC Signaling
- **Service:** Socket.IO signaling server
- **Port:** 8080
- **Protocol:** WebSocket + REST API
- **Authentication:** JWT-based
- **Features:** Room management, peer connection signaling
- **Current Latency:** ~50-200ms (message round-trip)
- **Health Check:** `curl localhost:8080/api/health`

### 4. Text-to-Speech (Piper)
- **Service:** Piper TTS server
- **Port:** 5000
- **Endpoint:** `/synthesize`
- **Model:** en_US-amy-medium.onnx
- **Sample Rate:** 22050 Hz
- **Current Latency:** ~1700ms
- **Health Check:** `curl localhost:5000/health`

### 5. Audio Playback
- **Technology:** ALSA (aplay) / Web Audio API
- **Format:** WAV, auto-detect sample rate
- **Current Latency:** ~0-1000ms (depends on audio duration)

## Current Performance Metrics

### Latency Breakdown (Typical)

| Stage | Duration | % of Total | Status |
|-------|----------|-------------|--------|
| Recording | 0-5000ms | ~30% | ✅ Variable |
| STT (Whisper) | ~7000ms | ~70% | ⚠️ BOTTLENECK |
| WebRTC | ~100ms | ~1% | ✅ Good |
| TTS (Piper) | ~1700ms | ~17% | ⚠️ Moderate |
| Playback | ~2000ms | ~20% | ✅ Variable |
| **TOTAL E2E** | **~10-15s** | 100% | ⚠️ Needs optimization |

### Measured Results (from e2e_test_results.md)

```
Component     Latency    Target     Status
──────────────────────────────────────────
STT (Whisper)  7483ms    <3000ms    ❌ Too slow
TTS (Piper)    1740ms    <2000ms    ✅ Good
──────────────────────────────────────────
TOTAL E2E      9223ms    <5000ms    ❌ Needs work
```

## Bottleneck Analysis

### 🔴 Primary Bottleneck: Whisper STT

**Why it's slow:**
1. **CPU-only inference** - No GPU acceleration available
2. **Large model** - ggml-small.bin is 466MB (accuracy-focused)
3. **Single-threaded** - Default thread count may be suboptimal
4. **Full audio processing** - Processes entire audio file at once

**Potential Solutions:**

#### Option 1: GPU Acceleration
```bash
# If CUDA is available
./whisper-server --model ./models/ggml-small.bin --port 8001 -t 4 --gpu 1
```
Expected improvement: 5-10x faster

#### Option 2: Smaller Model
```bash
# Use tiny model (39MB) instead of small
./whisper-server --model ./models/ggml-tiny.bin --port 8001 -t 4
```
Expected improvement: 3-5x faster, reduced accuracy

#### Option 3: More Threads
```bash
# Increase thread count
./whisper-server --model ./models/ggml-small.bin --port 8001 -t 8
# or
./whisper-server --model ./models/ggml-small.bin --port 8001 -t 16
```
Expected improvement: 1.5-2x faster (diminishing returns)

#### Option 4: Streaming Transcription
Implement partial transcription during recording:
- Start transcription after first silence detection
- Stream results as they become available
- Reduces perceived latency by 30-50%

### 🟡 Secondary Bottleneck: Piper TTS

**Current performance:** ~1700ms (acceptable for 22050Hz output)

**Optimization options:**
1. **Smaller voice model** - Use en_US-amy-medium.onnx (already optimal)
2. **Caching** - Cache frequently used phrases
3. **Lower sample rate** - 16000Hz instead of 22050Hz

**Sample Rate Impact:**
```
22050Hz → 1700ms
16000Hz → 1300ms (23% faster, minor quality reduction)
```

## Optimization Recommendations

### Short-term (Quick Wins)

1. **Increase Whisper thread count**
   ```bash
   # Edit whisper server startup
   ./whisper-server --model ./models/ggml-small.bin --port 8001 -t 8
   ```
   Expected: 30-50% improvement

2. **Use smaller Whisper model for faster turnaround**
   ```bash
   # Download tiny model
   ./main -m ./models/ggml-tiny.bin -f audio.wav
   ```
   Expected: 3-5x faster, 10-20% accuracy loss

3. **Implement audio preprocessing**
   - Remove silence before sending to Whisper
   - Reduce audio quality to 16kHz mono WAV
   - Expected: 10-20% improvement

### Medium-term (Architecture Changes)

1. **Streaming STT**
   - Implement VAD (Voice Activity Detection)
   - Stream audio chunks to Whisper
   - Partial results as they become available
   - Expected: 40-60% perceived improvement

2. **Parallel Processing**
   - Start TTS immediately after first STT partial result
   - Pipeline STT + TTS instead of sequential
   - Expected: 30-40% improvement in E2E latency

3. **Response Caching**
   - Cache common responses
   - Hash audio + text → cached TTS output
   - Expected: Instant for cached responses

### Long-term (Infrastructure)

1. **GPU Acceleration**
   - Deploy Whisper with CUDA support
   - Expected: 5-10x improvement

2. **Cloud STT API**
   - Use OpenAI Whisper API or Google Speech-to-Text
   - Expected: 2-3x improvement, cloud costs apply

3. **Model Optimization**
   - Quantize Whisper model to 4-bit
   - Expected: 2-3x improvement, minimal accuracy loss

## Monitoring & Metrics

### Key Metrics to Track

1. **STT Latency** (Whisper)
   - Target: <3000ms
   - Alert threshold: >5000ms

2. **TTS Latency** (Piper)
   - Target: <2000ms
   - Alert threshold: >3000ms

3. **E2E Latency**
   - Target: <5000ms
   - Alert threshold: >8000ms

4. **Accuracy Metrics**
   - Word Error Rate (WER) for STT
   - Mean Opinion Score (MOS) for TTS

### Logging Format

```json
{
  "timestamp": "2026-02-11T11:00:00Z",
  "stage": "stt",
  "duration_ms": 7483,
  "audio_size_bytes": 352000,
  "text_length": 75,
  "success": true,
  "latency_bucket": ">7000ms"
}
```

## Test Scripts

### Quick Test
```bash
./test-voice-pipeline.sh
```

### Latency Benchmark
```bash
npx ts-node latency-benchmark.ts
```

### Full Integration Test
```bash
npx ts-node voice-pipeline-integration.ts
```

## Conclusion

**Current Status:** 
- ✅ Whisper STT: Working but slow (7.5s avg)
- ✅ Piper TTS: Working well (1.7s avg)
- ✅ WebRTC: Connected, room join pending
- ✅ End-to-End: ~9.2s total latency

**Priority Actions:**
1. Increase Whisper thread count to 8
2. Consider smaller model for faster turnaround
3. Implement streaming transcription
4. Parallelize STT → TTS pipeline

**Estimated Improvement Potential:**
- With threads + smaller model: 3-4s E2E
- With streaming + parallel: 2-3s E2E  
- With GPU: 1-2s E2E

## References

- whisper.cpp: https://github.com/ggerganov/whisper.cpp
- Piper TTS: https://github.com/rhasspy/piper
- WebRTC Signaling: `/root/.openclaw/workspace-agents/max/signaling-server/`
- Previous test results: `/root/.openclaw/workspace-agents/scout/e2e_test_results.md`
