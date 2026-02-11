"use strict";
/**
 * Voice API Routes
 *
 * REST API endpoints for voice room management and operations.
 * Provides voice-specific functionality beyond basic room management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVoiceRouter = createVoiceRouter;
const express_1 = require("express");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createChildLogger)('voice-routes');
function createVoiceRouter(roomManager, authService) {
    const router = (0, express_1.Router)();
    /**
     * Authentication middleware for voice API
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
     * GET /api/voice/rooms - List all voice rooms
     */
    router.get('/rooms', (req, res) => {
        try {
            const rooms = roomManager.getAllRooms()
                .filter(room => room.type === 'voice');
            const voiceRooms = rooms.map(room => {
                const participantCount = roomManager.getParticipantCount(room.id);
                return {
                    id: room.id,
                    name: room.name,
                    type: room.type,
                    createdBy: room.createdBy,
                    createdAt: room.createdAt,
                    participantCount,
                    maxParticipants: room.maxParticipants,
                    isFull: participantCount >= room.maxParticipants,
                    settings: room.settings
                };
            });
            res.json({
                success: true,
                data: {
                    rooms: voiceRooms,
                    total: voiceRooms.length
                }
            });
        }
        catch (error) {
            logger.error('Error listing voice rooms:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list voice rooms'
            });
        }
    });
    /**
     * POST /api/voice/rooms - Create a new voice room
     */
    router.post('/rooms', authenticate, (req, res) => {
        try {
            const { name, settings } = req.body;
            if (!name || typeof name !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Room name is required'
                });
                return;
            }
            const agentId = req.agentId;
            const voiceSettings = {
                muteOnEntry: settings?.muteOnEntry ?? false,
                allowRecording: settings?.allowRecording ?? false,
                maxDuration: settings?.maxDuration ?? 60,
                musicMode: settings?.musicMode ?? false,
                noiseSuppression: settings?.noiseSuppression ?? true,
                echoCancellation: settings?.echoCancellation ?? true
            };
            const room = roomManager.createRoom(name, 'voice', agentId, voiceSettings);
            logger.info(`Voice room created: ${room.id} by ${agentId}`);
            res.status(201).json({
                success: true,
                data: room
            });
        }
        catch (error) {
            logger.error('Error creating voice room:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create voice room'
            });
        }
    });
    /**
     * GET /api/voice/rooms/:roomId - Get voice room details
     */
    router.get('/rooms/:roomId', authenticate, (req, res) => {
        try {
            const { roomId } = req.params;
            const room = roomManager.getRoom(roomId);
            if (!room || room.type !== 'voice') {
                res.status(404).json({
                    success: false,
                    error: 'Voice room not found'
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
                        socketId: p.socketId,
                        role: p.role,
                        joinedAt: p.joinedAt,
                        isMuted: p.isMuted ?? false,
                        isDeafened: p.isDeafened ?? false
                    })),
                    participantCount: participants.length
                }
            });
        }
        catch (error) {
            logger.error('Error getting voice room details:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get voice room details'
            });
        }
    });
    /**
     * PATCH /api/voice/rooms/:roomId/settings - Update voice room settings
     */
    router.patch('/rooms/:roomId/settings', authenticate, (req, res) => {
        try {
            const { roomId } = req.params;
            const { settings } = req.body;
            const agentId = req.agentId;
            const room = roomManager.getRoom(roomId);
            if (!room || room.type !== 'voice') {
                res.status(404).json({
                    success: false,
                    error: 'Voice room not found'
                });
                return;
            }
            // Only room creator or moderator can update settings
            if (room.createdBy !== agentId) {
                res.status(403).json({
                    success: false,
                    error: 'Only room creator can update settings'
                });
                return;
            }
            // Update settings
            const updatedSettings = {
                ...room.settings,
                ...settings
            };
            roomManager.updateRoomSettings(roomId, updatedSettings);
            logger.info(`Voice room settings updated: ${roomId} by ${agentId}`);
            res.json({
                success: true,
                data: {
                    settings: updatedSettings
                }
            });
        }
        catch (error) {
            logger.error('Error updating voice room settings:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update voice room settings'
            });
        }
    });
    /**
     * POST /api/voice/rooms/:roomId/mute - Mute a participant
     */
    router.post('/rooms/:roomId/mute', authenticate, (req, res) => {
        try {
            const { roomId } = req.params;
            const { participantId } = req.body;
            const agentId = req.agentId;
            const room = roomManager.getRoom(roomId);
            if (!room || room.type !== 'voice') {
                res.status(404).json({
                    success: false,
                    error: 'Voice room not found'
                });
                return;
            }
            // Check if requester is room creator or moderator
            const participant = roomManager.getParticipant(participantId);
            if (!participant) {
                res.status(404).json({
                    success: false,
                    error: 'Participant not found'
                });
                return;
            }
            // Update participant mute state
            roomManager.updateParticipantMuteState(participantId, true);
            logger.info(`Participant ${participantId} muted in room ${roomId} by ${agentId}`);
            res.json({
                success: true,
                message: 'Participant muted'
            });
        }
        catch (error) {
            logger.error('Error muting participant:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to mute participant'
            });
        }
    });
    /**
     * POST /api/voice/rooms/:roomId/unmute - Unmute a participant
     */
    router.post('/rooms/:roomId/unmute', authenticate, (req, res) => {
        try {
            const { roomId } = req.params;
            const { participantId } = req.body;
            const agentId = req.agentId;
            const room = roomManager.getRoom(roomId);
            if (!room || room.type !== 'voice') {
                res.status(404).json({
                    success: false,
                    error: 'Voice room not found'
                });
                return;
            }
            const participant = roomManager.getParticipant(participantId);
            if (!participant) {
                res.status(404).json({
                    success: false,
                    error: 'Participant not found'
                });
                return;
            }
            roomManager.updateParticipantMuteState(participantId, false);
            logger.info(`Participant ${participantId} unmuted in room ${roomId} by ${agentId}`);
            res.json({
                success: true,
                message: 'Participant unmuted'
            });
        }
        catch (error) {
            logger.error('Error unmuting participant:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to unmute participant'
            });
        }
    });
    /**
     * GET /api/voice/rooms/:roomId/active-speakers - Get active speakers
     */
    router.get('/rooms/:roomId/active-speakers', authenticate, (req, res) => {
        try {
            const { roomId } = req.params;
            const room = roomManager.getRoom(roomId);
            if (!room || room.type !== 'voice') {
                res.status(404).json({
                    success: false,
                    error: 'Voice room not found'
                });
                return;
            }
            const participants = roomManager.getParticipantsByRoom(roomId);
            const activeSpeakers = participants
                .filter(p => p.isSpeaking)
                .map(p => ({
                id: p.id,
                agentId: p.agentId,
                startedSpeakingAt: p.speakingStartedAt
            }));
            res.json({
                success: true,
                data: {
                    activeSpeakers,
                    count: activeSpeakers.length
                }
            });
        }
        catch (error) {
            logger.error('Error getting active speakers:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get active speakers'
            });
        }
    });
    /**
     * POST /api/voice/rooms/:roomId/kick - Kick a participant
     */
    router.post('/rooms/:roomId/kick', authenticate, (req, res) => {
        try {
            const { roomId } = req.params;
            const { participantId, reason } = req.body;
            const agentId = req.agentId;
            const room = roomManager.getRoom(roomId);
            if (!room || room.type !== 'voice') {
                res.status(404).json({
                    success: false,
                    error: 'Voice room not found'
                });
                return;
            }
            // Only room creator can kick participants
            if (room.createdBy !== agentId) {
                res.status(403).json({
                    success: false,
                    error: 'Only room creator can kick participants'
                });
                return;
            }
            const participant = roomManager.getParticipant(participantId);
            if (!participant) {
                res.status(404).json({
                    success: false,
                    error: 'Participant not found'
                });
                return;
            }
            roomManager.removeParticipant(participant.socketId);
            logger.info(`Participant ${participantId} kicked from room ${roomId} by ${agentId}`);
            res.json({
                success: true,
                message: 'Participant kicked',
                data: { reason: reason || 'No reason provided' }
            });
        }
        catch (error) {
            logger.error('Error kicking participant:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to kick participant'
            });
        }
    });
    /**
     * POST /api/voice/rooms/:roomId/move - Move participant to another room
     */
    router.post('/rooms/:roomId/move', authenticate, (req, res) => {
        try {
            const { roomId } = req.params;
            const { participantId, targetRoomId } = req.body;
            const agentId = req.agentId;
            const sourceRoom = roomManager.getRoom(roomId);
            if (!sourceRoom || sourceRoom.type !== 'voice') {
                res.status(404).json({
                    success: false,
                    error: 'Source voice room not found'
                });
                return;
            }
            const targetRoom = roomManager.getRoom(targetRoomId);
            if (!targetRoom || targetRoom.type !== 'voice') {
                res.status(404).json({
                    success: false,
                    error: 'Target voice room not found'
                });
                return;
            }
            // Only room creator can move participants
            if (sourceRoom.createdBy !== agentId) {
                res.status(403).json({
                    success: false,
                    error: 'Only room creator can move participants'
                });
                return;
            }
            const participant = roomManager.getParticipant(participantId);
            if (!participant) {
                res.status(404).json({
                    success: false,
                    error: 'Participant not found'
                });
                return;
            }
            // Remove from source room and add to target room
            roomManager.removeParticipant(participant.socketId);
            if (!roomManager.isRoomFull(targetRoomId)) {
                roomManager.addParticipant(targetRoomId, participant.agentId, participant.socketId);
            }
            else {
                res.status(403).json({
                    success: false,
                    error: 'Target room is full'
                });
                return;
            }
            logger.info(`Participant ${participantId} moved from ${roomId} to ${targetRoomId} by ${agentId}`);
            res.json({
                success: true,
                message: 'Participant moved',
                data: { targetRoomId }
            });
        }
        catch (error) {
            logger.error('Error moving participant:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to move participant'
            });
        }
    });
    return router;
}
//# sourceMappingURL=voice.js.map