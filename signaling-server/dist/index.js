"use strict";
/**
 * WebRTC Signaling Server - Main Entry Point
 *
 * This server provides:
 * - WebSocket-based signaling for WebRTC connections
 * - REST API for room management
 * - JWT authentication via agent-link
 * - Redis support for multi-instance deployment
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalingServer = void 0;
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from .env file
dotenv_1.default.config();
const room_manager_1 = require("./services/room-manager");
const auth_1 = require("./services/auth");
const signaling_1 = require("./services/signaling");
const api_1 = require("./routes/api");
const voice_1 = require("./routes/voice");
const logger_1 = require("./utils/logger");
const redis_client_1 = require("./services/redis-client");
const session_storage_1 = require("./services/session-storage");
const rate_limiter_1 = require("./services/rate-limiter");
const pubsub_1 = require("./services/pubsub");
// Default configuration
const defaultConfig = {
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
function validateConfig(config) {
    // Validate JWT secret
    const secretValidation = (0, auth_1.validateJwtSecret)(config.jwtSecret);
    if (!secretValidation.valid) {
        logger_1.logger.error(`JWT Secret Validation Failed: ${secretValidation.message}`);
        logger_1.logger.error('Please set a secure JWT_SECRET in your .env file.');
        logger_1.logger.info('To generate a secure secret, run:');
        logger_1.logger.info(`  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")`);
        process.exit(1);
    }
    logger_1.logger.info('JWT Secret validation: OK');
    // Validate other config values
    if (config.port < 1 || config.port > 65535) {
        logger_1.logger.error(`Invalid port: ${config.port}. Must be between 1 and 65535`);
        process.exit(1);
    }
    if (config.maxParticipants < 1 || config.maxParticipants > 100) {
        logger_1.logger.warn(`Max participants set to ${config.maxParticipants}. Consider a lower value for performance.`);
    }
    logger_1.logger.info('Configuration validation: OK');
}
class SignalingServer {
    app;
    server;
    config;
    roomManager;
    authService;
    signalingService;
    sessionStorage;
    rateLimiters;
    signalingPubSub;
    useRedis;
    constructor(config = {}) {
        this.config = { ...defaultConfig, ...config };
        this.sessionStorage = null;
        this.rateLimiters = null;
        this.signalingPubSub = null;
        this.useRedis = false;
        // Validate configuration before proceeding
        validateConfig(this.config);
        // Initialize Express app
        this.app = (0, express_1.default)();
        // Middleware
        this.app.use((0, helmet_1.default)());
        this.app.use((0, cors_1.default)({ origin: this.config.corsOrigin }));
        this.app.use(express_1.default.json());
        // Initialize services
        this.roomManager = (0, room_manager_1.createRoomManager)(this.config.roomTimeout, this.config.maxParticipants);
        this.authService = (0, auth_1.createAuthService)(this.config.jwtSecret);
        // Create HTTP server
        this.server = http_1.default.createServer(this.app);
        // Initialize signaling service
        this.signalingService = (0, signaling_1.createSignalingService)(this.server, this.roomManager, this.authService, this.config.corsOrigin, this.config.heartbeatInterval);
        // Setup routes
        this.setupRoutes();
    }
    /**
     * Initialize Redis services
     */
    async initializeRedis() {
        try {
            const redis = await (0, redis_client_1.initializeRedis)();
            // Initialize session storage
            this.sessionStorage = (0, session_storage_1.createSessionStorage)(redis.client, {
                ttl: 3600, // 1 hour
                prefix: 'session:'
            });
            logger_1.logger.info('Redis session storage initialized');
            // Initialize rate limiters
            this.rateLimiters = (0, rate_limiter_1.createEndpointRateLimiters)(redis.client);
            logger_1.logger.info('Redis rate limiters initialized');
            // Initialize pub/sub
            const pubsub = (0, pubsub_1.createSignalingPubSub)((0, pubsub_1.createPubSub)(redis.publisher, redis.subscriber));
            this.signalingPubSub = pubsub;
            logger_1.logger.info('Redis pub/sub initialized');
            this.useRedis = true;
            logger_1.logger.info('Redis services initialized successfully');
        }
        catch (error) {
            logger_1.logger.warn('Failed to initialize Redis services, falling back to memory-only mode:', error);
            this.useRedis = false;
        }
    }
    /**
     * Check if Redis is being used
     */
    isUsingRedis() {
        return this.useRedis;
    }
    /**
     * Get session storage instance
     */
    getSessionStorage() {
        return this.sessionStorage;
    }
    /**
     * Get rate limiters instance
     */
    getRateLimiters() {
        return this.rateLimiters;
    }
    /**
     * Get signaling pub/sub instance
     */
    getSignalingPubSub() {
        return this.signalingPubSub;
    }
    /**
     * Setup REST API routes
     */
    setupRoutes() {
        const apiRouter = (0, api_1.createApiRouter)(this.roomManager, this.authService);
        const voiceRouter = (0, voice_1.createVoiceRouter)(this.roomManager, this.authService);
        this.app.use('/api', apiRouter);
        this.app.use('/api/voice', voiceRouter);
        // Redis health endpoint
        this.app.get('/api/redis-health', async (req, res) => {
            if (!this.useRedis) {
                return res.json({
                    status: 'not_available',
                    message: 'Redis is not configured or not available'
                });
            }
            const healthy = await (0, redis_client_1.isRedisHealthy)();
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
    async start() {
        return new Promise((resolve, reject) => {
            try {
                // Try to initialize Redis
                this.initializeRedis().catch(err => {
                    logger_1.logger.warn('Redis initialization deferred:', err.message);
                });
                this.server.listen(this.config.port, () => {
                    logger_1.logger.info(`WebRTC Signaling Server started on port ${this.config.port}`);
                    logger_1.logger.info(`Redis support: ${this.useRedis ? 'enabled' : 'disabled'}`);
                    logger_1.logger.info(`REST API: http://localhost:${this.config.port}/api`);
                    logger_1.logger.info(`WebSocket: ws://localhost:${this.config.port}`);
                    resolve();
                });
                this.server.on('error', (error) => {
                    logger_1.logger.error('Server error:', error);
                    reject(error);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Stop the server
     */
    async stop() {
        return new Promise((resolve, reject) => {
            try {
                // Close Redis connections first
                if (this.useRedis) {
                    (0, redis_client_1.closeRedisConnections)().catch(err => {
                        logger_1.logger.error('Error closing Redis connections:', err);
                    });
                }
                this.signalingService.close();
                this.server.close(() => {
                    logger_1.logger.info('Server stopped');
                    resolve();
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Get the underlying HTTP server
     */
    getServer() {
        return this.server;
    }
    /**
     * Get room manager instance
     */
    getRoomManager() {
        return this.roomManager;
    }
    /**
     * Get server statistics
     */
    async getStats() {
        const stats = {
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
exports.SignalingServer = SignalingServer;
// Start server if run directly
if (require.main === module) {
    const server = new SignalingServer();
    server.start().catch((error) => {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    });
    // Handle graceful shutdown
    const shutdown = async () => {
        logger_1.logger.info('Shutting down gracefully...');
        try {
            await server.stop();
            await (0, redis_client_1.closeRedisConnections)();
            process.exit(0);
        }
        catch (error) {
            logger_1.logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
exports.default = SignalingServer;
//# sourceMappingURL=index.js.map