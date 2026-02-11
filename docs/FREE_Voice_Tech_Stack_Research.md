# FREE Voice Technology Stack Research Report

**Date:** February 10, 2026  
**Researcher:** Scout (Subagent)  
**Goal:** Find completely FREE voice streaming stack components

---

## Executive Summary

A completely FREE voice streaming stack is achievable using open-source technologies. However, some projects have caveats:

- **WebRTC:** Excellent free options available (mediasoup, Jitsi, Janus, Pion)
- **STT (Speech-to-Text):** OpenAI Whisper and whisper.cpp are production-ready and FREE. Coqui STT is no longer maintained.
- **TTS (Text-to-Speech):** espeak-ng and Festival remain stable. Coqui TTS is unmaintained since company shutdown (Jan 2024).
- **Hosting:** Free tiers exist but have significant limitations for production WebRTC.

---

## 1. FREE WebRTC Solutions

### 1.1 Mediasoup ⭐ RECOMMENDED
**Status:** Actively maintained, production-ready  
**License:** MIT  
**GitHub:** https://github.com/versatica/mediasoup

**Pros:**
- High-performance, minimalistic Node.js/Rust framework
- Designed for large-scale professional use
- Exceptional performance with low resource consumption
- Highly customizable with flexible Node.js API
- Used by many large-scale deployments

**Cons:**
- No official support (maintainers work at Miro)
- Steeper learning curve than simpler alternatives
- Requires self-hosting infrastructure

**Best for:** Developers building custom WebRTC applications with performance requirements

---

### 1.2 Jitsi Meet
**Status:** Actively maintained, widely adopted  
**License:** Apache 2.0  
**GitHub:** https://github.com/jitsi/jitsi-meet

**Pros:**
- Full-featured video conferencing solution out-of-the-box
- SFU architecture supports thousands of participants
- HD audio/video with adaptive quality
- End-to-end encryption
- Modular architecture for customization
- Pre-configured AMIs available for AWS, GCP, Alibaba Cloud

**Cons:**
- More complex if you only need parts of functionality
- Java-based backend (React UI)

**Best for:** Organizations needing Google Meet-like functionality quickly

---

### 1.3 Janus Gateway
**Status:** Actively maintained  
**License:** GPLv3  
**GitHub:** https://github.com/meetecho/janus-gateway

**Pros:**
- Versatile C-based gateway
- Extensive plugin architecture
- Handles hundreds of thousands of concurrent sessions
- Multi-protocol support
- Ultra-low latency streaming

**Cons:**
- Written in C (limited developer pool)
- No official commercial support (only Meetecho offers paid support)
- More complex to extend

**Best for:** Complex, multi-purpose streaming requiring protocol integration

---

### 1.4 Pion (Go-based)
**Status:** Fast-growing, actively maintained  
**License:** MIT  
**GitHub:** https://github.com/pion/webrtc

**Pros:**
- Written in Go (popular language, good ecosystem)
- General purpose (clients and servers)
- Fastest growing WebRTC project
- Multiple media server implementations built on it
- Strong community

**Cons:**
- Newer to the scene
- Less battle-tested at massive scale

**Best for:** Go developers building custom WebRTC solutions

---

### 1.5 PeerJS
**Status:** Maintained  
**License:** MIT  
**GitHub:** https://github.com/peers/peerjs

**Pros:**
- Simplest WebRTC abstraction
- Good for peer-to-peer use cases
- Easy signaling server setup

**Cons:**
- Limited to peer-to-peer (not a full media server)
- Less suitable for group calls or broadcasting

**Best for:** Simple peer-to-peer applications

---

## 2. FREE Speech-to-Text (STT)

### 2.1 OpenAI Whisper ⭐ RECOMMENDED
**Status:** Actively maintained, production-ready  
**License:** MIT  
**GitHub:** https://github.com/openai/whisper

**Key Features:**
- Approaches human-level robustness and accuracy on English ASR
- Multilingual speech recognition (98+ languages)
- Speech translation capabilities
- Language identification
- Voice activity detection

**Available Models:**
| Model | Parameters | VRAM Required | Relative Speed |
|-------|------------|--------------|----------------|
| tiny | 39M | ~1GB | ~10x |
| base | 74M | ~1GB | ~7x |
| small | 244M | ~2GB | ~4x |
| medium | 769M | ~5GB | ~2x |
| large | 1550M | ~10GB | 1x |
| turbo | 809M | ~6GB | ~8x |

**Installation:**
```bash
pip install -U openai-whisper
# or
pip install git+https://github.com/openai/whisper.git
```

**Requirements:** Python 3.8-3.11, PyTorch, ffmpeg

**Best for:** Production STT requiring high accuracy

---

### 2.2 Whisper.cpp ⭐ RECOMMENDED FOR EDGE
**Status:** Actively maintained  
**License:** MIT  
**GitHub:** https://github.com/ggml-org/whisper.cpp

