/**
 * Redis Session Storage Service
 * Provides session storage with Redis for multi-instance support
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('session-storage');

export interface Session {
  id: string;
  agentId: string;
  socketId: string;
  roomId?: string;
  createdAt: number;
  lastActivity: number;
  metadata?: Record<string, any>;
}

export interface SessionStorageConfig {
  ttl: number; // Session TTL in seconds
  prefix: string;
}

export class RedisSessionStorage {
  private client: Redis;
  private config: SessionStorageConfig;
  private localCache: Map<string, Session>; // Local cache for fast access

  constructor(client: Redis, config?: Partial<SessionStorageConfig>) {
    this.client = client;
    this.config = {
      ttl: config?.ttl || 3600, // 1 hour default
      prefix: config?.prefix || 'session:',
      ...config
    };
    this.localCache = new Map();

    // Start cleanup interval for expired sessions
    this.startCleanup();
  }

  /**
   * Create a new session
   */
  async createSession(
    agentId: string,
    socketId: string,
    metadata?: Record<string, any>
  ): Promise<Session> {
    const session: Session = {
      id: uuidv4(),
      agentId,
      socketId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata
    };

    const key = `${this.config.prefix}${session.id}`;
    const value = JSON.stringify(session);

    await this.client.setex(key, this.config.ttl, value);
    
    // Also create index by agentId
    const agentKey = `${this.config.prefix}agent:${agentId}`;
    await this.client.sadd(agentKey, session.id);
    await this.client.expire(agentKey, this.config.ttl);

    // Also create index by socketId
    const socketKey = `${this.config.prefix}socket:${socketId}`;
    await this.client.set(socketKey, session.id, 'EX', this.config.ttl);

    this.localCache.set(session.id, session);
    logger.debug(`Session created: ${session.id} for agent ${agentId}`);

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    // Check local cache first
    if (this.localCache.has(sessionId)) {
      return this.localCache.get(sessionId)!;
    }

    const key = `${this.config.prefix}${sessionId}`;
    const value = await this.client.get(key);

    if (!value) {
      return null;
    }

    const session = JSON.parse(value) as Session;
    this.localCache.set(sessionId, session);
    return session;
  }

  /**
   * Get session by socket ID
   */
  async getSessionBySocket(socketId: string): Promise<Session | null> {
    const socketKey = `${this.config.prefix}socket:${socketId}`;
    const sessionId = await this.client.get(socketKey);

    if (!sessionId) {
      return null;
    }

    return this.getSession(sessionId);
  }

  /**
   * Get all sessions for an agent
   */
  async getSessionsByAgent(agentId: string): Promise<Session[]> {
    const agentKey = `${this.config.prefix}agent:${agentId}`;
    const sessionIds = await this.client.smembers(agentKey);

    if (!sessionIds || sessionIds.length === 0) {
      return [];
    }

    const sessions: Session[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    session.lastActivity = Date.now();

    const key = `${this.config.prefix}${sessionId}`;
    await this.client.setex(key, this.config.ttl, JSON.stringify(session));

    // Update TTL on agent index
    const agentKey = `${this.config.prefix}agent:${session.agentId}`;
    await this.client.expire(agentKey, this.config.ttl);

    // Update TTL on socket index
    const socketKey = `${this.config.prefix}socket:${session.socketId}`;
    await this.client.expire(socketKey, this.config.ttl);

    this.localCache.set(sessionId, session);
    return true;
  }

  /**
   * Update session room
   */
  async setSessionRoom(sessionId: string, roomId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    session.roomId = roomId;
    session.lastActivity = Date.now();

    const key = `${this.config.prefix}${sessionId}`;
    await this.client.setex(key, this.config.ttl, JSON.stringify(session));

    // Update previous room index if exists
    if (session.roomId) {
      const prevRoomKey = `${this.config.prefix}room:${session.roomId}`;
      await this.client.srem(prevRoomKey, sessionId);
    }

    // Add to new room index
    const newRoomKey = `${this.config.prefix}room:${roomId}`;
    await this.client.sadd(newRoomKey, sessionId);
    await this.client.expire(newRoomKey, this.config.ttl);

    this.localCache.set(sessionId, session);
    return true;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    const key = `${this.config.prefix}${sessionId}`;
    await this.client.del(key);

    // Remove from agent index
    const agentKey = `${this.config.prefix}agent:${session.agentId}`;
    await this.client.srem(agentKey, sessionId);

    // Remove from socket index
    const socketKey = `${this.config.prefix}socket:${session.socketId}`;
    await this.client.del(socketKey);

    // Remove from room index if in a room
    if (session.roomId) {
      const roomKey = `${this.config.prefix}room:${session.roomId}`;
      await this.client.srem(roomKey, sessionId);
    }

    this.localCache.delete(sessionId);
    logger.debug(`Session deleted: ${sessionId}`);

    return true;
  }

  /**
   * Delete session by socket ID
   */
  async deleteSessionBySocket(socketId: string): Promise<boolean> {
    const session = await this.getSessionBySocket(socketId);
    if (!session) {
      return false;
    }

    return this.deleteSession(session.id);
  }

  /**
   * Get all sessions in a room
   */
  async getSessionsByRoom(roomId: string): Promise<Session[]> {
    const roomKey = `${this.config.prefix}room:${roomId}`;
    const sessionIds = await this.client.smembers(roomKey);

    if (!sessionIds || sessionIds.length === 0) {
      return [];
    }

    const sessions: Session[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Get all active sessions
   */
  async getAllSessions(): Promise<Session[]> {
    const pattern = `${this.config.prefix}*`;
    const keys = await this.client.keys(pattern);

    if (!keys || keys.length === 0) {
      return [];
    }

    // Filter out index keys (those containing ':' after prefix)
    const sessionKeys = keys.filter(k => !k.includes(':', this.config.prefix.length));

    const sessions: Session[] = [];
    for (const key of sessionKeys) {
      const value = await this.client.get(key);
      if (value) {
        sessions.push(JSON.parse(value));
      }
    }

    return sessions;
  }

  /**
   * Get session count
   */
  async getSessionCount(): Promise<number> {
    const pattern = `${this.config.prefix}*`;
    const keys = await this.client.keys(pattern);
    
    if (!keys) {
      return 0;
    }

    // Filter out index keys
    const sessionKeys = keys.filter(k => !k.includes(':', this.config.prefix.length));
    return sessionKeys.length;
  }

  /**
   * Cleanup expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const pattern = `${this.config.prefix}*`;
      const keys = await this.client.keys(pattern);

      if (!keys) {
        return;
      }

      const sessionKeys = keys.filter(k => !k.includes(':', this.config.prefix.length));

      for (const key of sessionKeys) {
        const value = await this.client.get(key);
        if (!value) {
          // Session expired, remove from cache
          const sessionId = key.replace(this.config.prefix, '');
          this.localCache.delete(sessionId);
        }
      }
    } catch (error) {
      logger.error('Error during session cleanup:', error);
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Check every minute
  }
}

/**
 * Create session storage instance
 */
export function createSessionStorage(
  client: Redis,
  config?: Partial<SessionStorageConfig>
): RedisSessionStorage {
  return new RedisSessionStorage(client, config);
}

export default RedisSessionStorage;
