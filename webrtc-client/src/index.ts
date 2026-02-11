/**
 * WebRTC Voice Client
 * Main client class for voice communication using WebRTC and signaling server
 */

import { EventEmitter } from 'events';
import type {
  WebRTCVoiceClientConfig,
  VoiceRoom,
  RoomParticipant,
  TranscriptResult,
  AudioBuffer,
  TTSInput,
  ConnectionState,
  JoinRoomOptions,
  LeaveRoomOptions,
  ClientError,
  ClientEventType,
  EventCallback,
} from './types';
import { SignalingClient } from './signaling/signaling-client';
import { PeerConnectionManager } from './peer-connection/peer-connection-manager';
import { WhisperSTTService } from './voice-pipeline/whisper-stt';
import { PiperTTSService } from './voice-pipeline/piper-tts';

/**
 * Main WebRTC Voice Client
 */
export class WebRTCVoiceClient extends EventEmitter {
  private config: WebRTCVoiceClientConfig;
  private signaling: SignalingClient;
  private peerManager: PeerConnectionManager;
  private sttService: WhisperSTTService;
  private ttsService: PiperTTSService;
  private localStream: MediaStream | null = null;
  private currentRoom: VoiceRoom | null = null;
  private isInitialized = false;
  private isAudioEnabled = true;

