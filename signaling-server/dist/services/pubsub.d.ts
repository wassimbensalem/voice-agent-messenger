/**
 * Redis Pub/Sub Service
 * Provides publish/subscribe for multi-instance signaling
 */
import Redis from 'ioredis';
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
export declare const CHANNELS: PubSubChannels;
export declare class RedisPubSub {
    private publisher;
    private subscriber;
    private subscriptions;
    private instanceId;
    private isConnected;
    constructor(publisher: Redis, subscriber: Redis, instanceId?: string);
    /**
     * Handle incoming pub/sub message
     */
    private handleMessage;
    /**
     * Subscribe to a channel
     */
    subscribe(channel: string, handler: MessageHandler): Promise<void>;
    /**
     * Unsubscribe from a channel
     */
    unsubscribe(channel: string, handler?: MessageHandler): Promise<void>;
    /**
     * Publish a message to a channel
     */
    publish<T>(channel: string, data: T): Promise<number>;
    /**
     * Subscribe to multiple channels with the same handler
     */
    subscribeMultiple(channels: string[], handler: MessageHandler): Promise<void>;
    /**
     * Unsubscribe from multiple channels
     */
    unsubscribeMultiple(channels: string[]): Promise<void>;
    /**
     * Get list of active subscriptions
     */
    getSubscriptions(): string[];
    /**
     * Get instance ID
     */
    getInstanceId(): string;
    /**
     * Get subscriber count for a channel
     */
    getSubscriberCount(channel: string): Promise<number>;
    /**
     * Check if connected
     */
    isReady(): boolean;
}
/**
 * Signaling-specific pub/sub utilities
 */
export declare class SignalingPubSub {
    private pubsub;
    constructor(pubsub: RedisPubSub);
    /**
     * Publish room created event
     */
    publishRoomCreated(room: {
        id: string;
        name: string;
        createdBy: string;
    }): Promise<void>;
    /**
     * Publish room deleted event
     */
    publishRoomDeleted(roomId: string): Promise<void>;
    /**
     * Publish participant joined event
     */
    publishParticipantJoined(roomId: string, participant: {
        id: string;
        agentId: string;
        socketId: string;
    }): Promise<void>;
    /**
     * Publish participant left event
     */
    publishParticipantLeft(roomId: string, participantId: string): Promise<void>;
    /**
     * Publish WebRTC signal (offer/answer/candidate)
     */
    publishSignal(roomId: string, signal: {
        type: string;
        from: string;
        to: string;
        payload: any;
    }): Promise<void>;
    /**
     * Publish presence update
     */
    publishPresenceUpdate(agentId: string, status: string): Promise<void>;
    /**
     * Subscribe to room events
     */
    subscribeToRoomEvents(handler: MessageHandler): Promise<void>;
    /**
     * Subscribe to signal events
     */
    subscribeToSignalEvents(handler: MessageHandler): Promise<void>;
    /**
     * Subscribe to presence events
     */
    subscribeToPresenceEvents(handler: MessageHandler): Promise<void>;
}
/**
 * Create pub/sub instance
 */
export declare function createPubSub(publisher: Redis, subscriber: Redis, instanceId?: string): RedisPubSub;
/**
 * Create signaling-specific pub/sub
 */
export declare function createSignalingPubSub(pubsub: RedisPubSub): SignalingPubSub;
declare const _default: {
    RedisPubSub: typeof RedisPubSub;
    SignalingPubSub: typeof SignalingPubSub;
    CHANNELS: PubSubChannels;
    createPubSub: typeof createPubSub;
    createSignalingPubSub: typeof createSignalingPubSub;
};
export default _default;
//# sourceMappingURL=pubsub.d.ts.map