/**
 * WebRTC Peer Connection Manager
 * Handles WebRTC peer connections for voice/audio communication
 */

import { EventEmitter } from 'events';
import type {
  WebRTCVoiceClientConfig,
  SDPMessage,
  ICECandidateMessage,
  RoomParticipant,
  AudioBuffer,
  ClientError,
} from '../types';

/**
 * Peer connection information
 */
interface PeerInfo {
  peerConnection: RTCPeerConnection;
  agentId: string;
  socketId: string;
  audioEnabled: boolean;
  dataChannel?: RTCDataChannel;
}

/**
 * WebRTC Peer Connection Manager
 */
export class PeerConnectionManager extends EventEmitter {
  private config: WebRTCVoiceClientConfig;
  private peers: Map<string, PeerInfo> = new Map();
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: AudioWorkletNode | null = null;
  private iceCandidateQueue: Map<string, RTCIceCandidateInit[]> = new Map();

  constructor(config: WebRTCVoiceClientConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize the peer connection manager
   */
  async initialize(): Promise<void> {
    // Create audio context for processing
    this.audioContext = new AudioContext({
      sampleRate: this.config.audioConfig?.sampleRate || 48000,
    });

    console.log('[PeerConnectionManager] Initialized with audio context');
  }

  /**
   * Set local media stream (microphone input)
   */
  async setLocalStream(stream: MediaStream): Promise<void> {
    this.localStream = stream;
    
    // Add tracks to all existing peer connections
    for (const [socketId, peer] of this.peers) {
      stream.getTracks().forEach((track) => {
        peer.peerConnection.addTrack(track, stream);
      });
    }

    console.log('[PeerConnectionManager] Local stream set:', stream.id);
  }

  /**
   * Create a peer connection for a new participant
   */
  async createPeerConnection(participant: RoomParticipant): Promise<RTCPeerConnection> {
    const peerConnection = this.createRTCPeerConnection();
    
    const peerInfo: PeerInfo = {
      peerConnection,
      agentId: participant.agentId,
      socketId: participant.socketId,
      audioEnabled: participant.audioEnabled,
    };

    // Set up ICE candidate handling
    this.setupICECandidateHandler(peerConnection, participant.socketId);

    // Set up track handler
    this.setupTrackHandler(peerConnection, participant);

    // Create data channel for additional communication
    this.setupDataChannel(peerInfo);

    // Add local stream tracks if available
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    this.peers.set(participant.socketId, peerInfo);
    console.log('[PeerConnectionManager] Created peer connection for:', participant.agentId);

    return peerConnection;
  }

  /**
   * Create an offer for a peer
   */
  async createOffer(socketId: string): Promise<RTCSessionDescriptionInit | null> {
    const peer = this.peers.get(socketId);
    if (!peer) {
      console.warn('[PeerConnectionManager] No peer found for socket:', socketId);
      return null;
    }

    try {
      const offer = await peer.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      await peer.peerConnection.setLocalDescription(offer);
      
      console.log('[PeerConnectionManager] Created offer for:', socketId);
      return offer;
    } catch (error) {
      console.error('[PeerConnectionManager] Error creating offer:', error);
      this.emitError('OFFER_FAILED', 'Failed to create offer', error as Error);
      return null;
    }
  }

  /**
   * Handle received offer from remote peer
   */
  async handleOffer(message: SDPMessage): Promise<RTCSessionDescriptionInit | null> {
    let peer = this.peers.get(message.fromSocketId);

    if (!peer) {
      // Create new peer connection if it doesn't exist
      peer = {
        peerConnection: this.createRTCPeerConnection(),
        agentId: message.from,
        socketId: message.fromSocketId,
        audioEnabled: true,
      };

      this.setupICECandidateHandler(peer.peerConnection, message.fromSocketId);
      this.setupTrackHandler(peer.peerConnection, {
        id: message.fromSocketId,
        agentId: message.from,
        socketId: message.fromSocketId,
        audioEnabled: true,
        joinedAt: new Date(),
      });
      this.setupDataChannel(peer);

      // Add local stream tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          peer!.peerConnection.addTrack(track, this.localStream!);
        });
      }

