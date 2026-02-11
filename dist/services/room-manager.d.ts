/**
 * Room management service
 * Handles room creation, participant management, and room state
 */
import { Room, RoomType, Participant, ParticipantRole, RoomSettings, VoiceRoomSettings } from '../types';
export declare class RoomManager {
    private rooms;
    private participants;
    private socketToRoom;
    private socketToParticipant;
    private roomTimeout;
    private maxParticipants;
    constructor(roomTimeout?: number, maxParticipants?: number);
    /**
     * Create a new room
     */
    createRoom(name: string, type: RoomType, createdBy: string, settings?: Partial<RoomSettings>): Room;
    /**
     * Get room by ID
     */
    getRoom(roomId: string): Room | undefined;
    /**
     * Get all rooms
     */
    getAllRooms(): Room[];
    /**
     * Delete a room
     */
    deleteRoom(roomId: string): boolean;
    /**
     * Add participant to room
     */
    addParticipant(roomId: string, agentId: string, socketId: string, role?: ParticipantRole): Participant | null;
    /**
     * Remove participant from room
     */
    removeParticipant(socketId: string): Participant | null;
    /**
     * Get participant by socket ID
     */
    getParticipantBySocket(socketId: string): Participant | undefined;
    /**
     * Get all participants in a room
     */
    getParticipantsByRoom(roomId: string): Participant[];
    /**
     * Get room ID by socket ID
     */
    getRoomBySocket(socketId: string): string | undefined;
    /**
     * Get room and participant info for a socket
     */
    getRoomInfoForSocket(socketId: string): {
        room: Room;
        participant: Participant;
    } | null;
    /**
     * Get participant count for a room
     */
    getParticipantCount(roomId: string): number;
    /**
     * Check if room is full
     */
    isRoomFull(roomId: string): boolean;
    /**
     * Start periodic cleanup of empty rooms
     */
    private startCleanup;
    /**
     * Get participant by ID
     */
    getParticipant(participantId: string): Participant | undefined;
    /**
     * Update participant mute state
     */
    updateParticipantMuteState(socketId: string, isMuted: boolean): boolean;
    /**
     * Update room settings
     */
    updateRoomSettings(roomId: string, settings: Partial<VoiceRoomSettings>): boolean;
    /**
     * Get statistics
     */
    getStats(): {
        totalRooms: number;
        totalParticipants: number;
        roomsByParticipantCount: Record<number, number>;
    };
}
export declare const createRoomManager: (roomTimeout?: number, maxParticipants?: number) => RoomManager;
//# sourceMappingURL=room-manager.d.ts.map