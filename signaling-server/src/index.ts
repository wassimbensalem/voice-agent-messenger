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
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import { createRoomManager } from './services/room-manager';
import { createAuthService, validateJwtSecret, generateSecureSecret } from './services/auth';
import { createSignalingService } from './services/signaling';
import { createApiRouter } from './routes/api';
import { createVoiceRouter } from './routes/voice';
import { createAgentRouter } from './routes/agent';
import { createAgentService } from './services/agent-service';
import { ServerConfig } from './types';
import { logger } from './utils/logger';
import { 
  initializeRedis, 
  closeRedisConnections, 
  isRedisHealthy,
  getRedisClient,
  getRedisSubscriber,
  getRedisPublisher 
} from './services/redis-client';
import { createSessionStorage, RedisSessionStorage } from './services/session-storage';
import { createEndpointRateLimiters, EndpointRateLimiters } from './services/rate-limiter';
import { createSignalingPubSub, createPubSub, SignalingPubSub } from './services/pubsub';

// Default configuration
const defaultConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '8080', 10),
  redisUrl: process.env.REDIS_URL || undefined,
  jwtSecret: process.env.JWT_SECRET || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
  roomTimeout: parseInt(process.env.ROOM_TIMEOUT || '300000', 10),
  maxParticipants: parseInt(process.env.MAX_PARTICIPANTS || '10', 10)
};

/**
 * Validate configuration at startup
 */
function validateConfig(config: ServerConfig): void {
  // Validate JWT secret
  const secretValidation = validateJwtSecret(config.jwtSecret);
  if (!secretValidation.valid) {
    logger.error(`JWT Secret Validation Failed: ${secretValidation.message}`);
    logger.error('Please set a secure JWT_SECRET in your .env file.');
    logger.info('To generate a secure secret, run:');
    logger.info(`  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")`);
    process.exit(1);
  }
  logger.info('JWT Secret validation: OK');
  
  // Validate other config values
  if (config.port < 1 || config.port > 65535) {
    logger.error(`Invalid port: ${config.port}. Must be between 1 and 65535`);
    process.exit(1);
  }
  
  if (config.maxParticipants < 1 || config.maxParticipants > 100) {
    logger.warn(`Max participants set to ${config.maxParticipants}. Consider a lower value for performance.`);
  }
  
  logger.info('Configuration validation: OK');
}

export class SignalingServer {
  private app: express.Application;
  private server: http.Server;
  private config: ServerConfig;
  private roomManager: any;
  private authService: any;
  private agentService: any;
  private signalingService: any;
  private sessionStorage: RedisSessionStorage | null;
  private rateLimiters: EndpointRateLimiters | null;
  private signalingPubSub: SignalingPubSub | null;
  private useRedis: boolean;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.sessionStorage = null;
    this.rateLimiters = null;
    this.signalingPubSub = null;
    this.useRedis = false;

    // Validate configuration before proceeding
    validateConfig(this.config);

    // Initialize Express app
    this.app = express();

    // Middleware
    this.app.use(helmet());
    this.app.use(cors({ origin: this.config.corsOrigin }));
    this.app.use(express.json());

    // Initialize services
    this.roomManager = createRoomManager(this.config.roomTimeout, this.config.maxParticipants);
    this.authService = createAuthService(this.config.jwtSecret);
    this.agentService = createAgentService(this.authService);

    // Create HTTP server
    this.server = http.createServer(this.app);

    // Initialize signaling service
    this.signalingService = createSignalingService(
      this.server,
      this.roomManager,
      this.authService,
      this.config.corsOrigin,
      this.config.heartbeatInterval
    );

