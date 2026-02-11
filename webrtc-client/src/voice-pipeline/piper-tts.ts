/**
 * Piper TTS Service
 * Handles text-to-speech using Piper server
 */

import type { WebRTCVoiceClientConfig, TTSInput, AudioBuffer } from '../types';
import { EventEmitter } from 'events';

/**
 * Piper TTS Service
 */
export class PiperTTSService extends EventEmitter {
  private config: WebRTCVoiceClientConfig;
  private audioContext: AudioContext | null = null;
  private outputSampleRate = 22050;

  constructor(config: WebRTCVoiceClientConfig) {
    super();
    this.config = config;
    
    if (config.audioConfig?.sampleRate) {
      this.outputSampleRate = config.audioConfig.sampleRate;
    }
    
    if (config.ttsConfig?.outputSampleRate) {
      this.outputSampleRate = config.ttsConfig.outputSampleRate;
    }
  }

  /**
   * Initialize the TTS service
   */
  async initialize(): Promise<void> {
    this.audioContext = new AudioContext({
      sampleRate: this.outputSampleRate,
    });
    
    console.log('[PiperTTS] Initialized with sample rate:', this.outputSampleRate);
  }

  /**
   * Synthesize speech from text
   */
  async synthesize(input: TTSInput): Promise<AudioBuffer | null> {
    if (!this.config.ttsConfig?.serverUrl) {
      console.warn('[PiperTTS] Server URL not configured');
      return null;
    }

    try {
      const response = await fetch(`${this.config.ttsConfig.serverUrl}/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: input.text,
          voice: input.voiceId || this.config.ttsConfig.voice,
          rate: input.rate || 1.0,
          pitch: input.pitch || 1.0,
          output_sample_rate: this.outputSampleRate,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS synthesis failed: ${response.statusText}`);
      }

      const audioData = await response.arrayBuffer();
      
      // Convert to Float32Array
      const floatData = new Float32Array(audioData.byteLength / 4);
      const view = new DataView(audioData);
      
      for (let i = 0; i < floatData.length; i++) {
        floatData[i] = view.getFloat32(i * 4, true);
      }

      const audioBuffer: AudioBuffer = {
        data: floatData,
        sampleRate: this.outputSampleRate,
        channels: 1,
        timestamp: new Date(),
      };

      return audioBuffer;
    } catch (error) {
      console.error('[PiperTTS] Synthesis error:', error);
      return null;
    }
  }

  /**
   * Synthesize and play speech directly
   */
  async speak(input: TTSInput): Promise<boolean> {
    const audioBuffer = await this.synthesize(input);
    
    if (!audioBuffer || !this.audioContext) {
      return false;
    }

    try {
      // Create audio buffer for playback
      const buffer = this.audioContext.createBuffer(
        1,
        audioBuffer.data.length,
        audioBuffer.sampleRate
      );

      const channelData = buffer.getChannelData(0);
      channelData.set(audioBuffer.data);

      // Create source and play
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        this.emit('speech_end', { text: input.text });
      };

      this.emit('speech_start', { text: input.text });
      source.start(0);

      return true;
    } catch (error) {
      console.error('[PiperTTS] Playback error:', error);
      return false;
    }
  }

  /**
   * Synthesize speech and return as base64-encoded audio
   */
  async synthesizeToBase64(input: TTSInput): Promise<string | null> {
    const audioBuffer = await this.synthesize(input);
    
    if (!audioBuffer) {
      return null;
    }

    // Convert Float32Array to 16-bit PCM
    const pcmData = new Int16Array(audioBuffer.data.length);
    for (let i = 0; i < audioBuffer.data.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.data[i]));
      pcmData[i] = Math.round(sample * 32767);
    }

    return Buffer.from(pcmData.buffer).toString('base64');
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<{ id: string; name: string; language: string }[]> {
    if (!this.config.ttsConfig?.serverUrl) {
      return [];
    }

    try {
      const response = await fetch(`${this.config.ttsConfig.serverUrl}/voices`);
      if (!response.ok) {
        return [];
      }
      const voices = await response.json() as { id: string; name: string; language: string }[];
      return voices || [];
    } catch {
      return [];
    }
  }

  /**
   * Check if service is ready
   */
  async healthCheck(): Promise<boolean> {
    if (!this.config.ttsConfig?.serverUrl) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.ttsConfig.serverUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get output sample rate
   */
  getSampleRate(): number {
    return this.outputSampleRate;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
