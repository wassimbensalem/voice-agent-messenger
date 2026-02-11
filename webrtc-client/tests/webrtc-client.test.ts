/**
 * WebRTC Voice Client Tests
 */

import { WebRTCVoiceClient } from '../src/index';
import { SignalingClient } from '../src/signaling/signaling-client';
import { PeerConnectionManager } from '../src/peer-connection/peer-connection-manager';
import { WhisperSTTService } from '../src/voice-pipeline/whisper-stt';
import { PiperTTSService } from '../src/voice-pipeline/piper-tts';

// Mock WebRTC globals for Node.js environment
const mockMediaDevices = {
  getUserMedia: jest.fn(),
};

const mockNavigator = {
  mediaDevices: mockMediaDevices,
};

describe('WebRTC Voice Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should create client with valid config', () => {
      const config = {
        signalingUrl: 'ws://localhost:3000',
        agentId: 'agent-test',
      };

      const client = new WebRTCVoiceClient(config);
      expect(client).toBeDefined();
    });

    it('should include audio config', () => {
      const config = {
        signalingUrl: 'ws://localhost:3000',
        agentId: 'agent-test',
        audioConfig: {
          sampleRate: 48000,
          channels: 1,
          echoCancellation: true,
        },
      };

      const client = new WebRTCVoiceClient(config);
      expect(client).toBeDefined();
    });
  });

  describe('SignalingClient', () => {
    it('should create signaling client', () => {
      const config = {
        signalingUrl: 'ws://localhost:3000',
        agentId: 'agent-test',
      };

      const client = new SignalingClient(config);
      expect(client).toBeDefined();
    });

    it('should return connection state', () => {
      const config = {
        signalingUrl: 'ws://localhost:3000',
        agentId: 'agent-test',
      };

      const client = new SignalingClient(config);
      expect(client.getConnectionState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('PeerConnectionManager', () => {
    it('should create peer connection manager', () => {
      const config = {
        signalingUrl: 'ws://localhost:3000',
        agentId: 'agent-test',
      };

      const manager = new PeerConnectionManager(config);
      expect(manager).toBeDefined();
    });
  });

  describe('WhisperSTTService', () => {
    it('should create STT service', () => {
      const config = {
        signalingUrl: 'ws://localhost:3000',
        agentId: 'agent-test',
        sttConfig: {
          serverUrl: 'http://localhost:8001',
        },
      };

      const service = new WhisperSTTService(config);
      expect(service).toBeDefined();
      expect(service.getSampleRate()).toBe(16000);
    });
  });

  describe('PiperTTSService', () => {
    it('should create TTS service', () => {
      const config = {
        signalingUrl: 'ws://localhost:3000',
        agentId: 'agent-test',
        ttsConfig: {
          serverUrl: 'http://localhost:5000',
        },
      };

      const service = new PiperTTSService(config);
      expect(service).toBeDefined();
      expect(service.getSampleRate()).toBe(22050);
    });
  });
});
