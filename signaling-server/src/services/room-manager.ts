/**
 * Room management service
 * Handles room creation, participant management, and room state
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  Room, 
  RoomType, 
  Participant, 
  ParticipantRole,
  RoomSettings,
  VoiceParticipant,
  VoiceRoomSettings 
} from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('room-manager');

export class RoomManager {
  private rooms: Map<string, Room>;
  private participants: Map<string, Participant>;
  private socketToRoom: Map<string, string>;
  private socketToParticipant: Map<string, Participant>;
  private roomTimeout: number;
  private maxParticipants: number;

  constructor(roomTimeout: number = 300000, maxParticipants: number = 10) {
    this.rooms = new Map();
    this.participants = new Map();
    this.socketToRoom = new Map();
    this.socketToParticipant = new Map();
    this.roomTimeout = roomTimeout;
    this.maxParticipants = maxParticipants;

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Create a new room
   */
  createRoom(
    name: string,
    type: RoomType,
    createdBy: string,
    settings?: Partial<RoomSettings>,
    connectionUrl?: string,
    topic?: string
  ): Room {
    const roomId = uuidv4();
    const now = new Date();

    const room: Room = {
      id: roomId,
      name,
      type,
      createdBy,
      createdAt: now,
      maxParticipants: this.maxParticipants,
      settings: {
        muteOnEntry: settings?.muteOnEntry ?? false,
        allowRecording: settings?.allowRecording ?? false,
        maxDuration: settings?.maxDuration ?? 60 // 60 minutes default
      },
      connectionUrl,
      topic
    };

    this.rooms.set(roomId, room);
    logger.info(`Room created: ${roomId} (${name}) by ${createdBy}`);

    return room;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get all rooms
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Delete a room
   */
  deleteRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    // Remove all participants from room
    const participants = this.getParticipantsByRoom(roomId);
    participants.forEach(p => {
      this.socketToRoom.delete(p.socketId);
      this.participants.delete(p.id);
      this.socketToParticipant.delete(p.socketId);
    });

    this.rooms.delete(roomId);
    logger.info(`Room deleted: ${roomId}`);

    return true;
  }

  /**
   * Add participant to room
   */
  addParticipant(
    roomId: string,
    agentId: string,
    socketId: string,
    role: ParticipantRole = 'participant'
  ): Participant | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      logger.warn(`Cannot add participant: room ${roomId} not found`);
      return null;
    }

    // Check room capacity
    const currentCount = this.getParticipantsByRoom(roomId).length;
    if (currentCount >= room.maxParticipants) {
      logger.warn(`Room ${roomId} is full (${currentCount}/${room.maxParticipants})`);
      return null;
    }

    const participantId = uuidv4();
    const participant: Participant = {
      id: participantId,
      agentId,
      socketId,
      joinedAt: new Date(),
      role
    };

    this.participants.set(participantId, participant);
    this.socketToRoom.set(socketId, roomId);
    this.socketToParticipant.set(socketId, participant);

    logger.info(`Participant ${agentId} joined room ${roomId}`);

    return participant;
  }

  /**
   * Remove participant from room
   */
  removeParticipant(socketId: string): Participant | null {
    const participant = this.socketToParticipant.get(socketId);
    if (!participant) {
      return null;
    }

    const roomId = this.socketToRoom.get(socketId);
    
    this.participants.delete(participant.id);
    this.socketToRoom.delete(socketId);
    this.socketToParticipant.delete(socketId);

    if (roomId) {
      logger.info(`Participant ${participant.agentId} left room ${roomId}`);
    }

    return participant;
  }

  /**
   * Get participant by socket ID
   */
  getParticipantBySocket(socketId: string): Participant | undefined {
    return this.socketToParticipant.get(socketId);
  }

  /**
   * Get all participants in a room
   */
  getParticipantsByRoom(roomId: string): Participant[] {
    return Array.from(this.participants.values()).filter(
      p => this.socketToRoom.get(p.socketId) === roomId
    );
  }

  /**
   * Get room ID by socket ID
   */
  getRoomBySocket(socketId: string): string | undefined {
    return this.socketToRoom.get(socketId);
  }

  /**
   * Get room and participant info for a socket
   */
  getRoomInfoForSocket(socketId: string): { room: Room; participant: Participant } | null {
    const roomId = this.socketToRoom.get(socketId);
    const participant = this.socketToParticipant.get(socketId);

    if (!roomId || !participant) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return { room, participant };
  }

  /**
   * Get participant count for a room
   */
  getParticipantCount(roomId: string): number {
    return this.getParticipantsByRoom(roomId).length;
  }

  /**
   * Check if room is full
   */
  isRoomFull(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return true;
    }

    return this.getParticipantCount(roomId) >= room.maxParticipants;
  }

  /**
   * Start periodic cleanup of empty rooms
   */
  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      
      this.rooms.forEach((room, roomId) => {
        const participantCount = this.getParticipantCount(roomId);
        
        if (participantCount === 0) {
          const age = now - room.createdAt.getTime();
          if (age > this.roomTimeout) {
            this.deleteRoom(roomId);
            logger.info(`Cleaned up empty room: ${roomId}`);
          }
        }
      });
    }, 60000); // Check every minute
  }

  /**
   * Get participant by ID
   */
  getParticipant(participantId: string): Participant | undefined {
    return this.participants.get(participantId);
  }

  /**
   * Update participant mute state
   */
  updateParticipantMuteState(socketId: string, isMuted: boolean): boolean {
    const participant = this.socketToParticipant.get(socketId);
    if (!participant) {
      return false;
    }

    participant.isMuted = isMuted;
    this.participants.set(participant.id, participant);
    
    logger.info(`Participant ${participant.agentId} mute state: ${isMuted}`);
    return true;
  }

  /**
   * Update room settings
   */
  updateRoomSettings(roomId: string, settings: Partial<VoiceRoomSettings>): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    room.settings = {
      ...room.settings,
      ...settings
    } as VoiceRoomSettings;

    this.rooms.set(roomId, room);
    logger.info(`Room ${roomId} settings updated`);
    return true;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRooms: number;
    totalParticipants: number;
    roomsByParticipantCount: Record<number, number>;
  } {
    const rooms = this.getAllRooms();
    const roomsByParticipantCount: Record<number, number> = {};

    rooms.forEach(room => {
      const count = this.getParticipantCount(room.id);
      roomsByParticipantCount[count] = (roomsByParticipantCount[count] || 0) + 1;
    });

    return {
      totalRooms: this.rooms.size,
      totalParticipants: this.participants.size,
      roomsByParticipantCount
    };
  }
}

export const createRoomManager = (
  roomTimeout?: number,
  maxParticipants?: number
): RoomManager => {
  return new RoomManager(roomTimeout, maxParticipants);
};
