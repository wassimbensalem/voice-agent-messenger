/**
 * Authentication service for JWT validation via agent-link
 */
import { AuthenticatedSocket, JwtPayload as AppJwtPayload } from '../types';
/**
 * Generate a cryptographically secure JWT secret
 */
export declare function generateSecureSecret(length?: number): string;
/**
 * Check if a JWT secret is secure (not a placeholder and long enough)
 */
export declare function isSecretSecure(secret: string): boolean;
/**
 * Validate JWT secret at startup
 */
export declare function validateJwtSecret(secret: string): {
    valid: boolean;
    message: string;
};
export declare class AuthService {
    private jwtSecret;
    private agentLinkUrl;
    constructor(jwtSecret: string, agentLinkUrl?: string);
    /**
     * Verify JWT token from agent-link
     */
    verifyToken(token: string): Promise<AppJwtPayload | null>;
    /**
     * Extract token from Authorization header
     */
    extractToken(authHeader: string | undefined): string | null;
    /**
     * Generate a room join token (for REST API use)
     */
    generateJoinToken(roomId: string, agentId: string): string;
    /**
     * Generate a refresh token for extending sessions
     */
    generateRefreshToken(agentId: string): string;
    /**
     * Verify a refresh token and generate a new access token
     */
    refreshAccessToken(refreshToken: string): Promise<{
        accessToken: string;
    } | null>;
    /**
     * Authenticate socket connection with token
     */
    authenticateSocket(token: string): Promise<AuthenticatedSocket | null>;
}
export declare const createAuthService: (jwtSecret: string) => AuthService;
//# sourceMappingURL=auth.d.ts.map