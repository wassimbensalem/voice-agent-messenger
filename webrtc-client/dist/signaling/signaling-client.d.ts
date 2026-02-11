/**
 * Signaling Client
 * Handles WebSocket communication with the signaling server using Socket.IO
 */
import { EventEmitter } from 'events';
import type { WebRTCVoiceClientConfig, ConnectionState } from '../types';
/**
 * Signaling client for WebSocket communication
 */
export declare class SignalingClient extends EventEmitter {
    private socket;
    private config;
    private connectionState;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private socketId;
    private agentId;
    constructor(config: WebRTCVoiceClientConfig);
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
    joinRoom(options: {
        roomId: string;
        audioEnabled?: boolean;
        metadata?: Record<string, unknown>;
    }): void;
    /**
     * Leave the current room
     */
    leaveRoom(reason?: string): void;
    /**
     * Send an SDP offer
     */
    sendOffer(sdp: RTCSessionDescriptionInit): void;
    /**
     * Send an SDP answer
     */
    sendAnswer(sdp: RTCSessionDescriptionInit, targetSocketId: string): void;
    /**
     * Send an ICE candidate
     */
    sendCandidate(candidate: RTCIceCandidateInit, targetSocketId?: string): void;
    /**
     * Broadcast data to all participants in the room
     */
    broadcastData(data: unknown): void;
    /**
     * Send data to a specific participant
     */
    sendData(data: unknown, targetSocketId: string): void;
    /**
     * Get current connection state
     */
    getConnectionState(): ConnectionState;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Get socket ID
     */
    getSocketId(): string | null;
    /**
     * Get agent ID
     */
    getAgentId(): string;
    /**
     * Set up authentication event handlers
     */
    private setupAuthHandlers;
    /**
     * Set up room event handlers
     */
    private setupRoomHandlers;
    /**
     * Set up signaling event handlers
     */
    private setupSignalingHandlers;
    /**
     * Update connection state and emit event
     */
    private setConnectionState;
}
//# sourceMappingURL=signaling-client.d.ts.map