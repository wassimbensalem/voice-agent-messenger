/**
 * Type definitions for WebRTC Signaling Server
 */
export interface Room {
    id: string;
    name: string;
    type: RoomType;
    createdBy: string;
    createdAt: Date;
    maxParticipants: number;
    settings: RoomSettings;
}
export type RoomType = 'voice' | 'video';
export interface RoomSettings {
    muteOnEntry: boolean;
    allowRecording: boolean;
    maxDuration: number;
}
export interface VoiceRoomSettings {
    muteOnEntry: boolean;
    allowRecording: boolean;
    maxDuration: number;
    musicMode: boolean;
    noiseSuppression: boolean;
    echoCancellation: boolean;
}
export interface VoiceRoom {
    id: string;
    name: string;
    type: RoomType;
    createdBy: string;
    createdAt: Date;
    participantCount: number;
    maxParticipants: number;
    isFull: boolean;
    settings: VoiceRoomSettings;
}
export interface Participant {
    id: string;
    agentId: string;
    socketId: string;
    joinedAt: Date;
    role: ParticipantRole;
    isMuted?: boolean;
    isDeafened?: boolean;
    isSpeaking?: boolean;
    speakingStartedAt?: Date;
}
export type ParticipantRole = 'owner' | 'moderator' | 'participant';
export interface VoiceParticipant extends Participant {
    isMuted: boolean;
    isDeafened: boolean;
    isSpeaking: boolean;
    speakingStartedAt?: Date;
}
export interface SignalingMessage {
    type: SignalingMessageType;
    roomId: string;
    from: string;
    to?: string;
    payload: any;
}
export type SignalingMessageType = 'offer' | 'answer' | 'candidate' | 'candidate-end' | 'renegotiate';
export interface RTCSessionDescriptionInit {
    type: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
}
export interface RTCIceCandidateInit {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string;
}
export interface JoinRoomPayload {
    roomId: string;
    token: string;
}
export interface LeaveRoomPayload {
    roomId: string;
}
export interface OfferPayload {
    roomId: string;
    target: string;
    sdp: RTCSessionDescriptionInit;
}
export interface AnswerPayload {
    roomId: string;
    target: string;
    sdp: RTCSessionDescriptionInit;
}
export interface CandidatePayload {
    roomId: string;
    target: string;
    candidate: RTCIceCandidateInit;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface RoomListResponse {
    rooms: Room[];
    total: number;
}
export interface RoomDetailsResponse {
    room: Room;
    participants: Participant[];
}
export interface JwtPayload {
    agentId: string;
    iat: number;
    exp: number;
}
export interface AuthenticatedSocket {
    agentId: string;
    agentName?: string;
    roles?: string[];
}
export interface ServerConfig {
    port: number;
    redisUrl?: string;
    jwtSecret: string;
    corsOrigin: string;
    heartbeatInterval: number;
    roomTimeout: number;
    maxParticipants: number;
}
export interface SignalingEvents {
    'room:created': (room: Room) => void;
    'room:deleted': (roomId: string) => void;
    'participant:joined': (roomId: string, participant: Participant) => void;
    'participant:left': (roomId: string, participantId: string) => void;
    'signal:offer': (data: {
        roomId: string;
        from: string;
        to: string;
        sdp: any;
    }) => void;
    'signal:answer': (data: {
        roomId: string;
        from: string;
        to: string;
        sdp: any;
    }) => void;
    'signal:candidate': (data: {
        roomId: string;
        from: string;
        to: string;
        candidate: any;
    }) => void;
}
//# sourceMappingURL=index.d.ts.map