/**
 * Simple WebRTC Signaling Server (Reference Implementation)
 * This is a minimal signaling server that the client can connect to
 */

import { Server } from 'socket.io';
import { createServer } from 'http';
import type { Server as HTTPServer } from 'http';
import type { Socket } from 'socket.io';

const PORT = process.env.PORT || 3000;

// Room and participant storage
const rooms = new Map<string, Set<string>>();
const socketToRoom = new Map<string, string>();
const socketToAgent = new Map<string, { agentId: string; token: string }>();

// Create HTTP server
const httpServer: HTTPServer = createServer();

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

/**
 * Handle new connections
 */
io.on('connection', (socket: Socket) => {
  console.log(`[Signaling] Client connected: ${socket.id}`);

  /**
   * Handle authentication
   */
  socket.on('authenticate', async (data: { token: string; agentId: string }) => {
    // In production, validate token with agent-link service
    // For now, just store the agent info
    socketToAgent.set(socket.id, {
      agentId: data.agentId,
      token: data.token,
    });
    
    socket.emit('auth_ok');
    console.log(`[Signaling] Authenticated: ${data.agentId}`);
  });

  /**
   * Handle room join
   */
  socket.on('join_room', (data: { roomId: string; agentId: string; audioEnabled: boolean }) => {
    const { roomId, agentId, audioEnabled } = data;
    
    console.log(`[Signaling] ${agentId} joining room: ${roomId}`);
    
    // Join socket to room
    socket.join(roomId);
    socketToRoom.set(socket.id, roomId);
    
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    
    const participants = rooms.get(roomId)!;
    participants.add(socket.id);
    
    // Get current participants
    const currentParticipants = Array.from(participants).map((id) => ({
      id,
      agentId: socketToAgent.get(id)?.agentId || 'unknown',
      socketId: id,
      audioEnabled: true,
      joinedAt: new Date(),
    }));
    
    // Notify others in room
    socket.to(roomId).emit('user_joined', {
      participant: {
        id: socket.id,
        agentId,
        socketId: socket.id,
        audioEnabled,
        joinedAt: new Date(),
      },
    });
    
    // Send current participants to new joiner
    socket.emit('room_joined', {
      room: {
        roomId,
        name: `Voice Room ${roomId}`,
        type: 'voice',
        maxParticipants: 10,
        participants: currentParticipants,
        createdBy: agentId,
        createdAt: new Date(),
      },
    });
    
    socket.emit('room_users', { participants: currentParticipants });
    
    console.log(`[Signaling] Room ${roomId} now has ${participants.size} participants`);
  });

  /**
   * Handle room leave
   */
  socket.on('leave_room', (data: { reason?: string }) => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      const agentInfo = socketToAgent.get(socket.id);
      console.log(`[Signaling] ${agentInfo?.agentId} leaving room: ${roomId}`);
      
      leaveRoom(socket, roomId, data.reason);
    }
  });

  /**
   * Handle SDP offer
   */
  socket.on('offer', (data: { from: string; fromSocketId: string; sdp: RTCSessionDescriptionInit }) => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('offer', data);
      console.log(`[Signaling] Relayed offer from ${data.from}`);
    }
  });

  /**
   * Handle SDP answer
   */
  socket.on('answer', (data: { from: string; fromSocketId: string; sdp: RTCSessionDescriptionInit }, targetSocketId: string) => {
    io.to(targetSocketId).emit('answer', data);
    console.log(`[Signaling] Relayed answer to ${targetSocketId}`);
  });

  /**
   * Handle ICE candidate
   */
  socket.on('candidate', (data: { from: string; fromSocketId: string; candidate: RTCIceCandidateInit }, targetSocketId?: string) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('candidate', data);
    } else {
      const roomId = socketToRoom.get(socket.id);
      if (roomId) {
        socket.to(roomId).emit('candidate', data);
      }
    }
    console.log(`[Signaling] Relayed ICE candidate from ${data.from}`);
  });

  /**
   * Handle broadcast message
   */
  socket.on('broadcast', (data: { data: unknown; from: string }) => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('data', data);
    }
  });

  /**
   * Handle direct data message
   */
  socket.on('data', (data: { data: unknown; from: string }, targetSocketId: string) => {
    io.to(targetSocketId).emit('data', data);
  });

  /**
   * Handle disconnection
   */
  socket.on('disconnect', (reason: string) => {
    const roomId = socketToRoom.get(socket.id);
    const agentInfo = socketToAgent.get(socket.id);
    
    if (roomId) {
      leaveRoom(socket, roomId, reason);
    }
    
    socketToRoom.delete(socket.id);
    socketToAgent.delete(socket.id);
    
    console.log(`[Signaling] Client disconnected: ${socket.id} (${agentInfo?.agentId}) - ${reason}`);
  });
});

/**
 * Leave room helper
 */
function leaveRoom(socket: Socket, roomId: string, reason?: string): void {
  const participants = rooms.get(roomId);
  
  if (participants) {
    participants.delete(socket.id);
    
    const agentInfo = socketToAgent.get(socket.id);
    
    // Notify others
    socket.to(roomId).emit('user_left', {
      participantId: socket.id,
      agentId: agentInfo?.agentId || 'unknown',
      reason,
    });
    
    // Clean up empty rooms
    if (participants.size === 0) {
      rooms.delete(roomId);
      console.log(`[Signaling] Room ${roomId} deleted (empty)`);
    }
  }
  
  socket.leave(roomId);
}

// Start server
httpServer.listen(PORT, () => {
  console.log(`[Signaling] Signaling server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Signaling] Shutting down...');
  io.close();
  httpServer.close();
  process.exit(0);
});