      this.peers.set(message.fromSocketId, peer);
    }

    try {
      await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));

      // Process queued ICE candidates
      const queuedCandidates = this.iceCandidateQueue.get(message.fromSocketId) || [];
      for (const candidate of queuedCandidates) {
        await peer.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.iceCandidateQueue.delete(message.fromSocketId);

      const answer = await peer.peerConnection.createAnswer();
      await peer.peerConnection.setLocalDescription(answer);

      console.log('[PeerConnectionManager] Handled offer from:', message.from);
      return answer;
    } catch (error) {
      console.error('[PeerConnectionManager] Error handling offer:', error);
      this.emitError('OFFER_HANDLING_FAILED', 'Failed to handle offer', error as Error);
      return null;
    }
  }

  /**
   * Handle received answer from remote peer
   */
  async handleAnswer(message: SDPMessage): Promise<void> {
    const peer = this.peers.get(message.fromSocketId);
    if (!peer) {
      console.warn('[PeerConnectionManager] No peer found for answer from:', message.from);
      return;
    }

    try {
      await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));

      // Process queued ICE candidates
      const queuedCandidates = this.iceCandidateQueue.get(message.fromSocketId) || [];
      for (const candidate of queuedCandidates) {
        await peer.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.iceCandidateQueue.delete(message.fromSocketId);

      console.log('[PeerConnectionManager] Handled answer from:', message.from);
    } catch (error) {
      console.error('[PeerConnectionManager] Error handling answer:', error);
      this.emitError('ANSWER_HANDLING_FAILED', 'Failed to handle answer', error as Error);
    }
  }

  /**
   * Handle received ICE candidate from remote peer
   */
  async handleCandidate(message: ICECandidateMessage): Promise<void> {
    const peer = this.peers.get(message.fromSocketId);
    
    if (peer) {
      try {
        await peer.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        console.log('[PeerConnectionManager] Added ICE candidate from:', message.from);
      } catch (error) {
        console.error('[PeerConnectionManager] Error adding ICE candidate:', error);
      }
    } else {
      // Queue the candidate if peer connection not ready
      const queue = this.iceCandidateQueue.get(message.fromSocketId) || [];
      queue.push(message.candidate);
      this.iceCandidateQueue.set(message.fromSocketId, queue);
      console.log('[PeerConnectionManager] Queued ICE candidate for:', message.from);
    }
  }

  /**
   * Remove a peer connection
   */
  removePeer(socketId: string): void {
    const peer = this.peers.get(socketId);
    if (peer) {
      peer.peerConnection.close();
      peer.dataChannel?.close();
      this.peers.delete(socketId);
      this.iceCandidateQueue.delete(socketId);
      console.log('[PeerConnectionManager] Removed peer:', socketId);
    }
  }

  /**
   * Remove all peer connections
   */
  removeAllPeers(): void {
    for (const [socketId, peer] of this.peers) {
      peer.peerConnection.close();
      peer.dataChannel?.close();
    }
    this.peers.clear();
    this.iceCandidateQueue.clear();
    console.log('[PeerConnectionManager] Removed all peers');
  }

  /**
   * Get audio stream from a specific peer
   */
  getRemoteAudioStream(socketId: string): MediaStream | null {
    const peer = this.peers.get(socketId);
    if (!peer) return null;

    const receiver = peer.peerConnection.getReceivers().find((r) => r.track?.kind === 'audio');
    return receiver?.track ? new MediaStream([receiver.track]) : null;
  }

  /**
   * Get all remote audio streams
   */
  getAllRemoteAudioStreams(): MediaStream[] {
    const streams: MediaStream[] = [];
    
    for (const peer of this.peers.values()) {
      const receivers = peer.peerConnection.getReceivers();
      for (const receiver of receivers) {
        if (receiver.track?.kind === 'audio') {
          streams.push(new MediaStream([receiver.track]));
        }
      }
    }

    return streams;
  }

  /**
   * Send data to a specific peer
   */
  sendData(socketId: string, data: unknown): boolean {
    const peer = this.peers.get(socketId);
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') {
      console.warn('[PeerConnectionManager] Data channel not ready for:', socketId);
      return false;
    }

    try {
      peer.dataChannel.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[PeerConnectionManager] Error sending data:', error);
      return false;
    }
  }

  /**
   * Broadcast data to all peers
   */
  broadcastData(data: unknown): void {
    for (const [socketId] of this.peers) {
      this.sendData(socketId, data);
    }
  }

  /**
   * Set audio enabled/disabled for a peer
   */
  setPeerAudioEnabled(socketId: string, enabled: boolean): void {
    const peer = this.peers.get(socketId);
    if (peer) {
      peer.audioEnabled = enabled;
      
      // Enable/disable audio tracks
      const transceivers = peer.peerConnection.getTransceivers();
      for (const transceiver of transceivers) {
        if (transceiver.sender.track?.kind === 'audio') {
          transceiver.sender.track.enabled = enabled;
        }
      }
    }
  }

  /**
   * Get list of connected peer socket IDs
   */
  getPeerSocketIds(): string[] {
    return Array.from(this.peers.keys());
  }

  /**
   * Get peer information by socket ID
   */
  getPeerInfo(socketId: string): PeerInfo | undefined {
    return this.peers.get(socketId);
  }

  /**
   * Get all peer information
   */
  getAllPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.removeAllPeers();
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.localStream = null;
    console.log('[PeerConnectionManager] Destroyed');
  }

  /**
   * Create an RTC peer connection with configured ICE servers
   */
  private createRTCPeerConnection(): RTCPeerConnection {
    const config: RTCConfiguration = {
      iceServers: this.config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    };

    const peerConnection = new RTCPeerConnection(config);

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('[PeerConnectionManager] Connection state:', peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'failed') {
        this.emitError('PEER_CONNECTION_FAILED', 'Peer connection failed', undefined);
      } else if (peerConnection.connectionState === 'disconnected') {
        this.emit('peer_disconnected', { socketId: '' }); // Will be handled per peer
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log('[PeerConnectionManager] ICE state:', peerConnection.iceConnectionState);
    };

    // Handle ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
      console.log('[PeerConnectionManager] ICE gathering state:', peerConnection.iceGatheringState);
    };

    return peerConnection;
  }

  /**
   * Set up ICE candidate handler
   */
  private setupICECandidateHandler(peerConnection: RTCPeerConnection, socketId: string): void {
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('ice_candidate', {
          candidate: event.candidate.toJSON(),
          socketId,
        });
      }
    };
  }

  /**
   * Set up track handler for receiving remote media
   */
  private setupTrackHandler(peerConnection: RTCPeerConnection, participant: RoomParticipant): void {
    peerConnection.ontrack = (event) => {
      console.log('[PeerConnectionManager] Received track from:', participant.agentId);
      
      // Create media stream from remote track
      const stream = new MediaStream([event.track]);
      
      this.emit('remote_track', {
        socketId: participant.socketId,
        agentId: participant.agentId,
        stream,
        track: event.track,
      });
    };
  }

  /**
   * Set up data channel for peer communication
   */
  private setupDataChannel(peerInfo: PeerInfo): void {
    const dataChannel = peerInfo.peerConnection.createDataChannel('data', {
      ordered: true,
    });

    dataChannel.onopen = () => {
      console.log('[PeerConnectionManager] Data channel opened for:', peerInfo.agentId);
      this.emit('data_channel_open', { socketId: peerInfo.socketId, agentId: peerInfo.agentId });
    };

    dataChannel.onclose = () => {
      console.log('[PeerConnectionManager] Data channel closed for:', peerInfo.agentId);
      this.emit('data_channel_close', { socketId: peerInfo.socketId, agentId: peerInfo.agentId });
    };

    dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('data_channel_message', {
          socketId: peerInfo.socketId,
          agentId: peerInfo.agentId,
          data,
        });
      } catch (error) {
        console.error('[PeerConnectionManager] Error parsing data channel message:', error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error('[PeerConnectionManager] Data channel error:', error);
    };

    peerInfo.dataChannel = dataChannel;

    // Set up handler for incoming data channels
    peerInfo.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      
      channel.onopen = () => {
        this.emit('data_channel_open', { socketId: peerInfo.socketId, agentId: peerInfo.agentId });
      };

      channel.onclose = () => {
        this.emit('data_channel_close', { socketId: peerInfo.socketId, agentId: peerInfo.agentId });
      };

      channel.onmessage = (msgEvent) => {
        try {
          const data = JSON.parse(msgEvent.data);
          this.emit('data_channel_message', {
            socketId: peerInfo.socketId,
            agentId: peerInfo.agentId,
            data,
          });
        } catch (error) {
          console.error('[PeerConnectionManager] Error parsing data channel message:', error);
        }
      };
    };
  }

  /**
   * Emit an error event
   */
  private emitError(code: string, message: string, originalError?: Error): void {
    const error: ClientError = {
      code,
      message,
      originalError,
      timestamp: new Date(),
    };
    this.emit('error', error);
  }
}
