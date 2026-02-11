/**
 * Mock utilities for WebRTC Signaling Server tests
 */

import { EventEmitter } from 'events';

// Mock Signaling Server for Testing
export class MockSignalingServer extends EventEmitter {
  private clients: Map<string, any> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private heartbeatInterval: number = 30000;
  
  constructor() {
    super();
  }

  handleConnection(client: any, clientId: string) {
    this.clients.set(clientId, client);
    this.emit('connection', { clientId, client });
    
    client.on('message', (data: any) => this.handleMessage(clientId, data));
    client.on('close', () => this.handleDisconnect(clientId));
    
    this.sendToClient(clientId, { type: 'connected', clientId });
  }

  handleMessage(clientId: string, data: any) {
    try {
      const msg = typeof data === 'string' ? JSON.parse(data) : data;
      
      switch (msg.type) {
        case 'offer':
          this.handleOffer(clientId, msg);
          break;
        case 'answer':
          this.handleAnswer(clientId, msg);
          break;
        case 'ice-candidate':
          this.handleIceCandidate(clientId, msg);
          break;
        case 'create-room':
          this.handleCreateRoom(clientId, msg);
          break;
        case 'join-room':
          this.handleJoinRoom(clientId, msg);
          break;
        case 'leave-room':
          this.handleLeaveRoom(clientId, msg);
          break;
        default:
          this.emit('unknown-message', { clientId, msg });
      }
    } catch (e) {
      this.emit('error', { clientId, error: e });
    }
  }

  handleOffer(clientId: string, msg: any) {
    this.emit('offer', { from: clientId, to: msg.target, offer: msg.offer });
    this.sendToClient(msg.target, { type: 'offer', from: clientId, offer: msg.offer });
  }

  handleAnswer(clientId: string, msg: any) {
    this.emit('answer', { from: clientId, to: msg.target, answer: msg.answer });
    this.sendToClient(msg.target, { type: 'answer', from: clientId, answer: msg.answer });
  }

  handleIceCandidate(clientId: string, msg: any) {
    this.emit('ice-candidate', { from: clientId, to: msg.target, candidate: msg.candidate });
    this.sendToClient(msg.target, { type: 'ice-candidate', from: clientId, candidate: msg.candidate });
  }

  handleCreateRoom(clientId: string, msg: any) {
    const roomId = msg.roomId || `room-${Date.now()}`;
    this.rooms.set(roomId, new Set([clientId]));
    this.emit('room-created', { roomId, host: clientId });
    this.sendToClient(clientId, { type: 'room-created', roomId, host: clientId });
  }

  handleJoinRoom(clientId: string, msg: any) {
    const room = this.rooms.get(msg.roomId);
    if (!room) {
      this.sendToClient(clientId, { type: 'error', message: 'Room not found' });
      return;
    }
    if (room.size >= 10) {
      this.sendToClient(clientId, { type: 'error', message: 'Room full' });
      return;
    }
    room.add(clientId);
    this.emit('peer-joined', { roomId: msg.roomId, peerId: clientId });
    this.broadcastToRoom(msg.roomId, { type: 'peer-joined', peerId: clientId }, clientId);
    this.sendToClient(clientId, { type: 'room-joined', roomId: msg.roomId, peers: Array.from(room) });
  }

  handleLeaveRoom(clientId: string, msg: any) {
    const room = this.rooms.get(msg.roomId);
    if (room) {
      room.delete(clientId);
      if (room.size === 0) {
        this.rooms.delete(msg.roomId);
        this.emit('room-closed', { roomId: msg.roomId });
      } else {
        this.broadcastToRoom(msg.roomId, { type: 'peer-left', peerId: clientId });
      }
    }
  }

  handleDisconnect(clientId: string) {
    this.clients.delete(clientId);
    this.rooms.forEach((room, roomId) => {
      if (room.has(clientId)) {
        room.delete(clientId);
        this.broadcastToRoom(roomId, { type: 'peer-left', peerId: clientId });
        if (room.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    });
    this.emit('disconnect', { clientId });
  }

  sendToClient(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (client) {
      if (typeof client.emit === 'function') {
        client.emit('message', JSON.stringify(message));
      }
    }
  }

  broadcastToRoom(roomId: string, message: any, exclude?: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.forEach(peerId => {
        if (peerId !== exclude) {
          this.sendToClient(peerId, message);
        }
      });
    }
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      activeRooms: this.rooms.size,
    };
  }
}

// Test Utilities
export function createMockWebSocket(): any {
  const emitter = new EventEmitter() as any;
  emitter.readyState = 'OPEN';
  
  emitter.send = (data: string) => {
    setImmediate(() => emitter.emit('message', data));
  };
  
  emitter.close = () => {
    emitter.readyState = 'CLOSED';
    emitter.emit('close');
  };
  
  return emitter;
}

export function generateMockSDP(type: 'offer' | 'answer'): string {
  return `v=0\r\no=- ${Date.now()} 0 IN IP4 0.0.0.0\r\ns=-\r\nc=IN IP4 0.0.0.0\r\nt=0 0\r\na=${type}:-\r\n`;
}

export function generateMockIceCandidate(): any {
  return {
    candidate: `candidate:1 1 udp 2113937151 ${Math.random().toString(16).slice(2, 10)} 54321 typ host`,
    sdpMid: 'audio',
    sdpMLineIndex: 0,
  };
}

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createMockRoom(roomId: string, participants: string[] = []): any {
  return {
    id: roomId,
    name: `Test Room ${roomId}`,
    type: 'voice',
    participants,
    createdAt: new Date(),
    maxParticipants: 10
  };
}

export function generateMockOffer(): any {
  return {
    type: 'offer',
    sdp: generateMockSDP('offer')
  };
}

export function generateMockAnswer(): any {
  return {
    type: 'answer',
    sdp: generateMockSDP('answer')
  };
}

export function createMockParticipant(id: string, agentId: string): any {
  return {
    id,
    agentId,
    socketId: `socket-${id}`,
    joinedAt: new Date(),
    role: 'participant'
  };
}
