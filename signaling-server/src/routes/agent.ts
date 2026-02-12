/**
 * Agent Management Routes
 */

import { Router, Request, Response } from 'express';
import { AgentService } from '../services/agent-service';
import { AuthService } from '../services/auth';
import { ApiResponse, AgentRegistrationRequest, AgentRegistrationResponse } from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('agent-routes');

export function createAgentRouter(
  agentService: AgentService,
  authService: AuthService
): Router {
  const router = Router();

  /**
   * Authentication Middleware
   */
  const authenticate = async (req: Request, res: Response, next: Function) => {
    const authHeader = req.headers.authorization;
    const token = authService.extractToken(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Header format: Authorization: Bearer <api_key>'
      } as ApiResponse);
      return;
    }

    const payload = await authService.verifyToken(token);
    if (!payload) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired API key'
      } as ApiResponse);
      return;
    }

    (req as any).agentId = payload.agentId;
    next();
  };

  /**
   * POST /api/agents/register - Register a new agent
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { name, emoji, color } = req.body as AgentRegistrationRequest;
      const registrationSecret = req.headers['x-registration-secret'];
      const expectedSecret = process.env.AGENT_REGISTRATION_SECRET;

      // Gate registration with a secret in production
      if (expectedSecret && registrationSecret !== expectedSecret) {
        logger.warn(`Unauthorized registration attempt for agent: ${name}`);
        res.status(403).json({
          success: false,
          error: 'Invalid registration secret. Only authorized OpenClaw agents can register.'
        } as ApiResponse);
        return;
      }

      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Agent name is required'
        } as ApiResponse);
        return;
      }

      const result = await agentService.registerAgent({
        name,
        emoji,
        color
      });

      res.status(201).json({
        success: true,
        data: result
      } as ApiResponse<AgentRegistrationResponse>);
    } catch (error) {
      logger.error('Error registering agent:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register agent'
      } as ApiResponse);
    }
  });

  /**
   * GET /api/agents/me - Get own profile
   */
  router.get('/me', authenticate, async (req: Request, res: Response) => {
    try {
      const agentId = (req as any).agentId;
      const profile = await agentService.getAgent(agentId);

      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Agent profile not found'
        } as ApiResponse);
        return;
      }

      // Update last active
      // fire and forget
      agentService.updateLastActive(agentId).catch(err => 
        logger.error(`Failed to update last active for ${agentId}:`, err)
      );

      res.json({
        success: true,
        data: profile
      } as ApiResponse);
    } catch (error) {
      logger.error('Error fetching agent profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch agent profile'
      } as ApiResponse);
    }
  });

  return router;
}
