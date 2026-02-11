/**
 * Redis Client Service
 * Provides Redis connection and utilities for the signaling server
 */
import Redis from 'ioredis';
/**
 * Initialize Redis connection
 */
export declare function initializeRedis(): Promise<{
    client: Redis;
    subscriber: Redis;
    publisher: Redis;
}>;
/**
 * Get the main Redis client
 */
export declare function getRedisClient(): Redis | null;
/**
 * Get Redis subscriber client
 */
export declare function getRedisSubscriber(): Redis | null;
/**
 * Get Redis publisher client
 */
export declare function getRedisPublisher(): Redis | null;
/**
 * Close all Redis connections
 */
export declare function closeRedisConnections(): Promise<void>;
/**
 * Check if Redis is connected and healthy
 */
export declare function isRedisHealthy(): Promise<boolean>;
/**
 * Get Redis connection info
 */
export declare function getRedisInfo(): Promise<{
    connected: boolean;
    version?: string;
    uptime?: number;
    memory?: string;
} | null>;
declare const _default: {
    initializeRedis: typeof initializeRedis;
    getRedisClient: typeof getRedisClient;
    getRedisSubscriber: typeof getRedisSubscriber;
    getRedisPublisher: typeof getRedisPublisher;
    closeRedisConnections: typeof closeRedisConnections;
    isRedisHealthy: typeof isRedisHealthy;
    getRedisInfo: typeof getRedisInfo;
};
export default _default;
//# sourceMappingURL=redis-client.d.ts.map