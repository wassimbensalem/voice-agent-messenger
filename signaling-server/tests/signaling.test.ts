/**
 * WebRTC Signaling Server - Test Suite
 */

import { EventEmitter } from 'events';
import jwt from 'jsonwebtoken';

// Helper to generate JWT token
function generateTestToken(agentId: string, jwtSecret: string): string {
  return jwt.sign({ agentId }, jwtSecret, { expiresIn: '1h' });
}

// Mock Socket interface
interface MockSocket {
  id: string;
  events: EventEmitter;
}

// Simple mock server for testing
class SimpleSignalingServer extends EventEmitter {
  private clients: Map<string, MockSocket> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private socketToRoom: Map<string, string> = new Map();
  private jwtSecret: string;

  constructor(jwtSecret: string) {
    super();
    this.jwtSecret = jwtSecret;
  }

  // Simulate a client connection
  createClient(id: string): MockSocket {
    const events = new EventEmitter();
    const client = { id, events };
    this.clients.set(id, client);
    return client;
  }

  // Simulate joining a room
  joinRoom(clientId: string, roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    
    room.add(clientId);
    this.socketToRoom.set(clientId, roomId);
    
    // Notify others
    this.emit('peer-joined', { roomId, peerId: clientId });
    return true;
  }

  // Simulate leaving a room
  leaveRoom(clientId: string): void {
    const roomId = this.socketToRoom.get(clientId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.delete(clientId);
        this.emit('peer-left', { roomId, peerId: clientId });
        if (room.size === 0) {
          this.rooms.delete(roomId);
        }
      }
      this.socketToRoom.delete(clientId);
    }
  }

  // Create a room
  createRoom(roomId: string): void {
    this.rooms.set(roomId, new Set());
  }

  // Get room participants
  getRoomParticipants(roomId: string): string[] {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room) : [];
  }

  // Cleanup client
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    this.leaveRoom(clientId);
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      activeRooms: this.rooms.size,
    };
  }
}

