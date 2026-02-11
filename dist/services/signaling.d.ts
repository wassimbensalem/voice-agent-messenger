/**
 * Signaling service for WebRTC offer/answer/ICE exchange
 */
import { Server as HttpServer } from 'http';
import { RoomManager } from './room-manager';
import { AuthService } from './auth';
export interface SignalingEvents {
    'signal:offer': (data: {
        roomId: string;
        from: string;
        to: string;
        sdp: any;
    }) => void;
    'signal:answer': (data: {
        roomId: string;
        from: string;
        to: string;
        sdp: any;
    }) => void;
    'signal:candidate': (data: {
        roomId: string;
        from: string;
        to: string;
        candidate: any;
    }) => void;
    'participant:joined': (roomId: string, participantId: string, agentId: string) => void;
    'participant:left': (roomId: string, participantId: string, agentId: string) => void;
}
export declare class SignalingService {
    private io;
    private roomManager;
    private authService;
    private heartbeatInterval;
    constructor(httpServer: HttpServer, roomManager: RoomManager, authService: AuthService, corsOrigin?: string, heartbeatInterval?: number);
    /**
     * Setup connection middleware
     */
    private setupMiddleware;
    /**
     * Setup socket event handlers
     */
    private setupEventHandlers;
    /**
     * Handle room join
     */
    private handleJoinRoom;
    /**
     * Handle room leave
     */
    private handleLeaveRoom;
    /**
     * Handle offer message
     */
    private handleOffer;
    /**
     * Handle answer message
     */
    private handleAnswer;
    /**
     * Handle ICE candidate
     */
    private handleCandidate;
    /**
     * Handle end of ICE candidates
     */
    private handleCandidateEnd;
    /**
     * Handle disconnect
     */
    private handleDisconnect;
    /**
     * Broadcast message to room (excluding sender)
     */
    broadcastToRoom(roomId: string, event: string, data: any, excludeSocketId?: string): void;
    /**
     * Send message to specific socket
     */
    sendToSocket(socketId: string, event: string, data: any): void;
    /**
     * Get connected socket count
     */
    getConnectedCount(): number;
    /**
     * Get room participant count
     */
    getRoomParticipantCount(roomId: string): number;
    /**
     * Close the signaling service
     */
    close(): void;
}
export declare const createSignalingService: (httpServer: HttpServer, roomManager: RoomManager, authService: AuthService, corsOrigin?: string, heartbeatInterval?: number) => SignalingService;
//# sourceMappingURL=signaling.d.ts.map