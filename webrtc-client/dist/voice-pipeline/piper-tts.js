"use strict";
/**
 * Piper TTS Service
 * Handles text-to-speech using Piper server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PiperTTSService = void 0;
const events_1 = require("events");
/**
 * Piper TTS Service
 */
class PiperTTSService extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.audioContext = null;
        this.outputSampleRate = 22050;
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
    async initialize() {
        this.audioContext = new AudioContext({
            sampleRate: this.outputSampleRate,
        });
        console.log('[PiperTTS] Initialized with sample rate:', this.outputSampleRate);
    }
    /**
     * Synthesize speech from text
     */
    async synthesize(input) {
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
            const audioBuffer = {
                data: floatData,
                sampleRate: this.outputSampleRate,
                channels: 1,
                timestamp: new Date(),
            };
            return audioBuffer;
        }
        catch (error) {
            console.error('[PiperTTS] Synthesis error:', error);
            return null;
        }
    }
    /**
     * Synthesize and play speech directly
     */
    async speak(input) {
        const audioBuffer = await this.synthesize(input);
        if (!audioBuffer || !this.audioContext) {
            return false;
        }
        try {
            // Create audio buffer for playback
            const buffer = this.audioContext.createBuffer(1, audioBuffer.data.length, audioBuffer.sampleRate);
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
        }
        catch (error) {
            console.error('[PiperTTS] Playback error:', error);
            return false;
        }
    }
    /**
     * Synthesize speech and return as base64-encoded audio
     */
    async synthesizeToBase64(input) {
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
    async getVoices() {
        if (!this.config.ttsConfig?.serverUrl) {
            return [];
        }
        try {
            const response = await fetch(`${this.config.ttsConfig.serverUrl}/voices`);
            if (!response.ok) {
                return [];
            }
            const voices = await response.json();
            return voices || [];
        }
        catch {
            return [];
        }
    }
    /**
     * Check if service is ready
     */
    async healthCheck() {
        if (!this.config.ttsConfig?.serverUrl) {
            return false;
        }
        try {
            const response = await fetch(`${this.config.ttsConfig.serverUrl}/health`);
            return response.ok;
        }
        catch {
            return false;
        }
    }
    /**
     * Get output sample rate
     */
    getSampleRate() {
        return this.outputSampleRate;
    }
    /**
     * Clean up resources
     */
    destroy() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
exports.PiperTTSService = PiperTTSService;
//# sourceMappingURL=piper-tts.js.map