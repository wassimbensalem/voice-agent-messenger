/**
 * WebRTC Voice Client
 * Main client class for voice communication using WebRTC and signaling server
 */
import { EventEmitter } from 'events';
import type { WebRTCVoiceClientConfig, VoiceRoom, TranscriptResult, TTSInput, ConnectionState, JoinRoomOptions, LeaveRoomOptions, ClientEventType, EventCallback } from './types';
/**
 * Main WebRTC Voice Client
 */
export declare class WebRTCVoiceClient extends EventEmitter {
    private config;
    private signaling;
    private peerManager;
    private sttService;
    private ttsService;
    private localStream;
    private currentRoom;
    private isInitialized;
    private isAudioEnabled;
    constructor(config: WebRTCVoiceClientConfig);
    /**
     * Initialize the client
     */
    initialize(): Promise<void>;
    /**
     * Connect to the signaling server
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the signaling server
     */
    disconnect(): void;
    /**
     * Join a voice room
     */
    joinRoom(options: JoinRoomOptions): Promise<VoiceRoom | null>;
    /**
     * Leave the current room
     */
    leaveRoom(options?: LeaveRoomOptions): void;
    /**
     * Start sending audio to peers
     */
    enableAudio(): Promise<void>;
    /**
     * Stop sending audio to peers
     */
    disableAudio(): Promise<void>;
    /**
     * Transcribe audio from the local microphone
     */
    transcribeAudio(audioData: Float32Array, isFinal?: boolean): Promise<TranscriptResult | null>;
    /**
     * Synthesize and speak text
     */
    speak(text: string, options?: Partial<TTSInput>): Promise<boolean>;
    /**
     * Get the current room
     */
    getCurrentRoom(): VoiceRoom | null;
    /**
     * Get the current connection state
     */
    getConnectionState(): ConnectionState;
    /**
     * Get local audio stream
     */
    getLocalStream(): MediaStream | null;
    /**
     * Get the agent ID
     */
    getAgentId(): string;
    /**
     * Subscribe to events
     */
    on<Event extends ClientEventType>(event: Event, callback: EventCallback): this;
    /**
     * Subscribe to events once
     */
    once<Event extends ClientEventType>(event: Event, callback: EventCallback): this;
    /**
     * Unsubscribe from events
     */
    off<Event extends ClientEventType>(event: Event, callback?: EventCallback): this;
    /**
     * Set up local media stream
     */
    private setupLocalStream;
    /**
     * Stop local media stream
     */
    private stopLocalStream;
    /**
     * Set up signaling event handlers
     */
    private setupSignalingHandlers;
    /**
     * Set up peer connection event handlers
     */
    private setupPeerHandlers;
    /**
     * Handle new user joining
     */
    private handleUserJoined;
    /**
     * Handle incoming offer
     */
    private handleOffer;
    /**
     * Handle incoming answer
     */
    private handleAnswer;
    /**
     * Handle incoming ICE candidate
     */
    private handleCandidate;
}
//# sourceMappingURL=index.d.ts.map