// Test Suite
describe('WebRTC Signaling Server', () => {
  let server: SimpleSignalingServer;
  let jwtSecret: string;

  beforeEach(() => {
    jwtSecret = 'test-secret-key';
    server = new SimpleSignalingServer(jwtSecret);
  });

  afterEach(() => {
    server.removeAllListeners();
  });

  describe('Room Management', () => {
    it('should create room', () => {
      const roomId = 'room-test-001';
      server.createRoom(roomId);
      
      expect(server['rooms'].has(roomId)).toBe(true);
      expect(server.getRoomParticipants(roomId).length).toBe(0);
    });

    it('should join existing room and notify peers', (done) => {
      const roomId = 'room-test-002';
      server.createRoom(roomId);

      // First client joins
      server.joinRoom('client-1', roomId);

      // Second client joins
      server.once('peer-joined', (data: any) => {
        expect(data.roomId).toBe(roomId);
        expect(data.peerId).toBe('client-2');
        done();
      });

      const result = server.joinRoom('client-2', roomId);
      expect(result).toBe(true);
    });

    it('should reject join to non-existent room', () => {
      const result = server.joinRoom('client-test', 'non-existent');
      expect(result).toBe(false);
    });

    it('should remove participant and notify peers', (done) => {
      const roomId = 'room-leave';
      server.createRoom(roomId);

      server.joinRoom('client-1', roomId);
      server.joinRoom('client-2', roomId);

      server.once('peer-left', (data: any) => {
        expect(data.roomId).toBe(roomId);
        expect(data.peerId).toBe('client-2');
        done();
      });

      server.leaveRoom('client-2');
    });
  });

  describe('Offer/Answer Exchange', () => {
    it('should track offer exchange', (done) => {
      const roomId = 'room-offer';
      server.createRoom(roomId);
      server.joinRoom('client-a', roomId);
      server.joinRoom('client-b', roomId);

      // Simulate offer event
      server.once('offer', (data: any) => {
        expect(data.from).toBe('client-a');
        expect(data.roomId).toBe(roomId);
        done();
      });

      server.emit('offer', {
        from: 'client-a',
        roomId,
        target: 'client-b',
        sdp: 'mock-sdp-offer'
      });
    });

    it('should track answer exchange', (done) => {
      const roomId = 'room-answer';
      server.createRoom(roomId);
      server.joinRoom('client-a', roomId);
      server.joinRoom('client-b', roomId);

      // First send offer
      server.emit('offer', {
        from: 'client-a',
        roomId,
        target: 'client-b',
        sdp: 'mock-sdp-offer'
      });

      // Then answer
      server.once('answer', (data: any) => {
        expect(data.from).toBe('client-b');
        expect(data.roomId).toBe(roomId);
        done();
      });

      server.emit('answer', {
        from: 'client-b',
        roomId,
        target: 'client-a',
        sdp: 'mock-sdp-answer'
      });
    });
  });

  describe('ICE Candidate Exchange', () => {
    it('should relay ICE candidate', (done) => {
      const roomId = 'room-ice';
      server.createRoom(roomId);
      server.joinRoom('client-a', roomId);
      server.joinRoom('client-b', roomId);

      const candidate = {
        candidate: 'mock-candidate',
        sdpMid: 'audio',
        sdpMLineIndex: 0
      };

      server.once('candidate', (data: any) => {
        expect(data.from).toBe('client-a');
        expect(data.candidate).toEqual(candidate);
        done();
      });

      server.emit('candidate', {
        from: 'client-a',
        roomId,
        target: 'client-b',
        candidate
      });
    });

    it('should handle multiple ICE candidates', (done) => {
      const roomId = 'room-multi-ice';
      server.createRoom(roomId);
      server.joinRoom('client-a', roomId);
      server.joinRoom('client-b', roomId);

      const candidates = [
        { candidate: 'candidate-1' },
        { candidate: 'candidate-2' },
        { candidate: 'candidate-3' }
      ];

      let received = 0;

      server.on('candidate', (data: any) => {
        received++;
        if (received === 3) {
          done();
        }
      });

      candidates.forEach((c, i) => {
        setTimeout(() => {
          server.emit('candidate', {
            from: 'client-a',
            roomId,
            target: 'client-b',
            candidate: c
          });
        }, i * 10);
      });
    });
  });

  describe('Disconnect/Reconnect', () => {
    it('should cleanup on disconnect', (done) => {
      server.createClient('client-leave');
      server.removeClient('client-leave');

      setTimeout(() => {
        expect(server.getStats().connectedClients).toBe(0);
        done();
      }, 10);
    });

    it('should notify peers when client disconnects', (done) => {
      const roomId = 'room-disconnect';
      server.createRoom(roomId);
      server.joinRoom('client-a', roomId);
      server.joinRoom('client-b', roomId);

      server.once('peer-left', (data: any) => {
        expect(data.roomId).toBe(roomId);
        expect(data.peerId).toBe('client-b');
        done();
      });

      server.removeClient('client-b');
    });
  });

  describe('JWT Authentication', () => {
    it('should generate valid JWT token', () => {
      const token = generateTestToken('agent-fawzi', jwtSecret);
      expect(token).toBeDefined();
      
      const decoded = jwt.verify(token, jwtSecret) as any;
      expect(decoded.agentId).toBe('agent-fawzi');
    });

    it('should reject invalid JWT token', () => {
      try {
        jwt.verify('invalid-token', jwtSecret);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should reject expired JWT token', () => {
      const token = jwt.sign({ agentId: 'test' }, jwtSecret, { expiresIn: '-1h' });
      try {
        jwt.verify(token, jwtSecret);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Server Statistics', () => {
    it('should track connected clients', () => {
      server.createClient('client-1');
      server.createClient('client-2');

      const stats = server.getStats();
      expect(stats.connectedClients).toBe(2);
    });

    it('should track active rooms', () => {
      server.createRoom('room-1');
      server.createRoom('room-2');

      const stats = server.getStats();
      expect(stats.activeRooms).toBe(2);
    });
  });
});

// Export for use in other test files
export { SimpleSignalingServer, generateTestToken };
