/**
 * Redis Client Service
 * Provides Redis connection and utilities for the signaling server
 */

import Redis from 'ioredis';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('redis-client');

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;
let redisPublisher: Redis | null = null;

/**
 * Create a Redis client with proper configuration
 */
function createRedisClient(options?: {
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | null;
}): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: options?.retryStrategy ?? ((times: number) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000);
    }),
    enableReadyCheck: true,
    connectTimeout: 10000,
    lazyConnect: false
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('error', (error) => {
    logger.error('Redis client error:', error.message);
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  client.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });

  return client;
}

/**
 * Initialize Redis connection
 */
export async function initializeRedis(): Promise<{
  client: Redis;
  subscriber: Redis;
  publisher: Redis;
}> {
  if (redisClient) {
    return {
      client: redisClient,
      subscriber: redisSubscriber!,
      publisher: redisPublisher!
    };
  }

  logger.info('Initializing Redis connection...');

  // Main client for general operations
  redisClient = createRedisClient({ keyPrefix: 'signaling:' });

  // Separate clients for pub/sub (required by Redis)
  redisSubscriber = createRedisClient({ keyPrefix: 'signaling:' });
  redisPublisher = createRedisClient({ keyPrefix: 'signaling:' });

  // Wait for connection
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      redisClient!.once('ready', resolve);
      redisClient!.once('error', reject);
    }),
    new Promise<void>((resolve, reject) => {
      redisSubscriber!.once('ready', resolve);
      redisSubscriber!.once('error', reject);
    }),
    new Promise<void>((resolve, reject) => {
      redisPublisher!.once('ready', resolve);
      redisPublisher!.once('error', reject);
    })
  ]);

  logger.info('Redis connections established');
  
  return {
    client: redisClient,
    subscriber: redisSubscriber,
    publisher: redisPublisher
  };
}

/**
 * Get the main Redis client
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Get Redis subscriber client
 */
export function getRedisSubscriber(): Redis | null {
  return redisSubscriber;
}

/**
 * Get Redis publisher client
 */
export function getRedisPublisher(): Redis | null {
  return redisPublisher;
}

/**
 * Close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (redisClient) {
    closePromises.push(redisClient.quit().then(() => {}));
    redisClient = null;
  }

  if (redisSubscriber) {
    closePromises.push(redisSubscriber.quit().then(() => {}));
    redisSubscriber = null;
  }

  if (redisPublisher) {
    closePromises.push(redisPublisher.quit().then(() => {}));
    redisPublisher = null;
  }

  await Promise.all(closePromises);
  logger.info('Redis connections closed');
}

/**
 * Check if Redis is connected and healthy
 */
export async function isRedisHealthy(): Promise<boolean> {
  if (!redisClient) {
    return false;
  }

  try {
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch (error) {
    return false;
  }
}

/**
 * Get Redis connection info
 */
export async function getRedisInfo(): Promise<{
  connected: boolean;
  version?: string;
  uptime?: number;
  memory?: string;
} | null> {
  if (!redisClient) {
    return null;
  }

  try {
    const info = await redisClient.info('server,memory');
    const lines = info.split('\r\n');
    const result: Record<string, string> = {};

    lines.forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        result[key] = value;
      }
    });

    return {
      connected: true,
      version: result['redis_version'],
      uptime: parseInt(result['uptime_in_seconds'] || '0', 10),
      memory: result['used_memory_human']
    };
  } catch (error) {
    return null;
  }
}

export default {
  initializeRedis,
  getRedisClient,
  getRedisSubscriber,
  getRedisPublisher,
  closeRedisConnections,
  isRedisHealthy,
  getRedisInfo
};
