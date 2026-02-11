/**
 * Whisper STT Service
 * Handles speech-to-text using Whisper server
 */
import type { WebRTCVoiceClientConfig, TranscriptResult } from '../types';
import { EventEmitter } from 'events';
/**
 * Whisper STT Service
 */
export declare class WhisperSTTService extends EventEmitter {
    private config;
    private isProcessing;
    private audioQueue;
    private sampleRate;
    constructor(config: WebRTCVoiceClientConfig);
    /**
     * Process audio data and get transcription
     */
    transcribe(audioData: Float32Array): Promise<TranscriptResult | null>;
    /**
     * Process streaming audio for real-time transcription
     */
    transcribeStream(audioData: Float32Array, isFinal: boolean): Promise<TranscriptResult | null>;
    /**
     * Internal transcription method
     */
    private transcribeInternal;
    /**
     * Convert Float32Array audio to WAV format
     */
    private audioToWav;
    /**
     * Combine queued audio arrays
     */
    private combineAudio;
    /**
     * Check if service is ready
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get sample rate
     */
    getSampleRate(): number;
    /**
     * Set sample rate
     */
    setSampleRate(rate: number): void;
}
//# sourceMappingURL=whisper-stt.d.ts.map