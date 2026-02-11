/**
 * WebRTC Voice Client Types
 * Core type definitions for the WebRTC voice agent client library
 */

/**
 * Configuration for the WebRTC voice client
 */
export interface WebRTCVoiceClientConfig {
  /** Signaling server URL */
  signalingUrl: string;
  /** Agent-Link authentication token */
  agentLinkToken?: string;
  /** Agent ID for identification */
  agentId: string;
  /** Room ID to join */
  roomId?: string;
  /** ICE server configuration */
  iceServers?: RTCIceServer[];
  /** WebSocket connection options */
  socketOptions?: {
    /** Reconnection attempts */
    reconnectionAttempts?: number;
    /** Reconnection delay */
    reconnectionDelay?: number;
    /** Connection timeout */
    timeout?: number;
  };
  /** Audio configuration */
  audioConfig?: {
    /** Sample rate for audio processing */
    sampleRate?: number;
    /** Channel count */
    channels?: number;
    /** Echo cancellation */
    echoCancellation?: boolean;
    /** Noise suppression */
    noiseSuppression?: boolean;
    /** Auto gain control */
    autoGainControl?: boolean;
  };
  /** Whisper STT configuration */
  sttConfig?: {
    /** Whisper server URL */
    serverUrl: string;
    /** Language code */
    language?: string;
    /** Enable partial results */
    enablePartialResults?: boolean;
  };
  /** Piper TTS configuration */
  ttsConfig?: {
    /** Piper server URL */
    serverUrl: string;
    /** Voice model */
    voice?: string;
    /** Output sample rate */
    outputSampleRate?: number;
  };
}

/**
 * Room participant information
 */
export interface RoomParticipant {
  /** Unique participant ID */
  id: string;
  /** Agent ID */
  agentId: string;
  /** Socket ID */
  socketId: string;
  /** Whether participant is audio enabled */
  audioEnabled: boolean;
  /** Join timestamp */
  joinedAt: Date;
}

/**
 * Room information
 */
export interface VoiceRoom {
  /** Unique room ID */
  roomId: string;
  /** Room name */
  name: string;
  /** Room type */
  type: 'voice' | 'video';
  /** Maximum participants */
  maxParticipants: number;
  /** Current participants */
  participants: RoomParticipant[];
  /** Room creator */
  createdBy: string;
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Signaling event types
 */
export type SignalingEventType =
  | 'connected'
  | 'authenticated'
  | 'auth_error'
  | 'room_joined'
  | 'room_users'
  | 'user_joined'
  | 'user_left'
  | 'offer'
  | 'answer'
  | 'candidate'
  | 'disconnected'
  | 'error';

/**
 * Signaling event data
 */
export interface SignalingEvent {
  type: SignalingEventType;
  data?: unknown;
  error?: string;
}

/**
 * SDP offer/answer message
 */
export interface SDPMessage {
  /** Sender's agent ID */
  from: string;
  /** Sender's socket ID */
  fromSocketId: string;
  /** SDP content */
  sdp: RTCSessionDescriptionInit;
}

/**
 * ICE candidate message
 */
export interface ICECandidateMessage {
  /** Sender's agent ID */
  from: string;
  /** Sender's socket ID */
  fromSocketId: string;
  /** ICE candidate */
  candidate: RTCIceCandidateInit;
}

/**
 * Connection state
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

/**
 * Audio processing configuration
 */
export interface AudioProcessingConfig {
  /** Input audio context */
  inputContext: AudioContext;
  /** Output audio context */
  outputContext: AudioContext;
  /** Media stream constraints */
  constraints: MediaStreamConstraints;
}

/**
 * Transcript result from STT
 */
export interface TranscriptResult {
  /** Transcribed text */
  text: string;
  /** Whether this is a partial result */
  isPartial: boolean;
  /** Timestamp */
  timestamp: Date;
  /** Confidence score */
  confidence?: number;
}

/**
 * TTS input for speech synthesis
 */
export interface TTSInput {
  /** Text to synthesize */
  text: string;
  /** Voice ID (optional) */
  voiceId?: string;
  /** Speaking rate */
  rate?: number;
  /** Pitch */
  pitch?: number;
  /** Volume */
  volume?: number;
}

/**
 * Audio buffer with metadata
 */
export interface AudioBuffer {
  /** PCM audio data */
  data: Float32Array;
  /** Sample rate */
  sampleRate: number;
  /** Channel count */
  channels: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Client events that can be subscribed to
 */
export type ClientEventType =
  | 'state_changed'
  | 'room_joined'
  | 'room_left'
  | 'user_joined'
  | 'user_left'
  | 'transcript'
  | 'speech_start'
  | 'speech_end'
  | 'audio_input'
  | 'audio_output'
  | 'error'
  | 'disconnected';

/**
 * Event callback type
 */
export type EventCallback<T = unknown> = (data: T) => void;

/**
 * Error details
 */
export interface ClientError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Original error */
  originalError?: Error;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Join room options
 */
export interface JoinRoomOptions {
  /** Room ID to join */
  roomId: string;
  /** Whether to enable audio on join */
  audioEnabled?: boolean;
  /** Metadata to send to room */
  metadata?: Record<string, unknown>;
}

/**
 * Leave room options
 */
export interface LeaveRoomOptions {
  /** Reason for leaving */
  reason?: string;
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  /** Message type */
  type: 'offer' | 'answer' | 'candidate' | 'data';
  /** Message payload */
  payload: unknown;
  /** Target participant ID (optional, broadcast if not specified) */
  targetId?: string;
}