**Key Advantages over Whisper:**
- Pure C/C++ implementation (no Python dependencies)
- Runs on resource-constrained devices
- Apple Silicon optimization (NEON, Metal, Core ML)
- AVX/AVX2 intrinsics for x86
- Integer quantization support (5-bit, 8-bit)
- Runs on Raspberry Pi, iOS, Android, browsers (WebAssembly)
- Zero memory allocations at runtime
- Vulkan, CUDA, OpenVINO support

**Memory Usage:**
| Model | Disk | Memory |
|-------|------|--------|
| tiny | 75 MiB | ~273 MB |
| base | 142 MiB | ~388 MB |
| small | 466 MiB | ~852 MB |
| medium | 1.5 GiB | ~2.1 GB |
| large | 2.9 GiB | ~3.9 GB |

**Real-time Capabilities:**
- Runs fully offline on iPhone 13
- Real-time microphone transcription with VAD
- HTTP server mode for API deployments

**Best for:** Edge devices, mobile apps, resource-constrained environments

---

### 2.3 Vosk
**Status:** Actively maintained  
**License:** Apache 2.0  
**Website:** https://alphacephei.com/vosk/

**Pros:**
- Lightweight models (down to 10MB)
- Works offline
- Good for real-time transcription
- Mobile and embedded friendly
- Multiple language support

**Cons:**
- Lower accuracy than Whisper
- Limited vocabulary compared to larger models

**Best for:** Mobile apps, IoT, real-time transcription where accuracy trade-off is acceptable

---

### 2.4 Coqui STT ⚠️ USE WITH CAUTION
**Status:** NO LONGER MAINTAINED  
**GitHub:** https://github.com/coqui-ai/STT

**Important:** Coqui AI company shut down in January 2024. The project is no longer actively maintained.

> "This project is no longer actively maintained, and we have stopped hosting the online Model Zoo. We've seen focus shift towards newer STT models such as Whisper."

**Recommendation:** Use Whisper or Whisper.cpp instead.

---

## 3. FREE Text-to-Speech (TTS)

### 3.1 espeak-ng ⭐ RECOMMENDED
**Status:** Actively maintained  
**License:** GPLv3  
**GitHub:** https://github.com/espeak-ng/espeak-ng

**Pros:**
- Extremely lightweight
- Supports 100+ languages
- No dependencies
- Runs on embedded systems
- Multiple voice variants

**Cons:**
- Robotic voice quality
- Limited expressiveness

**Best for:** Accessibility applications, embedded systems, low-resource environments

**Installation:**
```bash
# Ubuntu/Debian
sudo apt install espeak-ng

# macOS
brew install espeak-ng
```

---

### 3.2 Festival Speech Synthesis System
**Status:** Maintained (older project)  
**License:** BSD-style  
**Website:** http://www.cstr.ed.ac.uk/projects/festival/

**Pros:**
- Full TTS system
- British English voices included
- Extensible architecture
- Multiple languages with additional voices

**Cons:**
- Older codebase
- Limited documentation
- Robotic output

**Best for:** Legacy systems, research applications

**Installation:**
```bash
# Ubuntu/Debian
sudo apt install festival festival-freebsoft-utils
```

---

### 3.3 Coqui TTS ⚠️ USE WITH CAUTION
**Status:** NO LONGER MAINTAINED  
**GitHub:** https://github.com/coqui-ai/TTS

**Important:** Coqui AI company shut down in January 2024. The open-source library continues to exist but is unmaintained.

**Note:** While the code is available, there are no security updates, bug fixes, or new features.

**Recommendation:** Use espeak-ng, Festival, or consider Piper (see below).

---

### 3.4 Piper ⭐ RECOMMENDED ALTERNATIVE
**Status:** Actively maintained  
**License:** Apache 2.0  
**GitHub:** https://github.com/rhasspy/piper

**Pros:**
- Neural TTS (better quality than espeak)
- Fast and lightweight
- Multiple voice models
- Self-contained
- Privacy-focused (runs locally)

**Cons:**
- Requires downloaded voice models
- Less natural than cloud TTS

**Best for:** High-quality local TTS without cloud dependencies

---

### 3.5 MaryTTS (Bonus)
**Status:** Maintained but older  
**License:** LGPL  
**Website:** https://github.com/marytts/marytts

**Pros:**
- Java-based, easy to embed
- Multiple languages
- Voice mixing capabilities

**Cons:**
- Heavy resource usage
- Older technology

---

## 4. FREE Hosting Options

### 4.1 Railway
**Free Tier:** Limited  
**Website:** https://railway.app/

**Free Tier Limits:**
- $5 credit per month (free tier)
- 500 hours of execution per month
- 0.5GB RAM
- Sleeps after 15 minutes of inactivity
- Limited database options

**Pros:**
- Simple deployment
- Good developer experience
- Visual infrastructure design

**Cons:**
- Not suitable for production WebRTC (requires persistent connections)
- Services spin down after inactivity
- Limited resources on free tier

**Best for:** Development, testing, non-real-time applications

---

