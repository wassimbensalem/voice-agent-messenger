/**
 * Signaling Client
 * Handles WebSocket communication with the signaling server using Socket.IO
 */

import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import type {
  WebRTCVoiceClientConfig,
  SignalingEvent,
  SignalingEventType,
  SDPMessage,
  ICECandidateMessage,
  VoiceRoom,
  RoomParticipant,
  ConnectionState,
  ClientError,
} from '../types';

/**
 * Signaling client for WebSocket communication
 */
export class SignalingClient extends EventEmitter {
  private socket: Socket | null = null;
  private config: WebRTCVoiceClientConfig;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private socketId: string | null = null;
  private agentId: string;

  constructor(config: WebRTCVoiceClientConfig) {
    super();
    this.config = config;
    this.agentId = config.agentId;
  }

  /**
   * Connect to the signaling server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setConnectionState('connecting');

      const socketOptions = this.config.socketOptions || {};
      
      this.socket = io(this.config.signalingUrl, {
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

      this.socket.on('connect_error', (error: Error) => {
        console.error('[SignalingClient] Connection error:', error.message);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.setConnectionState('failed');
          const clientError: ClientError = {
            code: 'CONNECTION_FAILED',
            message: `Failed to connect after ${this.maxReconnectAttempts} attempts`,
            originalError: error,
            timestamp: new Date(),
          };
          this.emit('error', clientError);
          reject(error);
        }
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log('[SignalingClient] Disconnected:', reason);
        this.setConnectionState('disconnected');
        this.emit('state_changed', { state: 'disconnected', reason });
      });

      this.socket.on('reconnecting', (attemptNumber: number) => {
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
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.setConnectionState('disconnected');
    }
  }

  /**
   * Join a voice room
   */
  joinRoom(options: { roomId: string; audioEnabled?: boolean; metadata?: Record<string, unknown> }): void {
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
  leaveRoom(reason?: string): void {
    if (!this.socket || !this.isConnected()) {
      return;
    }

    this.socket.emit('leave_room', { reason });
  }

  /**
   * Send an SDP offer
   */
  sendOffer(sdp: RTCSessionDescriptionInit): void {
    if (!this.socket || !this.isConnected()) {
      throw new Error('Not connected to signaling server');
    }

    const message: SDPMessage = {
      from: this.agentId,
      fromSocketId: this.socketId || '',
      sdp,
    };

    this.socket.emit('offer', message);
  }

  /**
   * Send an SDP answer
   */
  sendAnswer(sdp: RTCSessionDescriptionInit, targetSocketId: string): void {
    if (!this.socket || !this.isConnected()) {
      throw new Error('Not connected to signaling server');
    }

    const message: SDPMessage = {
      from: this.agentId,
      fromSocketId: this.socketId || '',
      sdp,
    };

    this.socket.emit('answer', message, targetSocketId);
  }

  /**
   * Send an ICE candidate
   */
  sendCandidate(candidate: RTCIceCandidateInit, targetSocketId?: string): void {
    if (!this.socket || !this.isConnected()) {
      throw new Error('Not connected to signaling server');
    }

    const message: ICECandidateMessage = {
      from: this.agentId,
      fromSocketId: this.socketId || '',
      candidate,
    };

    if (targetSocketId) {
      this.socket.emit('candidate', message, targetSocketId);
    } else {
      this.socket.emit('candidate', message);
    }
  }

  /**
   * Broadcast data to all participants in the room
   */
  broadcastData(data: unknown): void {
    if (!this.socket || !this.isConnected()) {
      throw new Error('Not connected to signaling server');
    }

    this.socket.emit('broadcast', { data, from: this.agentId });
  }

  /**
   * Send data to a specific participant
   */
  sendData(data: unknown, targetSocketId: string): void {
    if (!this.socket || !this.isConnected()) {
      throw new Error('Not connected to signaling server');
    }

    this.socket.emit('data', { data, from: this.agentId }, targetSocketId);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | null {
    return this.socketId;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Set up authentication event handlers
   */
  private setupAuthHandlers(): void {
    if (!this.socket) return;

    this.socket.on('auth_ok', () => {
      console.log('[SignalingClient] Authentication successful');
      this.emit('state_changed', { state: 'authenticated' });
    });

    this.socket.on('auth_error', (error: { message: string }) => {
      console.error('[SignalingClient] Authentication error:', error.message);
      const clientError: ClientError = {
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
  private setupRoomHandlers(): void {
    if (!this.socket) return;

    this.socket.on('room_joined', (data: { room: VoiceRoom }) => {
      console.log('[SignalingClient] Joined room:', data.room.roomId);
      this.emit('room_joined', data.room);
    });

    this.socket.on('room_users', (data: { participants: RoomParticipant[] }) => {
      console.log('[SignalingClient] Room users:', data.participants.length);
      this.emit('room_users', data.participants);
    });

    this.socket.on('user_joined', (data: { participant: RoomParticipant }) => {
      console.log('[SignalingClient] User joined:', data.participant.agentId);
      this.emit('user_joined', data.participant);
    });

    this.socket.on('user_left', (data: { participantId: string; agentId: string }) => {
      console.log('[SignalingClient] User left:', data.agentId);
      this.emit('user_left', data);
    });

    this.socket.on('room_full', () => {
      const error: ClientError = {
        code: 'ROOM_FULL',
        message: 'Room has reached maximum capacity',
        timestamp: new Date(),
      };
      this.emit('error', error);
    });

    this.socket.on('room_not_found', () => {
      const error: ClientError = {
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
  private setupSignalingHandlers(): void {
    if (!this.socket) return;

    this.socket.on('offer', (data: SDPMessage) => {
      console.log('[SignalingClient] Received offer from:', data.from);
      this.emit('offer', data);
    });

    this.socket.on('answer', (data: SDPMessage) => {
      console.log('[SignalingClient] Received answer from:', data.from);
      this.emit('answer', data);
    });

    this.socket.on('candidate', (data: ICECandidateMessage) => {
      console.log('[SignalingClient] Received ICE candidate from:', data.from);
      this.emit('candidate', data);
    });

    this.socket.on('data', (data: { from: string; data: unknown }) => {
      this.emit('data', data);
    });
  }

  /**
   * Update connection state and emit event
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
  }
}