    // Setup routes
    this.setupRoutes();
  }

  /**
   * Initialize Redis services
   */
  async initializeRedis(): Promise<void> {
    try {
      const redis = await initializeRedis();
      
      // Initialize session storage
      this.sessionStorage = createSessionStorage(redis.client, {
        ttl: 3600, // 1 hour
        prefix: 'session:'
      });
      logger.info('Redis session storage initialized');

      // Initialize rate limiters
      this.rateLimiters = createEndpointRateLimiters(redis.client);
      logger.info('Redis rate limiters initialized');

      // Initialize pub/sub
      const pubsub = createSignalingPubSub(
        createPubSub(redis.publisher, redis.subscriber)
      );
      this.signalingPubSub = pubsub;
      logger.info('Redis pub/sub initialized');

      this.useRedis = true;
      logger.info('Redis services initialized successfully');
    } catch (error) {
      logger.warn('Failed to initialize Redis services, falling back to memory-only mode:', error);
      this.useRedis = false;
    }
  }

  /**
   * Check if Redis is being used
   */
  isUsingRedis(): boolean {
    return this.useRedis;
  }

  /**
   * Get session storage instance
   */
  getSessionStorage(): RedisSessionStorage | null {
    return this.sessionStorage;
  }

  /**
   * Get rate limiters instance
   */
  getRateLimiters(): EndpointRateLimiters | null {
    return this.rateLimiters;
  }

  /**
   * Get signaling pub/sub instance
   */
  getSignalingPubSub(): SignalingPubSub | null {
    return this.signalingPubSub;
  }

  /**
   * Setup REST API routes
   */
  private setupRoutes(): void {
    const apiRouter = createApiRouter(this.roomManager, this.authService);
    const voiceRouter = createVoiceRouter(this.roomManager, this.authService);
    const agentRouter = createAgentRouter(this.agentService, this.authService);
    
    this.app.use('/api', apiRouter);
    this.app.use('/api/voice', voiceRouter);
    this.app.use('/api/agents', agentRouter);

    // Redis health endpoint
    this.app.get('/api/redis-health', async (req, res) => {
      if (!this.useRedis) {
        return res.json({
          status: 'not_available',
          message: 'Redis is not configured or not available'
        });
      }

      const healthy = await isRedisHealthy();
      res.json({
        status: healthy ? 'healthy' : 'unhealthy',
        redis: healthy
      });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'WebRTC Signaling Server',
        version: '1.0.0',
        status: 'running',
        redis: this.useRedis,
        endpoints: {
          health: '/api/health',
          rooms: '/api/rooms',
          voiceRooms: '/api/voice/rooms',
          stats: '/api/stats',
          redisHealth: '/api/redis-health'
        }
      });
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Try to initialize Redis
        this.initializeRedis().catch(err => {
          logger.warn('Redis initialization deferred:', err.message);
        });

        this.server.listen(this.config.port, () => {
          logger.info(`WebRTC Signaling Server started on port ${this.config.port}`);
          logger.info(`Redis support: ${this.useRedis ? 'enabled' : 'disabled'}`);
          logger.info(`REST API: http://localhost:${this.config.port}/api`);
          logger.info(`WebSocket: ws://localhost:${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Close Redis connections first
        if (this.useRedis) {
          closeRedisConnections().catch(err => {
            logger.error('Error closing Redis connections:', err);
          });
        }

        this.signalingService.close();
        this.server.close(() => {
          logger.info('Server stopped');
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get the underlying HTTP server
   */
  getServer(): http.Server {
    return this.server;
  }

  /**
   * Get room manager instance
   */
  getRoomManager(): any {
    return this.roomManager;
  }

  /**
   * Get server statistics
   */
  async getStats(): Promise<any> {
    const stats: any = {
      rooms: this.roomManager.getStats(),
      connectedClients: this.signalingService.getConnectedCount(),
      uptime: process.uptime(),
      redis: this.useRedis
    };

    if (this.useRedis && this.sessionStorage) {
      stats.sessions = {
        count: await this.sessionStorage.getSessionCount()
      };
    }

    return stats;
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new SignalingServer();
  
  server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    try {
      await server.stop();
      await closeRedisConnections();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default SignalingServer;
