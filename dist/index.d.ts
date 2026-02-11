/**
 * WebRTC Signaling Server - Main Entry Point
 *
 * This server provides:
 * - WebSocket-based signaling for WebRTC connections
 * - REST API for room management
 * - JWT authentication via agent-link
 * - Redis support for multi-instance deployment
 */
import http from 'http';
import { ServerConfig } from './types';
import { RedisSessionStorage } from './services/session-storage';
import { EndpointRateLimiters } from './services/rate-limiter';
import { SignalingPubSub } from './services/pubsub';
export declare class SignalingServer {
    private app;
    private server;
    private config;
    private roomManager;
    private authService;
    private signalingService;
    private sessionStorage;
    private rateLimiters;
    private signalingPubSub;
    private useRedis;
    constructor(config?: Partial<ServerConfig>);
    /**
     * Initialize Redis services
     */
    initializeRedis(): Promise<void>;
    /**
     * Check if Redis is being used
     */
    isUsingRedis(): boolean;
    /**
     * Get session storage instance
     */
    getSessionStorage(): RedisSessionStorage | null;
    /**
     * Get rate limiters instance
     */
    getRateLimiters(): EndpointRateLimiters | null;
    /**
     * Get signaling pub/sub instance
     */
    getSignalingPubSub(): SignalingPubSub | null;
    /**
     * Setup REST API routes
     */
    private setupRoutes;
    /**
     * Start the server
     */
    start(): Promise<void>;
    /**
     * Stop the server
     */
    stop(): Promise<void>;
    /**
     * Get the underlying HTTP server
     */
    getServer(): http.Server;
    /**
     * Get room manager instance
     */
    getRoomManager(): any;
    /**
     * Get server statistics
     */
    getStats(): Promise<any>;
}
export default SignalingServer;
//# sourceMappingURL=index.d.ts.map