  constructor(config: WebRTCVoiceClientConfig) {
    super();
    this.config = config;
    this.signaling = new SignalingClient(config);
    this.peerManager = new PeerConnectionManager(config);
    this.sttService = new WhisperSTTService(config);
    this.ttsService = new PiperTTSService(config);

    this.setupSignalingHandlers();
    this.setupPeerHandlers();
  }

  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[WebRTCVoiceClient] Already initialized');
      return;
    }

    console.log('[WebRTCVoiceClient] Initializing...');

    // Initialize peer connection manager
    await this.peerManager.initialize();

    // Initialize TTS service
    await this.ttsService.initialize();

    // Set up local media stream
    await this.setupLocalStream();

    this.isInitialized = true;
    console.log('[WebRTCVoiceClient] Initialized');
  }

  /**
   * Connect to the signaling server
   */
  async connect(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.signaling.connect();
  }

  /**
   * Disconnect from the signaling server
   */
  disconnect(): void {
    if (this.currentRoom) {
      this.leaveRoom();
    }

    this.signaling.disconnect();
    this.peerManager.destroy();
    this.ttsService.destroy();
    this.stopLocalStream();

    this.isInitialized = false;
    console.log('[WebRTCVoiceClient] Disconnected');
  }

  /**
   * Join a voice room
   */
  async joinRoom(options: JoinRoomOptions): Promise<VoiceRoom | null> {
    if (!this.signaling.isConnected()) {
      throw new Error('Not connected to signaling server');
    }

    try {
      // Create offer for each existing participant
      const participants = this.currentRoom?.participants || [];
      
      for (const participant of participants) {
        const peerConnection = await this.peerManager.createPeerConnection(participant);
        const offer = await this.peerManager.createOffer(participant.socketId);
        
        if (offer) {
          this.signaling.sendOffer(offer);
        }
      }

      // Join the room
      this.signaling.joinRoom({
        roomId: options.roomId,
        audioEnabled: options.audioEnabled ?? this.isAudioEnabled,
        metadata: options.metadata,
      });

      return null; // Will be set when room_joined event is received
    } catch (error) {
      console.error('[WebRTCVoiceClient] Error joining room:', error);
      throw error;
    }
  }

  /**
   * Leave the current room
   */
  leaveRoom(options?: LeaveRoomOptions): void {
    if (this.currentRoom) {
      // Close all peer connections
      this.peerManager.removeAllPeers();
      
      // Leave room on signaling server
      this.signaling.leaveRoom(options?.reason);
      
      this.currentRoom = null;
      console.log('[WebRTCVoiceClient] Left room');
    }
  }

  /**
   * Start sending audio to peers
   */
  async enableAudio(): Promise<void> {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      this.isAudioEnabled = true;
      console.log('[WebRTCVoiceClient] Audio enabled');
    }
  }

  /**
   * Stop sending audio to peers
   */
  async disableAudio(): Promise<void> {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      this.isAudioEnabled = false;
      console.log('[WebRTCVoiceClient] Audio disabled');
    }
  }

  /**
   * Transcribe audio from the local microphone
   */
  async transcribeAudio(audioData: Float32Array, isFinal = false): Promise<TranscriptResult | null> {
    return await this.sttService.transcribeStream(audioData, isFinal);
  }

  /**
   * Synthesize and speak text
   */
  async speak(text: string, options?: Partial<TTSInput>): Promise<boolean> {
    const input: TTSInput = {
      text,
      voiceId: options?.voiceId,
      rate: options?.rate,
      pitch: options?.pitch,
      volume: options?.volume,
    };

    return await this.ttsService.speak(input);
  }

  /**
   * Get the current room
   */
  getCurrentRoom(): VoiceRoom | null {
    return this.currentRoom;
  }

  /**
   * Get the current connection state
   */
  getConnectionState(): ConnectionState {
    return this.signaling.getConnectionState();
  }

  /**
   * Get local audio stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get the agent ID
   */
  getAgentId(): string {
    return this.config.agentId;
  }

  /**
   * Subscribe to events
   */
  on<Event extends ClientEventType>(
    event: Event,
    callback: EventCallback
  ): this {
    return super.on(event, callback);
  }

  /**
   * Subscribe to events once
   */
  once<Event extends ClientEventType>(
    event: Event,
    callback: EventCallback
  ): this {
    return super.once(event, callback);
  }

  /**
   * Unsubscribe from events
   */
  off<Event extends ClientEventType>(
    event: Event,
    callback?: EventCallback
  ): this {
    if (callback) {
      return super.off(event, callback);
    }
    return this;
  }

  /**
   * Set up local media stream
   */
  private async setupLocalStream(): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: this.config.audioConfig?.echoCancellation ?? true,
        noiseSuppression: this.config.audioConfig?.noiseSuppression ?? true,
        autoGainControl: this.config.audioConfig?.autoGainControl ?? true,
        sampleRate: this.config.audioConfig?.sampleRate ?? 48000,
        channelCount: this.config.audioConfig?.channels ?? 1,
      },
      video: false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      await this.peerManager.setLocalStream(this.localStream);
      console.log('[WebRTCVoiceClient] Local stream obtained');
    } catch (error) {
      console.error('[WebRTCVoiceClient] Error getting local stream:', error);
      throw error;
    }
  }

  /**
   * Stop local media stream
   */
  private stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localStream = null;
    }
  }

  /**
   * Set up signaling event handlers
   */
  private setupSignalingHandlers(): void {
    // Connection state
    this.signaling.on('state_changed', (data) => {
      this.emit('state_changed', data);
    });

    // Room events
    this.signaling.on('room_joined', (room: VoiceRoom) => {
      this.currentRoom = room;
      this.emit('room_joined', room);
    });

    this.signaling.on('room_users', (participants: RoomParticipant[]) => {
      this.emit('room_users', participants);
    });

    this.signaling.on('user_joined', (participant: RoomParticipant) => {
      if (this.currentRoom) {
        this.currentRoom.participants.push(participant);
      }
      this.emit('user_joined', participant);

      // Create peer connection for new user
      this.handleUserJoined(participant);
    });

    this.signaling.on('user_left', (data: { participantId: string; agentId: string }) => {
      if (this.currentRoom) {
        this.currentRoom.participants = this.currentRoom.participants.filter(
          (p) => p.socketId !== data.participantId
        );
      }
      this.peerManager.removePeer(data.participantId);
      this.emit('user_left', data);
    });

    // Signaling events
    this.signaling.on('offer', async (message) => {
      await this.handleOffer(message);
    });

    this.signaling.on('answer', async (message) => {
      await this.handleAnswer(message);
    });

    this.signaling.on('candidate', async (message) => {
      await this.handleCandidate(message);
    });

    this.signaling.on('data', (data) => {
      this.emit('data', data);
    });

    this.signaling.on('error', (error: ClientError) => {
      this.emit('error', error);
    });

    this.signaling.on('disconnected', (data) => {
      this.emit('disconnected', data);
    });
  }

  /**
   * Set up peer connection event handlers
   */
  private setupPeerHandlers(): void {
    this.peerManager.on('remote_track', (data) => {
      this.emit('remote_track', data);
    });

    this.peerManager.on('ice_candidate', (data) => {
      this.signaling.sendCandidate(data.candidate, data.socketId);
    });

    this.peerManager.on('data_channel_message', (data) => {
      this.emit('data_channel_message', data);
    });

    this.peerManager.on('error', (error: ClientError) => {
      this.emit('error', error);
    });
  }

  /**
   * Handle new user joining
   */
  private async handleUserJoined(participant: RoomParticipant): Promise<void> {
    // Create peer connection
    await this.peerManager.createPeerConnection(participant);

    // Create and send offer
    const offer = await this.peerManager.createOffer(participant.socketId);
    if (offer) {
      this.signaling.sendOffer(offer);
    }
  }

  /**
   * Handle incoming offer
   */
  private async handleOffer(message: any): Promise<void> {
    const answer = await this.peerManager.handleOffer(message);
    if (answer) {
      this.signaling.sendAnswer(answer, message.fromSocketId);
    }
  }

  /**
   * Handle incoming answer
   */
  private async handleAnswer(message: any): Promise<void> {
    await this.peerManager.handleAnswer(message);
  }

  /**
   * Handle incoming ICE candidate
   */
  private async handleCandidate(message: any): Promise<void> {
    await this.peerManager.handleCandidate(message);
  }
}
