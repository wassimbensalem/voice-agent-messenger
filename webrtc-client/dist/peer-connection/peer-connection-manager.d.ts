/**
 * WebRTC Peer Connection Manager
 * Handles WebRTC peer connections for voice/audio communication
 */
import { EventEmitter } from 'events';
import type { WebRTCVoiceClientConfig, SDPMessage, ICECandidateMessage, RoomParticipant } from '../types';
/**
 * Peer connection information
 */
interface PeerInfo {
    peerConnection: RTCPeerConnection;
    agentId: string;
    socketId: string;
    audioEnabled: boolean;
    dataChannel?: RTCDataChannel;
}
/**
 * WebRTC Peer Connection Manager
 */
export declare class PeerConnectionManager extends EventEmitter {
    private config;
    private peers;
    private localStream;
    private audioContext;
    private processor;
    private iceCandidateQueue;
    constructor(config: WebRTCVoiceClientConfig);
    /**
     * Initialize the peer connection manager
     */
    initialize(): Promise<void>;
    /**
     * Set local media stream (microphone input)
     */
    setLocalStream(stream: MediaStream): Promise<void>;
    /**
     * Create a peer connection for a new participant
     */
    createPeerConnection(participant: RoomParticipant): Promise<RTCPeerConnection>;
    /**
     * Create an offer for a peer
     */
    createOffer(socketId: string): Promise<RTCSessionDescriptionInit | null>;
    /**
     * Handle received offer from remote peer
     */
    handleOffer(message: SDPMessage): Promise<RTCSessionDescriptionInit | null>;
    /**
     * Handle received answer from remote peer
     */
    handleAnswer(message: SDPMessage): Promise<void>;
    /**
     * Handle received ICE candidate from remote peer
     */
    handleCandidate(message: ICECandidateMessage): Promise<void>;
    /**
     * Remove a peer connection
     */
    removePeer(socketId: string): void;
    /**
     * Remove all peer connections
     */
    removeAllPeers(): void;
    /**
     * Get audio stream from a specific peer
     */
    getRemoteAudioStream(socketId: string): MediaStream | null;
    /**
     * Get all remote audio streams
     */
    getAllRemoteAudioStreams(): MediaStream[];
    /**
     * Send data to a specific peer
     */
    sendData(socketId: string, data: unknown): boolean;
    /**
     * Broadcast data to all peers
     */
    broadcastData(data: unknown): void;
    /**
     * Set audio enabled/disabled for a peer
     */
    setPeerAudioEnabled(socketId: string, enabled: boolean): void;
    /**
     * Get list of connected peer socket IDs
     */
    getPeerSocketIds(): string[];
    /**
     * Get peer information by socket ID
     */
    getPeerInfo(socketId: string): PeerInfo | undefined;
    /**
     * Get all peer information
     */
    getAllPeers(): PeerInfo[];
    /**
     * Clean up resources
     */
    destroy(): void;
    /**
     * Create an RTC peer connection with configured ICE servers
     */
    private createRTCPeerConnection;
    /**
     * Set up ICE candidate handler
     */
    private setupICECandidateHandler;
    /**
     * Set up track handler for receiving remote media
     */
    private setupTrackHandler;
    /**
     * Set up data channel for peer communication
     */
    private setupDataChannel;
    /**
     * Emit an error event
     */
    private emitError;
}
export {};
//# sourceMappingURL=peer-connection-manager.d.ts.map