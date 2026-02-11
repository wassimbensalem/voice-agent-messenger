/**
 * Signaling service for WebRTC offer/answer/ICE exchange
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createChildLogger } from '../utils/logger';
import { RoomManager } from './room-manager';
import { AuthService } from './auth';
import {
  SignalingMessage,
  SignalingMessageType,
  OfferPayload,
  AnswerPayload,
  CandidatePayload
} from '../types';

const logger = createChildLogger('signaling-service');

export interface SignalingEvents {
  'signal:offer': (data: { roomId: string; from: string; to: string; sdp: any }) => void;
  'signal:answer': (data: { roomId: string; from: string; to: string; sdp: any }) => void;
  'signal:candidate': (data: { roomId: string; from: string; to: string; candidate: any }) => void;
  'participant:joined': (roomId: string, participantId: string, agentId: string) => void;
  'participant:left': (roomId: string, participantId: string, agentId: string) => void;
}

export class SignalingService {
  private io: Server;
  private roomManager: RoomManager;
  private authService: AuthService;
  private heartbeatInterval: number;

  constructor(
    httpServer: HttpServer,
    roomManager: RoomManager,
    authService: AuthService,
    corsOrigin: string = '*',
    heartbeatInterval: number = 30000
  ) {
    this.io = new Server(httpServer, {
      cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST']
      },
      pingInterval: heartbeatInterval,
      pingTimeout: 10000
    });

    this.roomManager = roomManager;
    this.authService = authService;
    this.heartbeatInterval = heartbeatInterval;

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Setup connection middleware
   */
  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        logger.warn(`Socket ${socket.id}: No authentication token provided`);
        return next(new Error('Authentication required'));
      }

      const authenticated = await this.authService.authenticateSocket(token as string);
      
      if (!authenticated) {
        logger.warn(`Socket ${socket.id}: Invalid authentication token`);
        return next(new Error('Invalid authentication token'));
      }

      // Attach authenticated user to socket
      (socket as any).agentId = authenticated.agentId;
      (socket as any).authenticated = true;

      logger.debug(`Socket ${socket.id}: Authenticated as ${authenticated.agentId}`);
      next();
    });
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      const agentId = (socket as any).agentId;
      logger.info(`Socket connected: ${socket.id} (${agentId})`);

      // Handle room join
      socket.on('join_room', (data: { roomId: string }) => {
        this.handleJoinRoom(socket, data.roomId);
      });

      // Handle room leave
      socket.on('leave_room', () => {
        this.handleLeaveRoom(socket);
      });

      // Handle WebRTC signaling
      socket.on('offer', (data: OfferPayload) => {
        this.handleOffer(socket, data);
      });

      socket.on('answer', (data: AnswerPayload) => {
        this.handleAnswer(socket, data);
      });

      socket.on('candidate', (data: CandidatePayload) => {
        this.handleCandidate(socket, data);
      });

      socket.on('candidate-end', (data: { roomId: string; target: string }) => {
        this.handleCandidateEnd(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });
    });
  }

  /**
   * Handle room join
   */
  private handleJoinRoom(socket: Socket, roomId: string): void {
    const agentId = (socket as any).agentId;
    
    const info = this.roomManager.getRoomInfoForSocket(socket.id);
    
    // If already in a room, leave it first
    if (info) {
      this.handleLeaveRoom(socket);
    }

    // Check if room exists
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
      return;
    }

    // Check if room is full
    if (this.roomManager.isRoomFull(roomId)) {
      socket.emit('error', { message: 'Room is full', code: 'ROOM_FULL' });
      return;
    }

    // Add participant to room
    const participant = this.roomManager.addParticipant(roomId, agentId, socket.id);
    if (!participant) {
      socket.emit('error', { message: 'Failed to join room', code: 'JOIN_FAILED' });
      return;
    }

    // Join socket room
    socket.join(roomId);

    // Get existing participants
    const participants = this.roomManager.getParticipantsByRoom(roomId);

    // Notify the new participant they joined
    socket.emit('joined', {
      roomId,
      participantId: participant.id,
      participants: participants.map(p => ({
        id: p.id,
        agentId: p.agentId,
        role: p.role,
        joinedAt: p.joinedAt
      }))
    });

    // Notify other participants
    socket.to(roomId).emit('user_joined', {
      participantId: participant.id,
      agentId,
      socketId: socket.id
    });

    logger.info(`${agentId} joined room ${roomId}`);
  }

  /**
   * Handle room leave
   */
  private handleLeaveRoom(socket: Socket): void {
    const info = this.roomManager.getRoomInfoForSocket(socket.id);
    if (!info) {
      return;
    }

    const { room, participant } = info;
    const agentId = (socket as any).agentId;

    // Leave socket room
    socket.leave(room.id);

    // Remove from room manager
    this.roomManager.removeParticipant(socket.id);

    // Notify other participants
    socket.to(room.id).emit('user_left', {
      participantId: participant.id,
      agentId,
      socketId: socket.id
    });

    logger.info(`${agentId} left room ${room.id}`);
  }

  /**
   * Handle offer message
   */
  private handleOffer(socket: Socket, data: OfferPayload): void {
    const { roomId, target, sdp } = data;
    const fromAgentId = (socket as any).agentId;

    const info = this.roomManager.getRoomInfoForSocket(socket.id);
    if (!info || info.room.id !== roomId) {
      socket.emit('error', { message: 'Not in room', code: 'NOT_IN_ROOM' });
      return;
    }

    const targetParticipant = this.roomManager.getParticipantBySocket(target);
    if (!targetParticipant) {
      socket.emit('error', { message: 'Target participant not found', code: 'TARGET_NOT_FOUND' });
      return;
    }

    // Forward offer to target
    this.io.to(target).emit('offer', {
      from: fromAgentId,
      fromSocketId: socket.id,
      sdp
    });

    logger.debug(`Offer from ${fromAgentId} to ${targetParticipant.agentId} in room ${roomId}`);
  }

  /**
   * Handle answer message
   */
  private handleAnswer(socket: Socket, data: AnswerPayload): void {
    const { roomId, target, sdp } = data;
    const fromAgentId = (socket as any).agentId;

    const info = this.roomManager.getRoomInfoForSocket(socket.id);
    if (!info || info.room.id !== roomId) {
      socket.emit('error', { message: 'Not in room', code: 'NOT_IN_ROOM' });
      return;
    }

    const targetParticipant = this.roomManager.getParticipantBySocket(target);
    if (!targetParticipant) {
      socket.emit('error', { message: 'Target participant not found', code: 'TARGET_NOT_FOUND' });
      return;
    }

    // Forward answer to target
    this.io.to(target).emit('answer', {
      from: fromAgentId,
      fromSocketId: socket.id,
      sdp
    });

    logger.debug(`Answer from ${fromAgentId} to ${targetParticipant.agentId} in room ${roomId}`);
  }

  /**
   * Handle ICE candidate
   */
  private handleCandidate(socket: Socket, data: CandidatePayload): void {
    const { roomId, target, candidate } = data;
    const fromAgentId = (socket as any).agentId;

    const info = this.roomManager.getRoomInfoForSocket(socket.id);
    if (!info || info.room.id !== roomId) {
      socket.emit('error', { message: 'Not in room', code: 'NOT_IN_ROOM' });
      return;
    }

    const targetParticipant = this.roomManager.getParticipantBySocket(target);
    if (!targetParticipant) {
      socket.emit('error', { message: 'Target participant not found', code: 'TARGET_NOT_FOUND' });
      return;
    }

    // Forward candidate to target
    this.io.to(target).emit('candidate', {
      from: fromAgentId,
      fromSocketId: socket.id,
      candidate
    });

    logger.debug(`ICE candidate from ${fromAgentId} to ${targetParticipant.agentId}`);
  }

  /**
   * Handle end of ICE candidates
   */
  private handleCandidateEnd(socket: Socket, data: { roomId: string; target: string }): void {
    const { roomId, target } = data;
    const fromAgentId = (socket as any).agentId;

    const info = this.roomManager.getRoomInfoForSocket(socket.id);
    if (!info || info.room.id !== roomId) {
      return;
    }

    this.io.to(target).emit('candidate_end', {
      from: fromAgentId
    });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: Socket, reason: string): void {
    const agentId = (socket as any).agentId;
    
    // Clean up room participation
    this.handleLeaveRoom(socket);

    logger.info(`Socket disconnected: ${socket.id} (${agentId}) - ${reason}`);
  }

  /**
   * Broadcast message to room (excluding sender)
   */
  broadcastToRoom(roomId: string, event: string, data: any, excludeSocketId?: string): void {
    this.io.to(roomId).emit(event, data);
  }

  /**
   * Send message to specific socket
   */
  sendToSocket(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, data);
  }

  /**
   * Get connected socket count
   */
  getConnectedCount(): number {
    return this.io.engine.clientsCount;
  }

  /**
   * Get room participant count
   */
  getRoomParticipantCount(roomId: string): number {
    return this.roomManager.getParticipantCount(roomId);
  }

  /**
   * Close the signaling service
   */
  close(): void {
    this.io.close();
    logger.info('Signaling service closed');
  }
}

export const createSignalingService = (
  httpServer: HttpServer,
  roomManager: RoomManager,
  authService: AuthService,
  corsOrigin?: string,
  heartbeatInterval?: number
): SignalingService => {
  return new SignalingService(httpServer, roomManager, authService, corsOrigin, heartbeatInterval);
};
