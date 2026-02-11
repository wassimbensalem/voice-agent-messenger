# Voice AI Pipeline Research - February 2025

## Executive Summary

Research findings for optimizing the voice AI pipeline focusing on WebRTC audio streaming, latency reduction strategies, and frontend voice UI frameworks.

---

## 1. WebRTC Audio Streaming Best Practices

### Core Principles
- **WebRTC delivers <500ms latency** compared to 2-5s for RTMP and 6-30s for HLS
- Low latency enables natural conversations - **200ms delay disrupts conversation flow**
- Key metrics to monitor: RTT, jitter, packet loss, one-way delay

### Optimization Techniques

#### Network Layer
- **Adaptive Bitrate Streaming**: Dynamically adjusts quality to bandwidth
- **STUN/TURN Servers**: Enable peer-to-peer connections, reduce relay hops
- **ICE Configuration**: Fine-tune ICE settings for faster candidate gathering
- **QUIC/SFrame**: New transport protocols promising further latency reductions

#### Infrastructure
- **SFU vs MCU**: Use SFU (Selective Forwarding Unit) for scalable low-latency; MCUs add delay
- **Edge Deployment**: Deploy media servers closer to users to minimize RTT
- **Anycast**: Consider for latency-sensitive deployments

#### Device/Browser
- **Hardware Acceleration**: Leverage GPU for video encoding/decoding
- **Browser Selection**: Use latest Chrome or Firefox (optimized WebRTC stacks)
- **Playout Delay**: Reduce to zero for cloud gaming use cases

### Key Resources
- [WebRTC Low Latency Guide 2025](https://www.videosdk.live/developer-hub/webrtc/webrtc-low-latency)
- [BlogGeek - Reducing WebRTC Latency](https://bloggeek.me/reducing-latency-webrtc/)

---

## 2. Latency Reduction Strategies

### Pipeline Latency Breakdown
For voice AI agents, the typical latency breakdown:
- **LLM inference: 60-70% of total latency**
- Speech-to-text (STT): 100-300ms
- Text-to-speech (TTS): 100-500ms
- Network transit: Variable

### Proven Techniques

#### Parallel SLM + LLM Architecture
- Run Small Language Model (SLM) + Large Language Model **simultaneously**
- SLM provides quick initial response (~329ms first token)
- LLM provides comprehensive follow-up (~900ms first token)
- Stream SLM tokens to TTS immediately while LLM continues

#### Streaming Response Generation
- Process tokens incrementally rather than waiting for complete response
- Begin TTS as soon as first tokens available
- Use async/await patterns to avoid blocking

#### Turn Detection Optimization
- Use lightweight turn detection models (~100-200ms overhead)
- Consider LiveKit turn detector plugin for better accuracy

#### Buffer Management
- **Smaller audio buffers** reduce delay but increase jitter risk
- **Larger buffers** smooth jitter but add latency
- Balance based on use case (conversational AI needs smaller)

### Target Latency Benchmarks
| Use Case | Target Latency |
|----------|----------------|
| Conferencing | <200ms ideal, <500ms acceptable |
| Conversational AI | <500ms industry goal, 200-300ms ideal |
| Live Streaming | 500ms great, 1-2s good |
| Cloud Gaming | 50-60ms tolerable, lower is better |

---

## 3. Frontend Voice UI Frameworks

### Recommended Frameworks

#### LiveKit Agents (Primary Recommendation)
- **Purpose-built for real-time voice AI**
- WebRTC-native with low-latency audio streaming
- Built-in integrations: STT, LLM, TTS, VAD
- Turn detection model included
- Python/AsyncIO architecture
- Active development and community

#### Alternative Options
- **Daily.co**: Pre-built voice/video SDKs
- **Twilio Voice**: Robust telephony integration
- **Agora**: Enterprise-grade real-time engagement

### Frontend Integration Patterns

#### React/Vue Integration
```javascript
// WebRTC connection pattern
const pc = new RTCPeerConnection(configuration);
pc.ontrack = (event) => {
  audioElement.srcObject = event.streams[0];
};
```

#### Audio Buffer Configuration
```javascript
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
// Optimize buffer sizes for low latency
```

### Voice UI Considerations
- **VAD (Voice Activity Detection)**: Essential for natural conversation flow
- **Real-time feedback**: Visual indicators for audio processing status
- **Interruptibility**: Allow user to interrupt AI responses
- **Error handling**: Graceful degradation during network issues

---

## 4. Codec Optimization

### Opus Codec Configuration
- Default codec for WebRTC audio
- Supports both voice and music
- **Low-latency mode**: Adjust frame size for faster encoding

### Recommended Settings
```javascript
constRTCRtpCodecCapabilities = {
  mimeType: 'audio/opus',
  clockRate: 48000,
  channels: 1, // Mono for voice
  payloadType: 111
};
```

---

## 5. Implementation Checklist for Max

### Infrastructure
- [ ] Deploy TURN/media servers at edge locations
- [ ] Configure ICE candidate gathering for speed
- [ ] Set up monitoring for RTT, jitter, packet loss

### Pipeline Architecture
- [ ] Implement parallel SLM+LLM execution
- [ ] Add streaming token processing to TTS
- [ ] Optimize turn detection model selection
- [ ] Profile LLM inference (target 60-70% latency reduction)

### Frontend
- [ ] Integrate LiveKit Agents framework
- [ ] Implement proper audio buffer management
- [ ] Add VAD for natural conversation flow
- [ ] Create visual feedback for audio state

### Monitoring
- [ ] Set up Grafana dashboards for latency metrics
- [ ] Monitor end-to-end conversation latency
- [ ] Track per-component latency breakdown

---

## 6. Key Research Sources

1. **VideoSDK** - WebRTC Low Latency Guide 2025
2. **BlogGeek.me** - Reducing Latency in WebRTC
3. **WebRTC.ventures** - Parallel SLM/LLM Architecture
4. **LiveKit Docs** - Turn Detection & Voice Agents
5. **Daily.co** - World's Fastest Voice Bot

---

## Summary for Max

**Primary recommendation**: Use **LiveKit Agents framework** with **parallel SLM+LLM architecture**. Target **sub-500ms response times** for conversational AI.

Key optimizations:
1. Edge deployment of media servers
2. Streaming token processing
3. Hardware acceleration for encoding
4. Adaptive bitrate based on network conditions
5. Comprehensive latency monitoring

The voice AI pipeline latency is dominated by LLM inference - focus optimization efforts there first.
