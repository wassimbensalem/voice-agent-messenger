/**
 * Type definitions for WebRTC Signaling Server
 */

// Room Types
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

// Base room settings (generic)
export interface RoomSettings {
  muteOnEntry: boolean;
  allowRecording: boolean;
  maxDuration: number; // in minutes
}

// Voice-specific room settings (extends base)
export interface VoiceRoomSettings {
  muteOnEntry: boolean;
  allowRecording: boolean;
  maxDuration: number; // in minutes
  musicMode: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
}

// Voice room response type
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

// Participant Types
export interface Participant {
  id: string;
  agentId: string;
  socketId: string;
  joinedAt: Date;
  role: ParticipantRole;
  // Optional voice state properties
  isMuted?: boolean;
  isDeafened?: boolean;
  isSpeaking?: boolean;
  speakingStartedAt?: Date;
}

export type ParticipantRole = 'owner' | 'moderator' | 'participant';

// Voice-specific participant with audio state
export interface VoiceParticipant extends Participant {
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  speakingStartedAt?: Date;
}

// Signaling Message Types
export interface SignalingMessage {
  type: SignalingMessageType;
  roomId: string;
  from: string;
  to?: string;
  payload: any;
}

export type SignalingMessageType = 
  | 'offer' 
  | 'answer' 
  | 'candidate' 
  | 'candidate-end'
  | 'renegotiate';

// WebRTC SDP and ICE types (compatible with both browser and Node.js)
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

// WebSocket Event Payloads
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

// API Response Types
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

// Authentication Types
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

// Configuration Types
export interface ServerConfig {
  port: number;
  redisUrl?: string;
  jwtSecret: string;
  corsOrigin: string;
  heartbeatInterval: number;
  roomTimeout: number;
  maxParticipants: number;
}

// Event Emitter Types
export interface SignalingEvents {
  'room:created': (room: Room) => void;
  'room:deleted': (roomId: string) => void;
  'participant:joined': (roomId: string, participant: Participant) => void;
  'participant:left': (roomId: string, participantId: string) => void;
  'signal:offer': (data: { roomId: string; from: string; to: string; sdp: any }) => void;
  'signal:answer': (data: { roomId: string; from: string; to: string; sdp: any }) => void;
  'signal:candidate': (data: { roomId: string; from: string; to: string; candidate: any }) => void;
}
