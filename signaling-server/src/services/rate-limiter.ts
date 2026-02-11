/**
 * Redis Rate Limiting Service
 * Provides sliding window rate limiting for API requests
 */

import Redis from 'ioredis';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('rate-limiter');

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
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
export class RedisRateLimiter {
  private client: Redis;
  private defaultConfig: RateLimitConfig;

  constructor(client: Redis, defaultConfig?: Partial<RateLimitConfig>) {
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
  private getKey(identifier: string): string {
    return `${this.defaultConfig.prefix}${identifier}`;
  }

  /**
   * Get current window timestamp
   */
  private getWindow(): number {
    return Math.floor(Date.now() / this.defaultConfig.windowMs);
  }

  /**
   * Check and update rate limit for an identifier
   */
  async checkRateLimit(
    identifier: string,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
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
  async middleware(
    identifier: string,
    config?: Partial<RateLimitConfig>
  ): Promise<{ success: boolean; remaining: number; resetTime: number }> {
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
  async getRateLimitStatus(identifier: string): Promise<RateLimitResult | null> {
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
  async resetRateLimit(identifier: string): Promise<boolean> {
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
  async getUsageStats(identifier: string): Promise<{
    requests: number;
    limit: number;
    windowMs: number;
    windowStart: number;
  } | null> {
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

/**
 * Pre-configured rate limiters for different endpoints
 */
export class EndpointRateLimiters {
  private client: Redis;
  private limiters: Map<string, RedisRateLimiter>;

  constructor(client: Redis) {
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
  getLimiter(type: string): RedisRateLimiter {
    return this.limiters.get(type) || this.limiters.get('default')!;
  }

  /**
   * Check rate limit for an endpoint
   */
  async checkEndpoint(
    type: string,
    identifier: string
  ): Promise<RateLimitResult> {
    const limiter = this.getLimiter(type);
    return limiter.checkRateLimit(identifier);
  }
}

/**
 * Create rate limiter instance
 */
export function createRateLimiter(
  client: Redis,
  config?: Partial<RateLimitConfig>
): RedisRateLimiter {
  return new RedisRateLimiter(client, config);
}

/**
 * Create endpoint rate limiters
 */
export function createEndpointRateLimiters(client: Redis): EndpointRateLimiters {
  return new EndpointRateLimiters(client);
}

export default {
  RedisRateLimiter,
  EndpointRateLimiters,
  createRateLimiter,
  createEndpointRateLimiters
};
