/**
 * Agent Service
 * Handles agent registration, profile management, and authentication
 */

import { v4 as uuidv4 } from 'uuid';
import { AuthService } from './auth';
import { getRedisClient } from './redis-client';
import { AgentProfile, AgentRegistrationRequest, AgentRegistrationResponse } from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('agent-service');

export class AgentService {
  private authService: AuthService;
  private memoryAgents: Map<string, AgentProfile>;

  constructor(authService: AuthService) {
    this.authService = authService;
    this.memoryAgents = new Map();
  }

  /**
   * Register a new agent
   */
  async registerAgent(request: AgentRegistrationRequest): Promise<AgentRegistrationResponse> {
    const agentId = `agent_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    const now = new Date();

    const profile: AgentProfile = {
      id: agentId,
      name: request.name.trim(),
      emoji: request.emoji || '🤖', // Default robot emoji
      color: request.color || this.generateRandomColor(),
      registeredAt: now,
      lastActiveAt: now
    };

    // Save profile
    await this.saveAgentProfile(profile);

    // Generate API key
    const apiKey = this.authService.generateApiKey(agentId);

    logger.info(`Registered new agent: ${profile.name} (${agentId})`);

    return {
      agentId,
      apiKey,
      profile
    };
  }

  /**
   * Get agent profile by ID
   */
  async getAgent(agentId: string): Promise<AgentProfile | null> {
    const redis = getRedisClient();

    // Try Redis first
    if (redis) {
      try {
        const data = await redis.get(`agent:profile:${agentId}`);
        if (data) {
          return JSON.parse(data, this.dateReviver);
        }
      } catch (error) {
        logger.error(`Error fetching agent ${agentId} from Redis:`, error);
      }
    }

    // Fallback to memory
    return this.memoryAgents.get(agentId) || null;
  }

  /**
   * Update agent's last active timestamp
   */
  async updateLastActive(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (agent) {
      agent.lastActiveAt = new Date();
      await this.saveAgentProfile(agent);
    }
  }

  /**
   * Save agent profile to storage
   */
  private async saveAgentProfile(profile: AgentProfile): Promise<void> {
    const redis = getRedisClient();

    // Save to memory (always, as cache/fallback)
    this.memoryAgents.set(profile.id, profile);

    // Save to Redis if available
    if (redis) {
      try {
        const key = `agent:profile:${profile.id}`;
        await redis.set(key, JSON.stringify(profile));
        
        // Add to global set of agents
        await redis.sadd('agents:all', profile.id);
      } catch (error) {
        logger.error(`Error saving agent ${profile.id} to Redis:`, error);
      }
    }
  }

  /**
   * Generate a random nice color
   */
  private generateRandomColor(): string {
    const colors = [
      '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#33FFF5', 
      '#F5FF33', '#FF8C33', '#8C33FF', '#33FF8C', '#FF3333'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * JSON parse reviver to restore Date objects
   */
  private dateReviver(key: string, value: any): any {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value);
    }
    return value;
  }
}

export function createAgentService(authService: AuthService): AgentService {
  return new AgentService(authService);
}
