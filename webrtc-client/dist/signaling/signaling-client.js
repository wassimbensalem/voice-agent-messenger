"use strict";
/**
 * Signaling Client
 * Handles WebSocket communication with the signaling server using Socket.IO
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalingClient = void 0;
const socket_io_client_1 = require("socket.io-client");
const events_1 = require("events");
/**
 * Signaling client for WebSocket communication
 */
class SignalingClient extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.socket = null;
        this.connectionState = 'disconnected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.socketId = null;
        this.config = config;
        this.agentId = config.agentId;
    }
    /**
     * Connect to the signaling server
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.setConnectionState('connecting');
            const socketOptions = this.config.socketOptions || {};
            this.socket = (0, socket_io_client_1.io)(this.config.signalingUrl, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: socketOptions.reconnectionAttempts || this.maxReconnectAttempts,
                reconnectionDelay: socketOptions.reconnectionDelay || 1000,
                timeout: socketOptions.timeout || 10000,
                auth: {
                    token: this.config.agentLinkToken,
                    agentId: this.agentId,
                },
            });
            this.socket.on('connect', () => {
                console.log('[SignalingClient] Connected to signaling server');
                this.socketId = this.socket?.id || null;
                this.reconnectAttempts = 0;
                this.setConnectionState('connected');
                // Emit connected event
                this.emit('state_changed', {
                    state: 'connected',
                    socketId: this.socketId
                });
                resolve();
            });
            this.socket.on('connect_error', (error) => {
                console.error('[SignalingClient] Connection error:', error.message);
                this.reconnectAttempts++;
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    this.setConnectionState('failed');
                    const clientError = {
                        code: 'CONNECTION_FAILED',
                        message: `Failed to connect after ${this.maxReconnectAttempts} attempts`,
                        originalError: error,
                        timestamp: new Date(),
                    };
                    this.emit('error', clientError);
                    reject(error);
                }
            });
            this.socket.on('disconnect', (reason) => {
                console.log('[SignalingClient] Disconnected:', reason);
                this.setConnectionState('disconnected');
                this.emit('state_changed', { state: 'disconnected', reason });
            });
            this.socket.on('reconnecting', (attemptNumber) => {
                console.log('[SignalingClient] Reconnecting, attempt:', attemptNumber);
                this.setConnectionState('reconnecting');
            });
            this.socket.on('reconnect', () => {
                console.log('[SignalingClient] Reconnected');
                this.setConnectionState('connected');
                this.emit('state_changed', { state: 'connected' });
            });
            // Authentication events
            this.setupAuthHandlers();
            // Room events
            this.setupRoomHandlers();
            // Signaling events
            this.setupSignalingHandlers();
        });
    }
    /**
     * Disconnect from the signaling server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.setConnectionState('disconnected');
        }
    }
    /**
     * Join a voice room
     */
    joinRoom(options) {
        if (!this.socket || !this.isConnected()) {
            throw new Error('Not connected to signaling server');
        }
        this.socket.emit('join_room', {
            roomId: options.roomId,
            agentId: this.agentId,
            audioEnabled: options.audioEnabled ?? true,
            metadata: options.metadata,
        });
    }
    /**
     * Leave the current room
     */
    leaveRoom(reason) {
        if (!this.socket || !this.isConnected()) {
            return;
        }
        this.socket.emit('leave_room', { reason });
    }
    /**
     * Send an SDP offer
     */
    sendOffer(sdp) {
        if (!this.socket || !this.isConnected()) {
            throw new Error('Not connected to signaling server');
        }
        const message = {
            from: this.agentId,
            fromSocketId: this.socketId || '',
            sdp,
        };
        this.socket.emit('offer', message);
    }
    /**
     * Send an SDP answer
     */
    sendAnswer(sdp, targetSocketId) {
        if (!this.socket || !this.isConnected()) {
            throw new Error('Not connected to signaling server');
        }
        const message = {
            from: this.agentId,
            fromSocketId: this.socketId || '',
            sdp,
        };
        this.socket.emit('answer', message, targetSocketId);
    }
    /**
     * Send an ICE candidate
     */
    sendCandidate(candidate, targetSocketId) {
        if (!this.socket || !this.isConnected()) {
            throw new Error('Not connected to signaling server');
        }
        const message = {
            from: this.agentId,
            fromSocketId: this.socketId || '',
            candidate,
        };
        if (targetSocketId) {
            this.socket.emit('candidate', message, targetSocketId);
        }
        else {
            this.socket.emit('candidate', message);
        }
    }
    /**
     * Broadcast data to all participants in the room
     */
    broadcastData(data) {
        if (!this.socket || !this.isConnected()) {
            throw new Error('Not connected to signaling server');
        }
        this.socket.emit('broadcast', { data, from: this.agentId });
    }
    /**
     * Send data to a specific participant
     */
    sendData(data, targetSocketId) {
        if (!this.socket || !this.isConnected()) {
            throw new Error('Not connected to signaling server');
        }
        this.socket.emit('data', { data, from: this.agentId }, targetSocketId);
    }
    /**
     * Get current connection state
     */
    getConnectionState() {
        return this.connectionState;
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.socket?.connected ?? false;
    }
    /**
     * Get socket ID
     */
    getSocketId() {
        return this.socketId;
    }
    /**
     * Get agent ID
     */
    getAgentId() {
        return this.agentId;
    }
    /**
     * Set up authentication event handlers
     */
    setupAuthHandlers() {
        if (!this.socket)
            return;
        this.socket.on('auth_ok', () => {
            console.log('[SignalingClient] Authentication successful');
            this.emit('state_changed', { state: 'authenticated' });
        });
        this.socket.on('auth_error', (error) => {
            console.error('[SignalingClient] Authentication error:', error.message);
            const clientError = {
                code: 'AUTH_FAILED',
                message: error.message,
                timestamp: new Date(),
            };
            this.emit('error', clientError);
        });
    }
    /**
     * Set up room event handlers
     */
    setupRoomHandlers() {
        if (!this.socket)
            return;
        this.socket.on('room_joined', (data) => {
            console.log('[SignalingClient] Joined room:', data.room.roomId);
            this.emit('room_joined', data.room);
        });
        this.socket.on('room_users', (data) => {
            console.log('[SignalingClient] Room users:', data.participants.length);
            this.emit('room_users', data.participants);
        });
        this.socket.on('user_joined', (data) => {
            console.log('[SignalingClient] User joined:', data.participant.agentId);
            this.emit('user_joined', data.participant);
        });
        this.socket.on('user_left', (data) => {
            console.log('[SignalingClient] User left:', data.agentId);
            this.emit('user_left', data);
        });
        this.socket.on('room_full', () => {
            const error = {
                code: 'ROOM_FULL',
                message: 'Room has reached maximum capacity',
                timestamp: new Date(),
            };
            this.emit('error', error);
        });
        this.socket.on('room_not_found', () => {
            const error = {
                code: 'ROOM_NOT_FOUND',
                message: 'Room does not exist',
                timestamp: new Date(),
            };
            this.emit('error', error);
        });
    }
    /**
     * Set up signaling event handlers
     */
    setupSignalingHandlers() {
        if (!this.socket)
            return;
        this.socket.on('offer', (data) => {
            console.log('[SignalingClient] Received offer from:', data.from);
            this.emit('offer', data);
        });
        this.socket.on('answer', (data) => {
            console.log('[SignalingClient] Received answer from:', data.from);
            this.emit('answer', data);
        });
        this.socket.on('candidate', (data) => {
            console.log('[SignalingClient] Received ICE candidate from:', data.from);
            this.emit('candidate', data);
        });
        this.socket.on('data', (data) => {
            this.emit('data', data);
        });
    }
    /**
     * Update connection state and emit event
     */
    setConnectionState(state) {
        this.connectionState = state;
    }
}
exports.SignalingClient = SignalingClient;
//# sourceMappingURL=signaling-client.js.map