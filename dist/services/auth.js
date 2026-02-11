"use strict";
/**
 * Authentication service for JWT validation via agent-link
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthService = exports.AuthService = void 0;
exports.generateSecureSecret = generateSecureSecret;
exports.isSecretSecure = isSecretSecure;
exports.validateJwtSecret = validateJwtSecret;
const jsonwebtoken_1 = __importStar(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createChildLogger)('auth-service');
// Placeholder secret that should NEVER be used in production
const PLACEHOLDER_SECRET = 'your-super-secret-jwt-key-change-in-production';
// Minimum secret length for security
const MIN_SECRET_LENGTH = 32;
// Token expiry times in seconds
const TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
/**
 * Generate a cryptographically secure JWT secret
 */
function generateSecureSecret(length = 64) {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
}
/**
 * Check if a JWT secret is secure (not a placeholder and long enough)
 */
function isSecretSecure(secret) {
    if (secret === PLACEHOLDER_SECRET) {
        return false;
    }
    if (secret.length < MIN_SECRET_LENGTH) {
        return false;
    }
    return true;
}
/**
 * Validate JWT secret at startup
 */
function validateJwtSecret(secret) {
    if (!secret) {
        return { valid: false, message: 'JWT_SECRET environment variable is not set' };
    }
    if (secret === PLACEHOLDER_SECRET) {
        return {
            valid: false,
            message: 'JWT_SECRET is using the placeholder value. Generate a secure secret using: node scripts/generate-secret.js'
        };
    }
    if (secret.length < MIN_SECRET_LENGTH) {
        return {
            valid: false,
            message: `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long`
        };
    }
    // Check for common weak patterns
    const weakPatterns = [
        'password', 'secret', '123456', 'qwerty', 'admin', 'development', 'test'
    ];
    const lowerSecret = secret.toLowerCase();
    for (const pattern of weakPatterns) {
        if (lowerSecret.includes(pattern)) {
            return {
                valid: false,
                message: `JWT_SECRET contains a weak pattern: "${pattern}"`
            };
        }
    }
    return { valid: true, message: 'JWT_SECRET is properly configured' };
}
class AuthService {
    jwtSecret;
    agentLinkUrl;
    constructor(jwtSecret, agentLinkUrl = 'http://localhost:3001') {
        this.jwtSecret = jwtSecret;
        this.agentLinkUrl = agentLinkUrl;
    }
    /**
     * Verify JWT token from agent-link
     */
    async verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            // Validate required fields
            if (!decoded.agentId) {
                logger.warn('Token missing agentId');
                return null;
            }
            logger.debug(`Token verified for agent: ${decoded.agentId}`);
            return decoded;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.TokenExpiredError) {
                logger.warn('Token has expired');
            }
            else if (error instanceof jsonwebtoken_1.JsonWebTokenError) {
                logger.warn(`JWT error: ${error.message}`);
            }
            else {
                logger.warn(`Token verification failed: ${error.message}`);
            }
            return null;
        }
    }
    /**
     * Extract token from Authorization header
     */
    extractToken(authHeader) {
        if (!authHeader) {
            return null;
        }
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return null;
        }
        return parts[1];
    }
    /**
     * Generate a room join token (for REST API use)
     */
    generateJoinToken(roomId, agentId) {
        const payload = {
            agentId,
            roomId,
            type: 'room_join'
        };
        const options = { expiresIn: TOKEN_EXPIRY };
        return jsonwebtoken_1.default.sign(payload, this.jwtSecret, options);
    }
    /**
     * Generate a refresh token for extending sessions
     */
    generateRefreshToken(agentId) {
        const payload = {
            agentId,
            type: 'refresh'
        };
        const options = { expiresIn: REFRESH_TOKEN_EXPIRY };
        return jsonwebtoken_1.default.sign(payload, this.jwtSecret, options);
    }
    /**
     * Verify a refresh token and generate a new access token
     */
    async refreshAccessToken(refreshToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, this.jwtSecret);
            // Verify this is a refresh token
            if (decoded.type !== 'refresh') {
                logger.warn('Invalid token type for refresh');
                return null;
            }
            // Generate new access token
            const accessToken = jsonwebtoken_1.default.sign({ agentId: decoded.agentId, type: 'access' }, this.jwtSecret, { expiresIn: TOKEN_EXPIRY });
            return { accessToken };
        }
        catch (error) {
            logger.warn(`Refresh token verification failed: ${error.message}`);
            return null;
        }
    }
    /**
     * Authenticate socket connection with token
     */
    async authenticateSocket(token) {
        const payload = await this.verifyToken(token);
        if (!payload) {
            return null;
        }
        return {
            agentId: payload.agentId,
            roles: payload.roles || []
        };
    }
}
exports.AuthService = AuthService;
const createAuthService = (jwtSecret) => {
    return new AuthService(jwtSecret);
};
exports.createAuthService = createAuthService;
//# sourceMappingURL=auth.js.map