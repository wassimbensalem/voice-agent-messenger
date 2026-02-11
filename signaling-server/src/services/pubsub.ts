/**
 * Redis Pub/Sub Service
 * Provides publish/subscribe for multi-instance signaling
 */

import Redis from 'ioredis';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('pubsub');

export interface PubSubMessage<T = any> {
  channel: string;
  data: T;
  senderId: string;
  timestamp: number;
}

export type MessageHandler<T = any> = (message: PubSubMessage<T>) => void;

export interface PubSubChannels {
  ROOM_EVENTS: string;
  SIGNAL_EVENTS: string;
  PRESENCE_EVENTS: string;
  HEALTH_CHECKS: string;
  CUSTOM: (name: string) => string;
}

export const CHANNELS: PubSubChannels = {
  ROOM_EVENTS: 'signaling:room:events',
  SIGNAL_EVENTS: 'signaling:signal:events',
  PRESENCE_EVENTS: 'signaling:presence:events',
  HEALTH_CHECKS: 'signaling:health:checks',
  CUSTOM: (name: string) => `signaling:custom:${name}`
};

export class RedisPubSub {
  private publisher: Redis;
  private subscriber: Redis;
  private subscriptions: Map<string, Set<MessageHandler>>;
  private instanceId: string;
  private isConnected: boolean;

  constructor(
    publisher: Redis,
    subscriber: Redis,
    instanceId?: string
  ) {
    this.publisher = publisher;
    this.subscriber = subscriber;
    this.instanceId = instanceId || `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.subscriptions = new Map();
    this.isConnected = false;

    // Handle incoming messages
    this.subscriber.on('message', (channel: string, message: string) => {
      this.handleMessage(channel, message);
    });

    this.subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
      this.handleMessage(channel, message);
    });
  }

  /**
   * Handle incoming pub/sub message
   */
  private handleMessage(channel: string, rawMessage: string): void {
    try {
      const message: PubSubMessage = JSON.parse(rawMessage);
      
      // Ignore messages from this instance (prevent echo)
      if (message.senderId === this.instanceId) {
        return;
      }

      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            logger.error(`Error in message handler for ${channel}:`, error);
          }
        });
      }
    } catch (error) {
      logger.error('Error parsing pub/sub message:', error);
    }
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(
    channel: string,
    handler: MessageHandler
  ): Promise<void> {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel);
      logger.debug(`Subscribed to channel: ${channel}`);
    }

    this.subscriptions.get(channel)!.add(handler);
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    const handlers = this.subscriptions.get(channel);
    if (!handlers) {
      return;
    }

    if (handler) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(channel);
        await this.subscriber.unsubscribe(channel);
        logger.debug(`Unsubscribed from channel: ${channel}`);
      }
    } else {
      this.subscriptions.delete(channel);
      await this.subscriber.unsubscribe(channel);
      logger.debug(`Unsubscribed from channel: ${channel}`);
    }
  }

  /**
   * Publish a message to a channel
   */
  async publish<T>(channel: string, data: T): Promise<number> {
    const message: PubSubMessage<T> = {
      channel,
      data,
      senderId: this.instanceId,
      timestamp: Date.now()
    };

    const result = await this.publisher.publish(channel, JSON.stringify(message));
    logger.debug(`Published to ${channel}: ${result} subscribers received`);
    return result;
  }

  /**
   * Subscribe to multiple channels with the same handler
   */
  async subscribeMultiple(
    channels: string[],
    handler: MessageHandler
  ): Promise<void> {
    await Promise.all(
      channels.map(channel => this.subscribe(channel, handler))
    );
  }

  /**
   * Unsubscribe from multiple channels
   */
  async unsubscribeMultiple(channels: string[]): Promise<void> {
    await Promise.all(
      channels.map(channel => this.unsubscribe(channel))
    );
  }

  /**
   * Get list of active subscriptions
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get instance ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * Get subscriber count for a channel
   */
  async getSubscriberCount(channel: string): Promise<number> {
    return this.publisher.publish(channel, 'PING');
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected;
  }
}

/**
 * Signaling-specific pub/sub utilities
 */
export class SignalingPubSub {
  private pubsub: RedisPubSub;

  constructor(pubsub: RedisPubSub) {
    this.pubsub = pubsub;
  }

  /**
   * Publish room created event
   */
  async publishRoomCreated(room: { id: string; name: string; createdBy: string }): Promise<void> {
    await this.pubsub.publish(CHANNELS.ROOM_EVENTS, {
      type: 'room:created',
      data: room
    });
  }

  /**
   * Publish room deleted event
   */
  async publishRoomDeleted(roomId: string): Promise<void> {
    await this.pubsub.publish(CHANNELS.ROOM_EVENTS, {
      type: 'room:deleted',
      data: { roomId }
    });
  }

  /**
   * Publish participant joined event
   */
  async publishParticipantJoined(
    roomId: string,
    participant: { id: string; agentId: string; socketId: string }
  ): Promise<void> {
    await this.pubsub.publish(CHANNELS.ROOM_EVENTS, {
      type: 'participant:joined',
      data: { roomId, ...participant }
    });
  }

  /**
   * Publish participant left event
   */
  async publishParticipantLeft(
    roomId: string,
    participantId: string
  ): Promise<void> {
    await this.pubsub.publish(CHANNELS.ROOM_EVENTS, {
      type: 'participant:left',
      data: { roomId, participantId }
    });
  }

  /**
   * Publish WebRTC signal (offer/answer/candidate)
   */
  async publishSignal(
    roomId: string,
    signal: { type: string; from: string; to: string; payload: any }
  ): Promise<void> {
    await this.pubsub.publish(CHANNELS.SIGNAL_EVENTS, {
      type: 'signal',
      data: { roomId, ...signal }
    });
  }

  /**
   * Publish presence update
   */
  async publishPresenceUpdate(
    agentId: string,
    status: string
  ): Promise<void> {
    await this.pubsub.publish(CHANNELS.PRESENCE_EVENTS, {
      type: 'presence:update',
      data: { agentId, status }
    });
  }

  /**
   * Subscribe to room events
   */
  async subscribeToRoomEvents(handler: MessageHandler): Promise<void> {
    await this.pubsub.subscribe(CHANNELS.ROOM_EVENTS, handler);
  }

  /**
   * Subscribe to signal events
   */
  async subscribeToSignalEvents(handler: MessageHandler): Promise<void> {
    await this.pubsub.subscribe(CHANNELS.SIGNAL_EVENTS, handler);
  }

  /**
   * Subscribe to presence events
   */
  async subscribeToPresenceEvents(handler: MessageHandler): Promise<void> {
    await this.pubsub.subscribe(CHANNELS.PRESENCE_EVENTS, handler);
  }
}

/**
 * Create pub/sub instance
 */
export function createPubSub(
  publisher: Redis,
  subscriber: Redis,
  instanceId?: string
): RedisPubSub {
  return new RedisPubSub(publisher, subscriber, instanceId);
}

/**
 * Create signaling-specific pub/sub
 */
export function createSignalingPubSub(pubsub: RedisPubSub): SignalingPubSub {
  return new SignalingPubSub(pubsub);
}

export default {
  RedisPubSub,
  SignalingPubSub,
  CHANNELS,
  createPubSub,
  createSignalingPubSub
};
