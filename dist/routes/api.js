"use strict";
/**
 * REST API routes for room management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiRouter = createApiRouter;
const express_1 = require("express");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createChildLogger)('api-routes');
function createApiRouter(roomManager, authService) {
    const router = (0, express_1.Router)();
    /**
     * Authentication middleware for REST API
     */
    const authenticate = async (req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = authService.extractToken(authHeader);
        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
            return;
        }
        const payload = await authService.verifyToken(token);
        if (!payload) {
            res.status(401).json({
                success: false,
                error: 'Invalid authentication token'
            });
            return;
        }
        req.agentId = payload.agentId;
        next();
    };
    /**
     * GET /api/rooms - List all rooms
     */
    router.get('/rooms', (req, res) => {
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
            });
        }
        catch (error) {
            logger.error('Error listing rooms:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list rooms'
            });
        }
    });
    /**
     * POST /api/rooms - Create a new room
     */
    router.post('/rooms', authenticate, (req, res) => {
        try {
            const { name, type, settings } = req.body;
            if (!name || typeof name !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Room name is required'
                });
                return;
            }
            const roomType = type === 'video' ? 'video' : 'voice';
            const agentId = req.agentId;
            const room = roomManager.createRoom(name, roomType, agentId, settings);
            logger.info(`Room created via API: ${room.id} by ${agentId}`);
            res.status(201).json({
                success: true,
                data: room
            });
        }
        catch (error) {
            logger.error('Error creating room:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create room'
            });
        }
    });
    /**
     * GET /api/rooms/:roomId - Get room details
     */
    router.get('/rooms/:roomId', authenticate, (req, res) => {
        try {
            const { roomId } = req.params;
            const room = roomManager.getRoom(roomId);
            if (!room) {
                res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
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
            });
        }
        catch (error) {
            logger.error('Error getting room details:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get room details'
            });
        }
    });
    /**
     * DELETE /api/rooms/:roomId - Delete a room
     */
    router.delete('/rooms/:roomId', authenticate, (req, res) => {
        try {
            const { roomId } = req.params;
            const agentId = req.agentId;
            const room = roomManager.getRoom(roomId);
            if (!room) {
                res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
                return;
            }
            // Only room creator can delete
            if (room.createdBy !== agentId) {
                res.status(403).json({
                    success: false,
                    error: 'Only room creator can delete the room'
                });
                return;
            }
            const deleted = roomManager.deleteRoom(roomId);
            if (deleted) {
                logger.info(`Room deleted via API: ${roomId} by ${agentId}`);
                res.json({
                    success: true,
                    message: 'Room deleted successfully'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to delete room'
                });
            }
        }
        catch (error) {
            logger.error('Error deleting room:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete room'
            });
        }
    });
    /**
     * POST /api/rooms/:roomId/join - Generate join token
     */
    router.post('/rooms/:roomId/join', authenticate, (req, res) => {
        try {
            const { roomId } = req.params;
            const agentId = req.agentId;
            const room = roomManager.getRoom(roomId);
            if (!room) {
                res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
                return;
            }
            if (roomManager.isRoomFull(roomId)) {
                res.status(403).json({
                    success: false,
                    error: 'Room is full'
                });
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
            });
        }
        catch (error) {
            logger.error('Error generating join token:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate join token'
            });
        }
    });
    /**
     * GET /api/rooms/:roomId/participants - List participants
     */
    router.get('/rooms/:roomId/participants', authenticate, (req, res) => {
        try {
            const { roomId } = req.params;
            const room = roomManager.getRoom(roomId);
            if (!room) {
                res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
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
            });
        }
        catch (error) {
            logger.error('Error listing participants:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list participants'
            });
        }
    });
    /**
     * GET /api/stats - Server statistics
     */
    router.get('/stats', (req, res) => {
        try {
            const roomStats = roomManager.getStats();
            res.json({
                success: true,
                data: {
                    rooms: roomStats,
                    timestamp: new Date().toISOString()
                }
            });
        }
        catch (error) {
            logger.error('Error getting stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get stats'
            });
        }
    });
    /**
     * GET /api/health - Health check
     */
    router.get('/health', (req, res) => {
        res.json({
            success: true,
            data: {
                status: 'healthy',
                timestamp: new Date().toISOString()
            }
        });
    });
    return router;
}
//# sourceMappingURL=api.js.map