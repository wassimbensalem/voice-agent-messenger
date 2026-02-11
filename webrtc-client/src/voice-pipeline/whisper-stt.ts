/**
 * Whisper STT Service
 * Handles speech-to-text using Whisper server
 */

import type { WebRTCVoiceClientConfig, TranscriptResult } from '../types';
import { EventEmitter } from 'events';

/**
 * Whisper STT Service
 */
export class WhisperSTTService extends EventEmitter {
  private config: WebRTCVoiceClientConfig;
  private isProcessing = false;
  private audioQueue: Float32Array[] = [];
  private sampleRate = 16000;

  constructor(config: WebRTCVoiceClientConfig) {
    super();
    this.config = config;
    if (config.audioConfig?.sampleRate) {
      this.sampleRate = config.audioConfig.sampleRate;
    }
  }

  /**
   * Process audio data and get transcription
   */
  async transcribe(audioData: Float32Array): Promise<TranscriptResult | null> {
    const serverUrl = this.config.sttConfig?.serverUrl;
    if (!serverUrl) {
      console.warn('[WhisperSTT] Server URL not configured');
      return null;
    }

    try {
      // Convert Float32Array to WAV format
      const wavData = this.audioToWav(audioData);

      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array(wavData)], { type: 'audio/wav' }), 'audio.wav');
      formData.append('response_format', 'json');

      const response = await fetch(`${serverUrl}/inference`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const result: { text?: string; confidence?: number } = await response.json();
      
      const transcript: TranscriptResult = {
        text: result.text || '',
        isPartial: false,
        timestamp: new Date(),
        confidence: result.confidence,
      };

      return transcript;
    } catch (error) {
      console.error('[WhisperSTT] Transcription error:', error);
      return null;
    }
  }

  /**
   * Process streaming audio for real-time transcription
   */
  async transcribeStream(audioData: Float32Array, isFinal: boolean): Promise<TranscriptResult | null> {
    if (!this.config.sttConfig?.serverUrl) {
      return null;
    }

    try {
      // For streaming, we could use partial results if enabled
      if (this.config.sttConfig.enablePartialResults && !isFinal) {
        // Queue audio for partial processing
        this.audioQueue.push(audioData);
        
        // Process accumulated audio for partial results
        const combinedAudio = this.combineAudio(this.audioQueue);
        const result = await this.transcribeInternal(combinedAudio, true);
        
        if (result) {
          this.emit('partial_transcript', result);
        }
        
        return result;
      }

      // Clear queue for final transcription
      if (isFinal) {
        this.audioQueue.push(audioData);
        const combinedAudio = this.combineAudio(this.audioQueue);
        this.audioQueue = [];
        
        const result = await this.transcribeInternal(combinedAudio, false);
        if (result) {
          this.emit('transcript', result);
        }
        return result;
      }

      return null;
    } catch (error) {
      console.error('[WhisperSTT] Streaming transcription error:', error);
      return null;
    }
  }

  /**
   * Internal transcription method
   */
  private async transcribeInternal(audioData: Float32Array, isPartial: boolean): Promise<TranscriptResult | null> {
    const serverUrl = this.config.sttConfig?.serverUrl;
    if (!serverUrl) {
      return null;
    }

    try {
      const wavData = this.audioToWav(audioData);

      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array(wavData)], { type: 'audio/wav' }), 'audio.wav');
      formData.append('response_format', 'json');

      const language = this.config.sttConfig?.language;
      if (language) {
        formData.append('language', language);
      }

      const response = await fetch(`${serverUrl}/inference`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const result: { text?: string; confidence?: number } = await response.json();
      
      return {
        text: result.text || '',
        isPartial,
        timestamp: new Date(),
        confidence: result.confidence,
      };
    } catch (error) {
      console.error('[WhisperSTT] Internal transcription error:', error);
      return null;
    }
  }

  /**
   * Convert Float32Array audio to WAV format
   */
  private audioToWav(audioData: Float32Array): Uint8Array {
    const numChannels = 1;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = this.sampleRate * blockAlign;
    const dataSize = audioData.length * bytesPerSample;
    const bufferSize = 44 + dataSize;

    const buffer = Buffer.alloc(bufferSize);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(bufferSize - 8, 4);
    buffer.write('WAVE', 8);

    // fmt chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(this.sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bytesPerSample * 8, 34); // BitsPerSample

    // data chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Write audio data as 16-bit PCM
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      buffer.writeInt16LE(Math.round(intSample), 44 + i * 2);
    }

    return new Uint8Array(buffer);
  }

  /**
   * Combine queued audio arrays
   */
  private combineAudio(audioArrays: Float32Array[]): Float32Array {
    const totalLength = audioArrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Float32Array(totalLength);
    
    let offset = 0;
    for (const arr of audioArrays) {
      result.set(arr, offset);
      offset += arr.length;
    }

    return result;
  }

  /**
   * Check if service is ready
   */
  async healthCheck(): Promise<boolean> {
    const serverUrl = this.config.sttConfig?.serverUrl;
    if (!serverUrl) {
      return false;
    }

    try {
      const response = await fetch(`${serverUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get sample rate
   */
  getSampleRate(): number {
    return this.sampleRate;
  }

  /**
   * Set sample rate
   */
  setSampleRate(rate: number): void {
    this.sampleRate = rate;
  }
}
