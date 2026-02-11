"use strict";
/**
 * Redis Rate Limiting Service
 * Provides sliding window rate limiting for API requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndpointRateLimiters = exports.RedisRateLimiter = void 0;
exports.createRateLimiter = createRateLimiter;
exports.createEndpointRateLimiters = createEndpointRateLimiters;
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createChildLogger)('rate-limiter');
/**
 * Redis-based sliding window rate limiter
 */
class RedisRateLimiter {
    client;
    defaultConfig;
    constructor(client, defaultConfig) {
        this.client = client;
        this.defaultConfig = {
            windowMs: defaultConfig?.windowMs || 60000, // 1 minute
            maxRequests: defaultConfig?.maxRequests || 100,
            prefix: defaultConfig?.prefix || 'ratelimit:',
            ...defaultConfig
        };
    }
    /**
     * Get rate limit key for an identifier
     */
    getKey(identifier) {
        return `${this.defaultConfig.prefix}${identifier}`;
    }
    /**
     * Get current window timestamp
     */
    getWindow() {
        return Math.floor(Date.now() / this.defaultConfig.windowMs);
    }
    /**
     * Check and update rate limit for an identifier
     */
    async checkRateLimit(identifier, config) {
        const limit = config?.maxRequests || this.defaultConfig.maxRequests;
        const windowMs = config?.windowMs || this.defaultConfig.windowMs;
        const windowSize = Math.floor(windowMs / 1000); // in seconds for TTL
        const prefix = config?.prefix || this.defaultConfig.prefix;
        const key = `${prefix}${identifier}:${this.getWindow()}`;
        const current = await this.client.incr(key);
        let ttl = await this.client.ttl(key);
        if (ttl === -1) {
            await this.client.expire(key, windowSize);
            ttl = windowSize;
        }
        const remaining = Math.max(0, limit - current);
        const resetTime = (this.getWindow() + 1) * windowMs;
        return {
            allowed: current <= limit,
            remaining,
            resetTime,
            limit
        };
    }
    /**
     * Middleware-style rate limit check
     */
    async middleware(identifier, config) {
        const result = await this.checkRateLimit(identifier, config);
        return {
            success: result.allowed,
            remaining: result.remaining,
            resetTime: result.resetTime
        };
    }
    /**
     * Get rate limit status without incrementing
     */
    async getRateLimitStatus(identifier) {
        const key = `${this.defaultConfig.prefix}${identifier}:${this.getWindow()}`;
        const current = await this.client.get(key);
        if (!current) {
            return {
                allowed: true,
                remaining: this.defaultConfig.maxRequests,
                resetTime: (this.getWindow() + 1) * this.defaultConfig.windowMs,
                limit: this.defaultConfig.maxRequests
            };
        }
        const currentCount = parseInt(current, 10);
        const remaining = Math.max(0, this.defaultConfig.maxRequests - currentCount);
        const ttl = await this.client.ttl(key);
        const resetTime = Date.now() + (ttl * 1000);
        return {
            allowed: currentCount <= this.defaultConfig.maxRequests,
            remaining,
            resetTime,
            limit: this.defaultConfig.maxRequests
        };
    }
    /**
     * Reset rate limit for an identifier
     */
    async resetRateLimit(identifier) {
        const pattern = `${this.defaultConfig.prefix}${identifier}:*`;
        const keys = await this.client.keys(pattern);
        if (keys && keys.length > 0) {
            await this.client.del(...keys);
            logger.debug(`Rate limit reset for ${identifier}`);
            return true;
        }
        return false;
    }
    /**
     * Get usage statistics for an identifier
     */
    async getUsageStats(identifier) {
        const current = await this.client.get(`${this.defaultConfig.prefix}${identifier}:${this.getWindow()}`);
        if (!current) {
            return null;
        }
        return {
            requests: parseInt(current, 10),
            limit: this.defaultConfig.maxRequests,
            windowMs: this.defaultConfig.windowMs,
            windowStart: this.getWindow() * this.defaultConfig.windowMs
        };
    }
}
exports.RedisRateLimiter = RedisRateLimiter;
/**
 * Pre-configured rate limiters for different endpoints
 */
class EndpointRateLimiters {
    client;
    limiters;
    constructor(client) {
        this.client = client;
        this.limiters = new Map();
        // Configure common endpoints
        this.limiters.set('default', new RedisRateLimiter(client, {
            windowMs: 60000,
            maxRequests: 100
        }));
        this.limiters.set('auth', new RedisRateLimiter(client, {
            windowMs: 300000, // 5 minutes
            maxRequests: 10
        }));
        this.limiters.set('room:create', new RedisRateLimiter(client, {
            windowMs: 60000,
            maxRequests: 5
        }));
        this.limiters.set('room:join', new RedisRateLimiter(client, {
            windowMs: 10000, // 10 seconds
            maxRequests: 20
        }));
        this.limiters.set('voice:stream', new RedisRateLimiter(client, {
            windowMs: 1000, // 1 second
            maxRequests: 50
        }));
        this.limiters.set('api:health', new RedisRateLimiter(client, {
            windowMs: 10000,
            maxRequests: 30
        }));
    }
    /**
     * Get a rate limiter for a specific endpoint type
     */
    getLimiter(type) {
        return this.limiters.get(type) || this.limiters.get('default');
    }
    /**
     * Check rate limit for an endpoint
     */
    async checkEndpoint(type, identifier) {
        const limiter = this.getLimiter(type);
        return limiter.checkRateLimit(identifier);
    }
}
exports.EndpointRateLimiters = EndpointRateLimiters;
/**
 * Create rate limiter instance
 */
function createRateLimiter(client, config) {
    return new RedisRateLimiter(client, config);
}
/**
 * Create endpoint rate limiters
 */
function createEndpointRateLimiters(client) {
    return new EndpointRateLimiters(client);
}
exports.default = {
    RedisRateLimiter,
    EndpointRateLimiters,
    createRateLimiter,
    createEndpointRateLimiters
};
//# sourceMappingURL=rate-limiter.js.map