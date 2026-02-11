"use strict";
/**
 * Room management service
 * Handles room creation, participant management, and room state
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoomManager = exports.RoomManager = void 0;
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createChildLogger)('room-manager');
class RoomManager {
    rooms;
    participants;
    socketToRoom;
    socketToParticipant;
    roomTimeout;
    maxParticipants;
    constructor(roomTimeout = 300000, maxParticipants = 10) {
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
    createRoom(name, type, createdBy, settings) {
        const roomId = (0, uuid_1.v4)();
        const now = new Date();
        const room = {
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
            }
        };
        this.rooms.set(roomId, room);
        logger.info(`Room created: ${roomId} (${name}) by ${createdBy}`);
        return room;
    }
    /**
     * Get room by ID
     */
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    /**
     * Get all rooms
     */
    getAllRooms() {
        return Array.from(this.rooms.values());
    }
    /**
     * Delete a room
     */
    deleteRoom(roomId) {
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
    addParticipant(roomId, agentId, socketId, role = 'participant') {
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
        const participantId = (0, uuid_1.v4)();
        const participant = {
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
    removeParticipant(socketId) {
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
    getParticipantBySocket(socketId) {
        return this.socketToParticipant.get(socketId);
    }
    /**
     * Get all participants in a room
     */
    getParticipantsByRoom(roomId) {
        return Array.from(this.participants.values()).filter(p => this.socketToRoom.get(p.socketId) === roomId);
    }
    /**
     * Get room ID by socket ID
     */
    getRoomBySocket(socketId) {
        return this.socketToRoom.get(socketId);
    }
    /**
     * Get room and participant info for a socket
     */
    getRoomInfoForSocket(socketId) {
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
    getParticipantCount(roomId) {
        return this.getParticipantsByRoom(roomId).length;
    }
    /**
     * Check if room is full
     */
    isRoomFull(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return true;
        }
        return this.getParticipantCount(roomId) >= room.maxParticipants;
    }
    /**
     * Start periodic cleanup of empty rooms
     */
    startCleanup() {
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
    getParticipant(participantId) {
        return this.participants.get(participantId);
    }
    /**
     * Update participant mute state
     */
    updateParticipantMuteState(socketId, isMuted) {
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
    updateRoomSettings(roomId, settings) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return false;
        }
        room.settings = {
            ...room.settings,
            ...settings
        };
        this.rooms.set(roomId, room);
        logger.info(`Room ${roomId} settings updated`);
        return true;
    }
    /**
     * Get statistics
     */
    getStats() {
        const rooms = this.getAllRooms();
        const roomsByParticipantCount = {};
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
exports.RoomManager = RoomManager;
const createRoomManager = (roomTimeout, maxParticipants) => {
    return new RoomManager(roomTimeout, maxParticipants);
};
exports.createRoomManager = createRoomManager;
//# sourceMappingURL=room-manager.js.map