### 4.2 Render
**Free Tier:** Limited  
**Website:** https://render.com/

**Free Tier Limits:**
- Free web services (sleep after 15 min)
- 512MB RAM on free tier
- Limited build minutes
- No persistent connections

**Pros:**
- Good documentation
- Simple deployment
- Multiple service types

**Cons:**
- Not suitable for WebRTC servers
- Services sleep after inactivity
- Limited resources

**Best for:** Web applications, APIs, background workers

---

### 4.3 Fly.io
**Free Tier:** Limited  
**Website:** https://fly.io/

**Free Tier Limits:**
- 3 shared VMs (shared-cpu-1x, 256MB RAM)
- 3GB persistent volume storage
- 160GB bandwidth/month out
- 3GB/month in

**Pros:**
- Edge computing (global distribution)
- Better for latency-sensitive apps
- Persistent volumes

**Cons:**
- Complex setup
- Limited resources on free tier
- WebRTC servers require persistent connections

**Best for:** Edge-deployed services, low-latency applications

---

## 5. Recommended Production Stack

### For Production Voice Applications

```
┌─────────────────────────────────────────────────────────────┐
│                    RECOMMENDED STACK                        │
├─────────────────────────────────────────────────────────────┤
│  WebRTC:      Mediasoup (self-hosted on VPS)                │
│  STT:         Whisper.cpp (CPU-optimized)                   │
│  TTS:         Piper or espeak-ng                            │
│  Hosting:     Hetzner / DigitalOcean (VPS)                   │
│               OR                                             │
│               Self-hosted on bare metal                      │
└─────────────────────────────────────────────────────────────┘
```

### Why This Stack?

1. **Mediasoup:** Best balance of performance, customization, and active development
2. **Whisper.cpp:** State-of-the-art accuracy with efficient C++ implementation
3. **Piper:** Neural TTS quality without cloud dependencies
4. **VPS Hosting:** Free tiers don't support persistent WebRTC connections

---

## 6. Setup Complexity Overview

| Component | Setup Complexity | Production Readiness |
|-----------|-----------------|---------------------|
| Mediasoup | Medium-High | ✅ Excellent |
| Jitsi Meet | Low | ✅ Excellent |
| Janus | High | ✅ Excellent |
| Pion | Medium | ✅ Good |
| PeerJS | Low | ⚠️ Limited |
| Whisper | Low-Medium | ✅ Excellent |
| Whisper.cpp | Medium | ✅ Excellent |
| Vosk | Low | ✅ Good |
| espeak-ng | Low | ✅ Good |
| Festival | Low | ⚠️ Older |
| Piper | Medium | ✅ Good |
| Coqui TTS | Medium | ❌ Unmaintained |

---

## 7. Free Hosting Reality Check

**Critical Finding:** None of the major PaaS free tiers (Railway, Render, Fly.io) are suitable for production WebRTC because:

1. **WebRTC requires persistent connections** - free tiers sleep after 15 minutes
2. **WebRTC is resource-intensive** - free tiers have limited RAM/CPU
3. **WebRTC needs UDP support** - some PaaS have limitations

**Alternative Options:**
- **Hetzner Cloud:** ~€5/month for adequate VPS
- **DigitalOcean:** ~$4/month droplets
- **Oracle Cloud:** Always-free tier (2x AMD-based VM.Standard.E2.1.Micro)
- **Google Cloud:** $300 credit for 90 days, then limited free tier
- **AWS:** 12-month free tier (t2.micro/t3.micro)

---

## 8. Conclusion

### What IS Completely Free & Production-Ready:

✅ **WebRTC:** Mediasoup, Jitsi, Janus, Pion (all open-source, self-hosted)  
✅ **STT:** OpenAI Whisper, Whisper.cpp (MIT license)  
✅ **TTS:** espeak-ng, Festival, Piper (all open-source)  
✅ **Hosting:** NOT free tiers - use Oracle Cloud free tier or cheap VPS (~$5/month)

### What to AVOID:

⚠️ **Coqui STT/TTS** - Company shut down, unmaintained  
⚠️ **Free PaaS tiers** - Not suitable for WebRTC production  
⚠️ **PeerJS** - Only for simple peer-to-peer, not full media server

### Final Recommendation:

For a **completely free voice streaming stack**, you can build:

1. **STT:** Whisper.cpp (free, accurate, efficient)
2. **TTS:** Piper (free, neural quality)
3. **WebRTC:** Mediasoup (free, powerful)
4. **Hosting:** Oracle Cloud free tier or self-hosted

The only cost is **time and infrastructure** - all software is open-source and free.

---

**Sources:**
- https://bloggeek.me/webrtc-open-source-media-servers-github-2024/
- https://meetrix.io/articles/best-open-source-webrtc-media-servers/
- https://github.com/openai/whisper
- https://github.com/ggml-org/whisper.cpp
- https://github.com/coqui-ai/STT
- https://github.com/rhasspy/piper
- Various Reddit and community discussions
