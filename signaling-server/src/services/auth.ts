/**
 * Authentication service for JWT validation via agent-link
 */

import jwt, { JwtPayload, SignOptions, TokenExpiredError as JwtTokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { AuthenticatedSocket, JwtPayload as AppJwtPayload } from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('auth-service');

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
export function generateSecureSecret(length: number = 64): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Check if a JWT secret is secure (not a placeholder and long enough)
 */
export function isSecretSecure(secret: string): boolean {
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
export function validateJwtSecret(secret: string): { valid: boolean; message: string } {
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

export class AuthService {
  private jwtSecret: string;
  private agentLinkUrl: string;

  constructor(jwtSecret: string, agentLinkUrl: string = 'http://localhost:3001') {
    this.jwtSecret = jwtSecret;
    this.agentLinkUrl = agentLinkUrl;
  }

  /**
   * Verify JWT token from agent-link
   */
  async verifyToken(token: string): Promise<AppJwtPayload | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as AppJwtPayload;
      
      // Validate required fields
      if (!decoded.agentId) {
        logger.warn('Token missing agentId');
        return null;
      }

      logger.debug(`Token verified for agent: ${decoded.agentId}`);
      return decoded;
    } catch (error: any) {
      if (error instanceof JwtTokenExpiredError) {
        logger.warn('Token has expired');
      } else if (error instanceof JsonWebTokenError) {
        logger.warn(`JWT error: ${error.message}`);
      } else {
        logger.warn(`Token verification failed: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractToken(authHeader: string | undefined): string | null {
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
  generateJoinToken(roomId: string, agentId: string): string {
    const payload = {
      agentId,
      roomId,
      type: 'room_join'
    };

    const options: SignOptions = { expiresIn: TOKEN_EXPIRY };
    return jwt.sign(payload, this.jwtSecret, options);
  }

  /**
   * Generate a refresh token for extending sessions
   */
  generateRefreshToken(agentId: string): string {
    const payload = {
      agentId,
      type: 'refresh'
    };

    const options: SignOptions = { expiresIn: REFRESH_TOKEN_EXPIRY };
    return jwt.sign(payload, this.jwtSecret, options);
  }

  /**
   * Verify a refresh token and generate a new access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string } | null> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as JwtPayload & { type: string };
      
      // Verify this is a refresh token
      if (decoded.type !== 'refresh') {
        logger.warn('Invalid token type for refresh');
        return null;
      }
      
      // Generate new access token
      const accessToken = jwt.sign(
        { agentId: decoded.agentId, type: 'access' },
        this.jwtSecret,
        { expiresIn: TOKEN_EXPIRY }
      );
      
      return { accessToken };
    } catch (error: any) {
      logger.warn(`Refresh token verification failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Authenticate socket connection with token
   */
  async authenticateSocket(
    token: string
  ): Promise<AuthenticatedSocket | null> {
    const payload = await this.verifyToken(token);
    
    if (!payload) {
      return null;
    }

    return {
      agentId: payload.agentId,
      roles: (payload as any).roles || []
    };
  }

  /**
   * Generate an API key for an agent (long-lived JWT)
   */
  generateApiKey(agentId: string): string {
    const payload = {
      agentId,
      type: 'api_key'
    };

    // API keys last 1 year
    const options: SignOptions = { expiresIn: '365d' };
    return jwt.sign(payload, this.jwtSecret, options);
  }
}

export const createAuthService = (jwtSecret: string): AuthService => {
  return new AuthService(jwtSecret);
};
