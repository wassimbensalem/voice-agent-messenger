/**
 * Redis Session Storage Service
 * Provides session storage with Redis for multi-instance support
 */
import Redis from 'ioredis';
export interface Session {
    id: string;
    agentId: string;
    socketId: string;
    roomId?: string;
    createdAt: number;
    lastActivity: number;
    metadata?: Record<string, any>;
}
export interface SessionStorageConfig {
    ttl: number;
    prefix: string;
}
export declare class RedisSessionStorage {
    private client;
    private config;
    private localCache;
    constructor(client: Redis, config?: Partial<SessionStorageConfig>);
    /**
     * Create a new session
     */
    createSession(agentId: string, socketId: string, metadata?: Record<string, any>): Promise<Session>;
    /**
     * Get session by ID
     */
    getSession(sessionId: string): Promise<Session | null>;
    /**
     * Get session by socket ID
     */
    getSessionBySocket(socketId: string): Promise<Session | null>;
    /**
     * Get all sessions for an agent
     */
    getSessionsByAgent(agentId: string): Promise<Session[]>;
    /**
     * Update session activity
     */
    updateSessionActivity(sessionId: string): Promise<boolean>;
    /**
     * Update session room
     */
    setSessionRoom(sessionId: string, roomId: string): Promise<boolean>;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string): Promise<boolean>;
    /**
     * Delete session by socket ID
     */
    deleteSessionBySocket(socketId: string): Promise<boolean>;
    /**
     * Get all sessions in a room
     */
    getSessionsByRoom(roomId: string): Promise<Session[]>;
    /**
     * Get all active sessions
     */
    getAllSessions(): Promise<Session[]>;
    /**
     * Get session count
     */
    getSessionCount(): Promise<number>;
    /**
     * Cleanup expired sessions
     */
    private cleanupExpiredSessions;
    /**
     * Start periodic cleanup
     */
    private startCleanup;
}
/**
 * Create session storage instance
 */
export declare function createSessionStorage(client: Redis, config?: Partial<SessionStorageConfig>): RedisSessionStorage;
export default RedisSessionStorage;
//# sourceMappingURL=session-storage.d.ts.map