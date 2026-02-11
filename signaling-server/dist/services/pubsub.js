"use strict";
/**
 * Redis Pub/Sub Service
 * Provides publish/subscribe for multi-instance signaling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalingPubSub = exports.RedisPubSub = exports.CHANNELS = void 0;
exports.createPubSub = createPubSub;
exports.createSignalingPubSub = createSignalingPubSub;
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createChildLogger)('pubsub');
exports.CHANNELS = {
    ROOM_EVENTS: 'signaling:room:events',
    SIGNAL_EVENTS: 'signaling:signal:events',
    PRESENCE_EVENTS: 'signaling:presence:events',
    HEALTH_CHECKS: 'signaling:health:checks',
    CUSTOM: (name) => `signaling:custom:${name}`
};
class RedisPubSub {
    publisher;
    subscriber;
    subscriptions;
    instanceId;
    isConnected;
    constructor(publisher, subscriber, instanceId) {
        this.publisher = publisher;
        this.subscriber = subscriber;
        this.instanceId = instanceId || `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.subscriptions = new Map();
        this.isConnected = false;
        // Handle incoming messages
        this.subscriber.on('message', (channel, message) => {
            this.handleMessage(channel, message);
        });
        this.subscriber.on('pmessage', (pattern, channel, message) => {
            this.handleMessage(channel, message);
        });
    }
    /**
     * Handle incoming pub/sub message
     */
    handleMessage(channel, rawMessage) {
        try {
            const message = JSON.parse(rawMessage);
            // Ignore messages from this instance (prevent echo)
            if (message.senderId === this.instanceId) {
                return;
            }
            const handlers = this.subscriptions.get(channel);
            if (handlers) {
                handlers.forEach(handler => {
                    try {
                        handler(message);
                    }
                    catch (error) {
                        logger.error(`Error in message handler for ${channel}:`, error);
                    }
                });
            }
        }
        catch (error) {
            logger.error('Error parsing pub/sub message:', error);
        }
    }
    /**
     * Subscribe to a channel
     */
    async subscribe(channel, handler) {
        if (!this.subscriptions.has(channel)) {
            this.subscriptions.set(channel, new Set());
            await this.subscriber.subscribe(channel);
            logger.debug(`Subscribed to channel: ${channel}`);
        }
        this.subscriptions.get(channel).add(handler);
    }
    /**
     * Unsubscribe from a channel
     */
    async unsubscribe(channel, handler) {
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
        }
        else {
            this.subscriptions.delete(channel);
            await this.subscriber.unsubscribe(channel);
            logger.debug(`Unsubscribed from channel: ${channel}`);
        }
    }
    /**
     * Publish a message to a channel
     */
    async publish(channel, data) {
        const message = {
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
    async subscribeMultiple(channels, handler) {
        await Promise.all(channels.map(channel => this.subscribe(channel, handler)));
    }
    /**
     * Unsubscribe from multiple channels
     */
    async unsubscribeMultiple(channels) {
        await Promise.all(channels.map(channel => this.unsubscribe(channel)));
    }
    /**
     * Get list of active subscriptions
     */
    getSubscriptions() {
        return Array.from(this.subscriptions.keys());
    }
    /**
     * Get instance ID
     */
    getInstanceId() {
        return this.instanceId;
    }
    /**
     * Get subscriber count for a channel
     */
    async getSubscriberCount(channel) {
        return this.publisher.publish(channel, 'PING');
    }
    /**
     * Check if connected
     */
    isReady() {
        return this.isConnected;
    }
}
exports.RedisPubSub = RedisPubSub;
/**
 * Signaling-specific pub/sub utilities
 */
class SignalingPubSub {
    pubsub;
    constructor(pubsub) {
        this.pubsub = pubsub;
    }
    /**
     * Publish room created event
     */
    async publishRoomCreated(room) {
        await this.pubsub.publish(exports.CHANNELS.ROOM_EVENTS, {
            type: 'room:created',
            data: room
        });
    }
    /**
     * Publish room deleted event
     */
    async publishRoomDeleted(roomId) {
        await this.pubsub.publish(exports.CHANNELS.ROOM_EVENTS, {
            type: 'room:deleted',
            data: { roomId }
        });
    }
    /**
     * Publish participant joined event
     */
    async publishParticipantJoined(roomId, participant) {
        await this.pubsub.publish(exports.CHANNELS.ROOM_EVENTS, {
            type: 'participant:joined',
            data: { roomId, ...participant }
        });
    }
    /**
     * Publish participant left event
     */
    async publishParticipantLeft(roomId, participantId) {
        await this.pubsub.publish(exports.CHANNELS.ROOM_EVENTS, {
            type: 'participant:left',
            data: { roomId, participantId }
        });
    }
    /**
     * Publish WebRTC signal (offer/answer/candidate)
     */
    async publishSignal(roomId, signal) {
        await this.pubsub.publish(exports.CHANNELS.SIGNAL_EVENTS, {
            type: 'signal',
            data: { roomId, ...signal }
        });
    }
    /**
     * Publish presence update
     */
    async publishPresenceUpdate(agentId, status) {
        await this.pubsub.publish(exports.CHANNELS.PRESENCE_EVENTS, {
            type: 'presence:update',
            data: { agentId, status }
        });
    }
    /**
     * Subscribe to room events
     */
    async subscribeToRoomEvents(handler) {
        await this.pubsub.subscribe(exports.CHANNELS.ROOM_EVENTS, handler);
    }
    /**
     * Subscribe to signal events
     */
    async subscribeToSignalEvents(handler) {
        await this.pubsub.subscribe(exports.CHANNELS.SIGNAL_EVENTS, handler);
    }
    /**
     * Subscribe to presence events
     */
    async subscribeToPresenceEvents(handler) {
        await this.pubsub.subscribe(exports.CHANNELS.PRESENCE_EVENTS, handler);
    }
}
exports.SignalingPubSub = SignalingPubSub;
/**
 * Create pub/sub instance
 */
function createPubSub(publisher, subscriber, instanceId) {
    return new RedisPubSub(publisher, subscriber, instanceId);
}
/**
 * Create signaling-specific pub/sub
 */
function createSignalingPubSub(pubsub) {
    return new SignalingPubSub(pubsub);
}
exports.default = {
    RedisPubSub,
    SignalingPubSub,
    CHANNELS: exports.CHANNELS,
    createPubSub,
    createSignalingPubSub
};
//# sourceMappingURL=pubsub.js.map