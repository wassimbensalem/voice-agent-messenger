"use strict";
/**
 * Redis Client Service
 * Provides Redis connection and utilities for the signaling server
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRedis = initializeRedis;
exports.getRedisClient = getRedisClient;
exports.getRedisSubscriber = getRedisSubscriber;
exports.getRedisPublisher = getRedisPublisher;
exports.closeRedisConnections = closeRedisConnections;
exports.isRedisHealthy = isRedisHealthy;
exports.getRedisInfo = getRedisInfo;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createChildLogger)('redis-client');
let redisClient = null;
let redisSubscriber = null;
let redisPublisher = null;
/**
 * Create a Redis client with proper configuration
 */
function createRedisClient(options) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = new ioredis_1.default(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: options?.retryStrategy ?? ((times) => {
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
async function initializeRedis() {
    if (redisClient) {
        return {
            client: redisClient,
            subscriber: redisSubscriber,
            publisher: redisPublisher
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
        new Promise((resolve, reject) => {
            redisClient.once('ready', resolve);
            redisClient.once('error', reject);
        }),
        new Promise((resolve, reject) => {
            redisSubscriber.once('ready', resolve);
            redisSubscriber.once('error', reject);
        }),
        new Promise((resolve, reject) => {
            redisPublisher.once('ready', resolve);
            redisPublisher.once('error', reject);
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
function getRedisClient() {
    return redisClient;
}
/**
 * Get Redis subscriber client
 */
function getRedisSubscriber() {
    return redisSubscriber;
}
/**
 * Get Redis publisher client
 */
function getRedisPublisher() {
    return redisPublisher;
}
/**
 * Close all Redis connections
 */
async function closeRedisConnections() {
    const closePromises = [];
    if (redisClient) {
        closePromises.push(redisClient.quit().then(() => { }));
        redisClient = null;
    }
    if (redisSubscriber) {
        closePromises.push(redisSubscriber.quit().then(() => { }));
        redisSubscriber = null;
    }
    if (redisPublisher) {
        closePromises.push(redisPublisher.quit().then(() => { }));
        redisPublisher = null;
    }
    await Promise.all(closePromises);
    logger.info('Redis connections closed');
}
/**
 * Check if Redis is connected and healthy
 */
async function isRedisHealthy() {
    if (!redisClient) {
        return false;
    }
    try {
        const result = await redisClient.ping();
        return result === 'PONG';
    }
    catch (error) {
        return false;
    }
}
/**
 * Get Redis connection info
 */
async function getRedisInfo() {
    if (!redisClient) {
        return null;
    }
    try {
        const info = await redisClient.info('server,memory');
        const lines = info.split('\r\n');
        const result = {};
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
    }
    catch (error) {
        return null;
    }
}
exports.default = {
    initializeRedis,
    getRedisClient,
    getRedisSubscriber,
    getRedisPublisher,
    closeRedisConnections,
    isRedisHealthy,
    getRedisInfo
};
//# sourceMappingURL=redis-client.js.map