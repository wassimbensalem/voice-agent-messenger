/**
 * Room Manager Core Tests
 */

import { createRoomManager } from '../src/services/room-manager';
import { createAuthService } from '../src/services/auth';

describe('Room Manager', () => {
  let roomManager: ReturnType<typeof createRoomManager>;

  beforeEach(() => {
    roomManager = createRoomManager();
  });

  describe('Room Creation', () => {
    it('should create a voice room', () => {
      const room = roomManager.createRoom('Test Room', 'voice', 'agent-1');
      
      expect(room).toBeDefined();
      expect(room.id).toBeDefined();
      expect(room.name).toBe('Test Room');
      expect(room.type).toBe('voice');
      expect(room.createdBy).toBe('agent-1');
    });

    it('should create a video room', () => {
      const room = roomManager.createRoom('Video Room', 'video', 'agent-2');
      
      expect(room.type).toBe('video');
    });

    it('should create room with custom settings', () => {
      const room = roomManager.createRoom('Custom Room', 'voice', 'agent-1', {
        muteOnEntry: true,
        allowRecording: true,
        maxDuration: 120
      });
      
      expect(room.settings.muteOnEntry).toBe(true);
      expect(room.settings.allowRecording).toBe(true);
      expect(room.settings.maxDuration).toBe(120);
    });

    it('should store room in manager', () => {
      const room = roomManager.createRoom('Stored Room', 'voice', 'agent-1');
      
      const retrieved = roomManager.getRoom(room.id);
      expect(retrieved).toEqual(room);
    });

    it('should list all rooms', () => {
      roomManager.createRoom('Room 1', 'voice', 'agent-1');
      roomManager.createRoom('Room 2', 'video', 'agent-2');
      
      const rooms = roomManager.getAllRooms();
      expect(rooms.length).toBe(2);
    });
  });

  describe('Participant Management', () => {
    it('should add participant to room', () => {
      const room = roomManager.createRoom('Test Room', 'voice', 'agent-1');
      
      const participant = roomManager.addParticipant(room.id, 'agent-2', 'socket-123');
      
      expect(participant).toBeDefined();
      expect(participant?.agentId).toBe('agent-2');
      expect(participant?.socketId).toBe('socket-123');
      expect(participant?.role).toBe('participant');
    });

    it('should reject adding to non-existent room', () => {
      const participant = roomManager.addParticipant('non-existent', 'agent-1', 'socket-1');
      
      expect(participant).toBeNull();
    });

    it('should get participants by room', () => {
      const room = roomManager.createRoom('Test Room', 'voice', 'agent-1');
      
      roomManager.addParticipant(room.id, 'agent-2', 'socket-1');
      roomManager.addParticipant(room.id, 'agent-3', 'socket-2');
      
      const participants = roomManager.getParticipantsByRoom(room.id);
      expect(participants.length).toBe(2);
    });

    it('should remove participant from room', () => {
      const room = roomManager.createRoom('Test Room', 'voice', 'agent-1');
      
      roomManager.addParticipant(room.id, 'agent-2', 'socket-1');
      const removed = roomManager.removeParticipant('socket-1');
      
      expect(removed).toBeDefined();
      expect(removed?.agentId).toBe('agent-2');
      
      const participants = roomManager.getParticipantsByRoom(room.id);
      expect(participants.length).toBe(0);
    });

    it('should track participant count', () => {
      const room = roomManager.createRoom('Test Room', 'voice', 'agent-1');
      
      expect(roomManager.getParticipantCount(room.id)).toBe(0);
      
      roomManager.addParticipant(room.id, 'agent-2', 'socket-1');
      expect(roomManager.getParticipantCount(room.id)).toBe(1);
      
      roomManager.addParticipant(room.id, 'agent-3', 'socket-2');
      expect(roomManager.getParticipantCount(room.id)).toBe(2);
    });
  });

  describe('Room Capacity', () => {
    it('should enforce max participants', () => {
      const room = roomManager.createRoom('Small Room', 'voice', 'agent-1', {
        maxDuration: 60
      });
      
      // Default max is 10
      for (let i = 0; i < 10; i++) {
        const participant = roomManager.addParticipant(
          room.id, 
          `agent-${i}`, 
          `socket-${i}`
        );
        expect(participant).toBeDefined();
      }
      
      // 11th should fail
      const overflow = roomManager.addParticipant(room.id, 'agent-overflow', 'socket-overflow');
      expect(overflow).toBeNull();
    });

    it('should report if room is full', () => {
      const room = roomManager.createRoom('Test Room', 'voice', 'agent-1');
      
      expect(roomManager.isRoomFull(room.id)).toBe(false);
      
      roomManager.addParticipant(room.id, 'agent-2', 'socket-1');
      expect(roomManager.isRoomFull(room.id)).toBe(false);
    });
  });

  describe('Room Deletion', () => {
    it('should delete room', () => {
      const room = roomManager.createRoom('Test Room', 'voice', 'agent-1');
      
      const deleted = roomManager.deleteRoom(room.id);
      expect(deleted).toBe(true);
      
      const retrieved = roomManager.getRoom(room.id);
      expect(retrieved).toBeUndefined();
    });

    it('should cleanup participants when room deleted', () => {
      const room = roomManager.createRoom('Test Room', 'voice', 'agent-1');
      
      roomManager.addParticipant(room.id, 'agent-2', 'socket-1');
      roomManager.addParticipant(room.id, 'agent-3', 'socket-2');
      
      roomManager.deleteRoom(room.id);
      
      expect(roomManager.getParticipantsByRoom(room.id).length).toBe(0);
    });

    it('should return false when deleting non-existent room', () => {
      const deleted = roomManager.deleteRoom('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Socket to Room Mapping', () => {
    it('should get room by socket', () => {
      const room = roomManager.createRoom('Test Room', 'voice', 'agent-1');
      
      roomManager.addParticipant(room.id, 'agent-2', 'socket-123');
      
      const roomId = roomManager.getRoomBySocket('socket-123');
      expect(roomId).toBe(room.id);
    });

    it('should get participant by socket', () => {
      const room = roomManager.createRoom('Test Room', 'voice', 'agent-1');
      
      roomManager.addParticipant(room.id, 'agent-2', 'socket-123');
      
      const participant = roomManager.getParticipantBySocket('socket-123');
      expect(participant?.agentId).toBe('agent-2');
    });
  });

  describe('Statistics', () => {
    it('should return accurate stats', () => {
      roomManager.createRoom('Room 1', 'voice', 'agent-1');
      roomManager.createRoom('Room 2', 'video', 'agent-2');
      
      const room = roomManager.createRoom('Room 3', 'voice', 'agent-3');
      roomManager.addParticipant(room.id, 'agent-4', 'socket-1');
      roomManager.addParticipant(room.id, 'agent-5', 'socket-2');
      
      const stats = roomManager.getStats();
      
      expect(stats.totalRooms).toBe(3);
      expect(stats.totalParticipants).toBe(2);
    });
  });
});

describe('Auth Service', () => {
  let authService: ReturnType<typeof createAuthService>;
  const jwtSecret = 'test-secret-key';

  beforeEach(() => {
    authService = createAuthService(jwtSecret);
  });

  describe('Token Generation', () => {
    it('should generate join token', () => {
      const token = authService.generateJoinToken('room-123', 'agent-fawzi');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });

  describe('Token Verification', () => {
    it('should verify valid token', async () => {
      const token = authService.generateJoinToken('room-123', 'agent-fawzi');
      
      const payload = await authService.verifyToken(token);
      
      expect(payload).toBeDefined();
      expect(payload?.agentId).toBe('agent-fawzi');
    });

    it('should reject invalid token', async () => {
      const payload = await authService.verifyToken('invalid-token');
      
      expect(payload).toBeNull();
    });

    it('should reject malformed token', async () => {
      const payload = await authService.verifyToken('not-a-jwt');
      
      expect(payload).toBeNull();
    });
  });

  describe('Token Extraction', () => {
    it('should extract token from Bearer header', () => {
      const token = authService.extractToken('Bearer my-token-123');
      
      expect(token).toBe('my-token-123');
    });

    it('should return null for missing header', () => {
      const token = authService.extractToken(undefined);
      
      expect(token).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(authService.extractToken('Basic token')).toBeNull();
      expect(authService.extractToken('Bearer')).toBeNull();
      expect(authService.extractToken('token-only')).toBeNull();
    });
  });

  describe('Socket Authentication', () => {
    it('should authenticate valid socket token', async () => {
      const token = authService.generateJoinToken('room-123', 'agent-fawzi');
      
      const authenticated = await authService.authenticateSocket(token);
      
      expect(authenticated).toBeDefined();
      expect(authenticated?.agentId).toBe('agent-fawzi');
    });

    it('should reject invalid socket token', async () => {
      const authenticated = await authService.authenticateSocket('invalid');
      
      expect(authenticated).toBeNull();
    });
  });
});
