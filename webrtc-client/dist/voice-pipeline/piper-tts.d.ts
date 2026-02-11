/**
 * Piper TTS Service
 * Handles text-to-speech using Piper server
 */
import type { WebRTCVoiceClientConfig, TTSInput, AudioBuffer } from '../types';
import { EventEmitter } from 'events';
/**
 * Piper TTS Service
 */
export declare class PiperTTSService extends EventEmitter {
    private config;
    private audioContext;
    private outputSampleRate;
    constructor(config: WebRTCVoiceClientConfig);
    /**
     * Initialize the TTS service
     */
    initialize(): Promise<void>;
    /**
     * Synthesize speech from text
     */
    synthesize(input: TTSInput): Promise<AudioBuffer | null>;
    /**
     * Synthesize and play speech directly
     */
    speak(input: TTSInput): Promise<boolean>;
    /**
     * Synthesize speech and return as base64-encoded audio
     */
    synthesizeToBase64(input: TTSInput): Promise<string | null>;
    /**
     * Get available voices
     */
    getVoices(): Promise<{
        id: string;
        name: string;
        language: string;
    }[]>;
    /**
     * Check if service is ready
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get output sample rate
     */
    getSampleRate(): number;
    /**
     * Clean up resources
     */
    destroy(): void;
}
//# sourceMappingURL=piper-tts.d.ts.map