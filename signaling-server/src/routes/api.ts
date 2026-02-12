/**
 * REST API routes for room management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { RoomManager } from '../services/room-manager';
import { AuthService } from '../services/auth';
import { RoomType, RoomSettings, ApiResponse, RoomDetailsResponse, Room } from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('api-routes');

export function createApiRouter(
  roomManager: RoomManager,
  authService: AuthService
): Router {
  const router = Router();

  /**
   * Authentication middleware for REST API
   */
  const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    const token = authService.extractToken(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    const payload = await authService.verifyToken(token);
    if (!payload) {
      res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      } as ApiResponse);
      return;
    }

    (req as any).agentId = payload.agentId;
    next();
  };

  /**
   * GET /api/rooms - List all rooms
   */
  router.get('/rooms', (req: Request, res: Response) => {
    try {
      const rooms = roomManager.getAllRooms();
      
      const roomsWithParticipants = rooms.map(room => ({
        ...room,
        participantCount: roomManager.getParticipantCount(room.id),
        isFull: roomManager.isRoomFull(room.id)
      }));

      res.json({
        success: true,
        data: {
          rooms: roomsWithParticipants,
          total: rooms.length
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Error listing rooms:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list rooms'
      } as ApiResponse);
    }
  });

  /**
   * POST /api/rooms - Create a new room
   */
  router.post('/rooms', authenticate, (req: Request, res: Response) => {
    try {
      const { name, type, settings, connectionUrl, topic } = req.body;

      if (!name || typeof name !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Room name is required'
        } as ApiResponse);
        return;
      }

      const roomType: RoomType = type === 'video' ? 'video' : 'voice';
      const agentId = (req as any).agentId;

      const room = roomManager.createRoom(name, roomType, agentId, settings as Partial<RoomSettings>, connectionUrl, topic);

      logger.info(`Room created via API: ${room.id} by ${agentId}`);

      res.status(201).json({
        success: true,
        data: room
      } as ApiResponse<Room>);
    } catch (error) {
      logger.error('Error creating room:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create room'
      } as ApiResponse);
    }
  });

  /**
   * GET /api/rooms/:roomId - Get room details
   */
  router.get('/rooms/:roomId', authenticate, (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const room = roomManager.getRoom(roomId);

      if (!room) {
        res.status(404).json({
          success: false,
          error: 'Room not found'
        } as ApiResponse);
        return;
      }

      const participants = roomManager.getParticipantsByRoom(roomId);

      res.json({
        success: true,
        data: {
          room,
          participants: participants.map(p => ({
            id: p.id,
            agentId: p.agentId,
            role: p.role,
            joinedAt: p.joinedAt
          }))
        }
      } as ApiResponse<RoomDetailsResponse>);
    } catch (error) {
      logger.error('Error getting room details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get room details'
      } as ApiResponse);
    }
  });

  /**
   * DELETE /api/rooms/:roomId - Delete a room
   */
  router.delete('/rooms/:roomId', authenticate, (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const agentId = (req as any).agentId;

      const room = roomManager.getRoom(roomId);
      if (!room) {
        res.status(404).json({
          success: false,
          error: 'Room not found'
        } as ApiResponse);
        return;
      }

      // Only room creator can delete
      if (room.createdBy !== agentId) {
        res.status(403).json({
          success: false,
          error: 'Only room creator can delete the room'
        } as ApiResponse);
        return;
      }

      const deleted = roomManager.deleteRoom(roomId);

      if (deleted) {
        logger.info(`Room deleted via API: ${roomId} by ${agentId}`);
        res.json({
          success: true,
          message: 'Room deleted successfully'
        } as ApiResponse);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to delete room'
        } as ApiResponse);
      }
    } catch (error) {
      logger.error('Error deleting room:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete room'
      } as ApiResponse);
    }
  });

  /**
   * POST /api/rooms/:roomId/join - Generate join token
   */
  router.post('/rooms/:roomId/join', authenticate, (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const agentId = (req as any).agentId;

      const room = roomManager.getRoom(roomId);
      if (!room) {
        res.status(404).json({
          success: false,
          error: 'Room not found'
        } as ApiResponse);
        return;
      }

      if (roomManager.isRoomFull(roomId)) {
        res.status(403).json({
          success: false,
          error: 'Room is full'
        } as ApiResponse);
        return;
      }

      // Generate join token
      const joinToken = authService.generateJoinToken(roomId, agentId);

      logger.info(`Join token generated for ${agentId} in room ${roomId}`);

      res.json({
        success: true,
        data: {
          roomId,
          joinToken,
          expiresIn: '1h'
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Error generating join token:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate join token'
      } as ApiResponse);
    }
  });

  /**
   * GET /api/rooms/:roomId/participants - List participants
   */
  router.get('/rooms/:roomId/participants', authenticate, (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const room = roomManager.getRoom(roomId);

      if (!room) {
        res.status(404).json({
          success: false,
          error: 'Room not found'
        } as ApiResponse);
        return;
      }

      const participants = roomManager.getParticipantsByRoom(roomId);

      res.json({
        success: true,
        data: {
          participants: participants.map(p => ({
            id: p.id,
            agentId: p.agentId,
            role: p.role,
            joinedAt: p.joinedAt
          })),
          total: participants.length
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Error listing participants:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list participants'
      } as ApiResponse);
    }
  });

  /**
   * GET /api/stats - Server statistics
   */
  router.get('/stats', (req: Request, res: Response) => {
    try {
      const roomStats = roomManager.getStats();

      res.json({
        success: true,
        data: {
          rooms: roomStats,
          timestamp: new Date().toISOString()
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats'
      } as ApiResponse);
    }
  });

  /**
   * GET /api/health - Health check
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  });

  return router;
}
