/**
 * Redis Rate Limiting Service
 * Provides sliding window rate limiting for API requests
 */
import Redis from 'ioredis';
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    prefix: string;
}
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    limit: number;
}
/**
 * Redis-based sliding window rate limiter
 */
export declare class RedisRateLimiter {
    private client;
    private defaultConfig;
    constructor(client: Redis, defaultConfig?: Partial<RateLimitConfig>);
    /**
     * Get rate limit key for an identifier
     */
    private getKey;
    /**
     * Get current window timestamp
     */
    private getWindow;
    /**
     * Check and update rate limit for an identifier
     */
    checkRateLimit(identifier: string, config?: Partial<RateLimitConfig>): Promise<RateLimitResult>;
    /**
     * Middleware-style rate limit check
     */
    middleware(identifier: string, config?: Partial<RateLimitConfig>): Promise<{
        success: boolean;
        remaining: number;
        resetTime: number;
    }>;
    /**
     * Get rate limit status without incrementing
     */
    getRateLimitStatus(identifier: string): Promise<RateLimitResult | null>;
    /**
     * Reset rate limit for an identifier
     */
    resetRateLimit(identifier: string): Promise<boolean>;
    /**
     * Get usage statistics for an identifier
     */
    getUsageStats(identifier: string): Promise<{
        requests: number;
        limit: number;
        windowMs: number;
        windowStart: number;
    } | null>;
}
/**
 * Pre-configured rate limiters for different endpoints
 */
export declare class EndpointRateLimiters {
    private client;
    private limiters;
    constructor(client: Redis);
    /**
     * Get a rate limiter for a specific endpoint type
     */
    getLimiter(type: string): RedisRateLimiter;
    /**
     * Check rate limit for an endpoint
     */
    checkEndpoint(type: string, identifier: string): Promise<RateLimitResult>;
}
/**
 * Create rate limiter instance
 */
export declare function createRateLimiter(client: Redis, config?: Partial<RateLimitConfig>): RedisRateLimiter;
/**
 * Create endpoint rate limiters
 */
export declare function createEndpointRateLimiters(client: Redis): EndpointRateLimiters;
declare const _default: {
    RedisRateLimiter: typeof RedisRateLimiter;
    EndpointRateLimiters: typeof EndpointRateLimiters;
    createRateLimiter: typeof createRateLimiter;
    createEndpointRateLimiters: typeof createEndpointRateLimiters;
};
export default _default;
//# sourceMappingURL=rate-limiter.d.ts.map