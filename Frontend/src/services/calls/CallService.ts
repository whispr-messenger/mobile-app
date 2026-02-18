/**
 * CallService - Service centralisé pour gérer les appels audio/vidéo WebRTC
 * Gère l'établissement des connexions, le signaling via WebSocket, et les états des appels
 */

import AuthService from '../AuthService';

// Import conditionnel de react-native-webrtc (non disponible dans Expo Go)
let mediaDevices: any = null;
let RTCPeerConnection: any = null;
let RTCSessionDescription: any = null;
let RTCIceCandidate: any = null;
let MediaStream: any = null;

try {
  const webrtc = require('react-native-webrtc');
  mediaDevices = webrtc.mediaDevices;
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  MediaStream = webrtc.MediaStream;
  console.log('[CallService] react-native-webrtc loaded successfully');
} catch (error) {
  console.log('[CallService] react-native-webrtc not available, using demo mode');
  // En mode démo, on crée des classes mock pour éviter les erreurs
  RTCPeerConnection = class MockRTCPeerConnection {
    constructor() {}
    createOffer() { return Promise.resolve({ type: 'offer', sdp: '' }); }
    createAnswer() { return Promise.resolve({ type: 'answer', sdp: '' }); }
    setLocalDescription() { return Promise.resolve(); }
    setRemoteDescription() { return Promise.resolve(); }
    addIceCandidate() { return Promise.resolve(); }
    addTrack() {}
    onicecandidate = null;
    ontrack = null;
    onconnectionstatechange = null;
    close() {}
  };
  RTCSessionDescription = class MockRTCSessionDescription {
    constructor(init: any) {}
  };
  RTCIceCandidate = class MockRTCIceCandidate {
    constructor(init: any) {}
  };
}

/**
 * Simple EventEmitter implementation for React Native
 * (Node.js 'events' module is not available in React Native)
 */
class EventEmitter {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, listener: Function): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.listeners.get(event);
    if (listeners && listeners.length > 0) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`[EventEmitter] Error in listener for event "${event}":`, error);
        }
      });
      return true;
    }
    return false;
  }

  removeListener(event: string, listener: Function): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}

export type CallState = 'idle' | 'initiating' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'rejected' | 'failed';
export type CallDirection = 'incoming' | 'outgoing';
export type CallType = 'audio' | 'video';

export interface CallParticipant {
  id: string;
  displayName: string;
  avatarUrl?: string;
  username?: string;
}

export interface Call {
  id: string;
  conversationId?: string;
  participant: CallParticipant;
  direction: CallDirection;
  type: CallType;
  state: CallState;
  startTime?: Date;
  endTime?: Date;
  duration?: number; // en secondes
  isMuted: boolean;
  isSpeakerOn: boolean;
  isVideoEnabled: boolean;
}

interface CallServiceEvents {
  callStateChanged: (call: Call) => void;
  incomingCall: (call: Call) => void;
  callEnded: (call: Call) => void;
  callFailed: (call: Call, error: string) => void;
}

declare interface CallService {
  on<U extends keyof CallServiceEvents>(event: U, listener: CallServiceEvents[U]): this;
  emit<U extends keyof CallServiceEvents>(event: U, ...args: Parameters<CallServiceEvents[U]>): boolean;
}

class CallService extends EventEmitter {
  private currentCall: Call | null = null;
  private calls: Map<string, Call> = new Map();
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signalingChannel: any = null; // WebSocket channel pour le signaling

  private static instance: CallService;

  private constructor() {
    super();
    console.log('[CallService] Initialized');
  }

  static getInstance(): CallService {
    if (!CallService.instance) {
      CallService.instance = new CallService();
    }
    return CallService.instance;
  }

  /**
   * Initialise le service avec le WebSocket pour le signaling
   */
  initializeSignaling(socket: any, userId: string): void {
    console.log('[CallService] Initializing signaling with socket for user:', userId);
    
    if (!socket) {
      console.warn('[CallService] No socket provided, signaling will not work');
      return;
    }

    // Créer un channel dédié aux appels
    this.signalingChannel = socket.channel(`calls:${userId}`);
    this.signalingChannel.join().then(() => {
      console.log('[CallService] Joined calls channel');

      // Écouter les événements de signaling sur le channel calls
      this.signalingChannel.on('call_offer', (data: any) => {
        console.log('[CallService] Received call offer on calls channel:', data);
        this.handleIncomingCall(data);
      });

      this.signalingChannel.on('call_answer', (data: any) => {
        console.log('[CallService] Received call answer:', data);
        this.handleCallAnswer(data);
      });

      this.signalingChannel.on('ice_candidate', (data: any) => {
        console.log('[CallService] Received ICE candidate:', data);
        this.handleIceCandidate(data);
      });

      this.signalingChannel.on('call_end', (data: any) => {
        console.log('[CallService] Received call end:', data);
        this.handleCallEnd(data);
      });

      // Écouter aussi sur le user channel pour les appels entrants
      const userChannel = socket.channel(`user:${userId}`);
      userChannel.join().then(() => {
        userChannel.on('call_offer', (data: any) => {
          console.log('[CallService] Received call offer on user channel:', data);
          this.handleIncomingCall(data);
        });
      });
    }).catch((error: any) => {
      console.error('[CallService] Error joining calls channel:', error);
    });
  }

  /**
   * Initie un appel sortant
   */
  async initiateOutgoingCall(
    participant: CallParticipant,
    type: CallType = 'audio',
    conversationId?: string
  ): Promise<Call> {
    console.log('[CallService] Initiating outgoing call to:', participant.id, 'type:', type);

    if (this.currentCall && this.currentCall.state !== 'ended' && this.currentCall.state !== 'rejected') {
      throw new Error('Un appel est déjà en cours');
    }

    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const call: Call = {
      id: callId,
      conversationId,
      participant,
      direction: 'outgoing',
      type,
      state: 'initiating',
      isMuted: false,
      isSpeakerOn: false,
      isVideoEnabled: type === 'video',
    };

    this.currentCall = call;
    this.calls.set(callId, call);
    this.emit('callStateChanged', call);

    try {
      // Obtenir le stream local (peut être null en mode démo)
      await this.getLocalStream(type);
      
      // Créer la connexion peer
      await this.createPeerConnection();

      // Créer et envoyer l'offer
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Envoyer l'offer via WebSocket
      if (this.signalingChannel) {
        this.signalingChannel.push('call_offer', {
          call_id: callId,
          to_user_id: participant.id,
          offer: offer,
          type: type,
          conversation_id: conversationId,
        });
      }

      // Passer à l'état "ringing"
      call.state = 'ringing';
      this.emit('callStateChanged', call);

      console.log('[CallService] Outgoing call initiated successfully');
      return call;
    } catch (error: any) {
      console.error('[CallService] Error initiating call:', error);
      call.state = 'failed';
      this.emit('callFailed', call, error.message || 'Erreur lors de l\'initiation de l\'appel');
      throw error;
    }
  }

  /**
   * Reçoit un appel entrant
   */
  receiveIncomingCall(data: {
    call_id: string;
    from_user_id: string;
    from_display_name: string;
    from_avatar_url?: string;
    from_username?: string;
    offer: RTCSessionDescriptionInit;
    type: CallType;
    conversation_id?: string;
  }): Call {
    console.log('[CallService] Receiving incoming call:', data.call_id);

    if (this.currentCall && this.currentCall.state !== 'ended' && this.currentCall.state !== 'rejected') {
      // Rejeter automatiquement si un appel est déjà en cours
      this.rejectCall(data.call_id, 'Un appel est déjà en cours');
      throw new Error('Un appel est déjà en cours');
    }

    const call: Call = {
      id: data.call_id,
      conversationId: data.conversation_id,
      participant: {
        id: data.from_user_id,
        displayName: data.from_display_name,
        avatarUrl: data.from_avatar_url,
        username: data.from_username,
      },
      direction: 'incoming',
      type: data.type || 'audio',
      state: 'ringing',
      isMuted: false,
      isSpeakerOn: false,
      isVideoEnabled: data.type === 'video',
    };

    this.currentCall = call;
    this.calls.set(data.call_id, call);
    
    // Stocker l'offer pour plus tard si disponible
    if (data.offer) {
      (call as any).pendingOffer = data.offer;
    }

    // Émettre les événements
    this.emit('incomingCall', call);
    this.emit('callStateChanged', call);

    console.log('[CallService] Incoming call received and emitted');
    return call;
  }

  /**
   * Accepte un appel entrant
   */
  async acceptCall(callId: string): Promise<void> {
    console.log('[CallService] Accepting call:', callId);

    const call = this.calls.get(callId);
    if (!call || call.direction !== 'incoming') {
      throw new Error('Appel introuvable ou invalide');
    }

    try {
      call.state = 'connecting';
      this.emit('callStateChanged', call);

      // Obtenir le stream local (peut être null en mode démo)
      await this.getLocalStream(call.type);

      // Créer la connexion peer
      await this.createPeerConnection();

      // Appliquer l'offer reçue (si disponible)
      const offer = (call as any).pendingOffer;
      if (offer && this.peerConnection) {
        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        } catch (error) {
          console.log('[CallService] Error setting remote description (demo mode):', error);
          // En mode démo, on continue même si l'offer n'est pas valide
        }
      }

      // Créer et envoyer la réponse
      if (!this.peerConnection) {
        // En mode démo, on simule la connexion sans vraie peer connection
        call.state = 'connected';
        call.startTime = new Date();
        this.emit('callStateChanged', call);
        return;
      }
      
      try {
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
      } catch (error) {
        console.log('[CallService] Error creating answer (demo mode):', error);
        // En mode démo, on simule la connexion
        call.state = 'connected';
        call.startTime = new Date();
        this.emit('callStateChanged', call);
        return;
      }

      // Envoyer la réponse via WebSocket
      if (this.signalingChannel) {
        this.signalingChannel.push('call_answer', {
          call_id: callId,
          answer: answer,
        });
      }

      call.state = 'connected';
      call.startTime = new Date();
      this.emit('callStateChanged', call);

      console.log('[CallService] Call accepted successfully');
    } catch (error: any) {
      console.error('[CallService] Error accepting call:', error);
      call.state = 'failed';
      this.emit('callFailed', call, error.message || 'Erreur lors de l\'acceptation de l\'appel');
      throw error;
    }
  }

  /**
   * Rejette un appel entrant
   */
  rejectCall(callId: string, reason?: string): void {
    console.log('[CallService] Rejecting call:', callId, reason);

    const call = this.calls.get(callId);
    if (call) {
      call.state = 'rejected';
      call.endTime = new Date();
      this.emit('callStateChanged', call);
      this.emit('callEnded', call);
    }

    // Envoyer le rejet via WebSocket
    if (this.signalingChannel) {
      this.signalingChannel.push('call_reject', {
        call_id: callId,
        reason: reason || 'Rejeté par l\'utilisateur',
      });
    }

    this.cleanup();
  }

  /**
   * Termine un appel en cours
   */
  endCall(callId?: string): void {
    const callIdToEnd = callId || this.currentCall?.id;
    if (!callIdToEnd) {
      console.warn('[CallService] No call to end');
      return;
    }

    console.log('[CallService] Ending call:', callIdToEnd);

    const call = this.calls.get(callIdToEnd);
    if (call) {
      call.state = 'ended';
      call.endTime = new Date();
      if (call.startTime) {
        call.duration = Math.floor((call.endTime.getTime() - call.startTime.getTime()) / 1000);
      }
      this.emit('callStateChanged', call);
      this.emit('callEnded', call);
    }

    // Envoyer la fin d'appel via WebSocket
    if (this.signalingChannel && callIdToEnd) {
      console.log('[CallService] Sending call end via WebSocket');
      this.signalingChannel.push('call_end', {
        call_id: callIdToEnd,
      });
    } else if (callIdToEnd) {
      console.warn('[CallService] No signaling channel available, call end not sent');
    }

    this.cleanup();
  }

  /**
   * Active/désactive le micro
   */
  toggleMute(): boolean {
    if (!this.currentCall || !this.localStream) {
      return false;
    }

    const newMutedState = !this.currentCall.isMuted;
    this.currentCall.isMuted = newMutedState;

    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !newMutedState;
    });

    this.emit('callStateChanged', this.currentCall);
    console.log('[CallService] Mute toggled:', newMutedState);
    return newMutedState;
  }

  /**
   * Active/désactive le haut-parleur
   */
  toggleSpeaker(): boolean {
    if (!this.currentCall) {
      return false;
    }

    const newSpeakerState = !this.currentCall.isSpeakerOn;
    this.currentCall.isSpeakerOn = newSpeakerState;

    // Note: La gestion du haut-parleur nécessite une API native spécifique
    // Pour l'instant, on met juste à jour l'état
    // TODO: Implémenter avec react-native-webrtc ou expo-av

    this.emit('callStateChanged', this.currentCall);
    console.log('[CallService] Speaker toggled:', newSpeakerState);
    return newSpeakerState;
  }

  /**
   * Active/désactive la vidéo
   */
  toggleVideo(): boolean {
    if (!this.currentCall || !this.localStream) {
      return false;
    }

    const newVideoState = !this.currentCall.isVideoEnabled;
    this.currentCall.isVideoEnabled = newVideoState;

    this.localStream.getVideoTracks().forEach(track => {
      track.enabled = newVideoState;
    });

    this.emit('callStateChanged', this.currentCall);
    console.log('[CallService] Video toggled:', newVideoState);
    return newVideoState;
  }

  /**
   * Obtient l'appel en cours
   */
  getCurrentCall(): Call | null {
    return this.currentCall;
  }

  /**
   * Obtient le stream local
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Obtient le stream distant
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Gestionnaires privés
   */
  private async getLocalStream(type: CallType): Promise<void> {
    try {
      // Pour React Native, on utilise react-native-webrtc
      // En mode développement/démo, on simule l'accès au micro sans vraiment l'utiliser
      // En production, il faudra demander les permissions et utiliser le vrai stream
      
      const constraints: any = {
        audio: true,
        video: type === 'video' ? {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } : false,
      };

      // Vérifier si on est dans un environnement React Native
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        // Web environment
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } else if (mediaDevices && mediaDevices.getUserMedia) {
        // React Native environment
        this.localStream = await mediaDevices.getUserMedia(constraints);
      } else {
        // Mode démo - créer un stream vide pour permettre les tests UI
        console.log('[CallService] Demo mode: creating mock stream');
        // Pour l'instant, on laisse null et on continue sans stream réel
        // L'appel fonctionnera en mode simulation pour tester l'UI
        this.localStream = null;
      }
      
      console.log('[CallService] Local stream obtained');
    } catch (error: any) {
      console.error('[CallService] Error getting local stream:', error);
      // En mode démo, on continue sans stream pour permettre les tests UI
      console.log('[CallService] Continuing in demo mode without real stream');
      this.localStream = null;
      // Ne pas throw pour permettre les tests UI sans permissions réelles
      // throw new Error('Impossible d\'accéder au micro/caméra');
    }
  }

  private async createPeerConnection(): Promise<void> {
    if (!RTCPeerConnection) {
      console.log('[CallService] RTCPeerConnection not available, using demo mode');
      // En mode démo, on crée une connexion mock
      this.peerConnection = new (class MockRTCPeerConnection {
        constructor() {}
        createOffer() { return Promise.resolve({ type: 'offer', sdp: '' }); }
        createAnswer() { return Promise.resolve({ type: 'answer', sdp: '' }); }
        setLocalDescription() { return Promise.resolve(); }
        setRemoteDescription() { return Promise.resolve(); }
        addIceCandidate() { return Promise.resolve(); }
        addTrack() {}
        onicecandidate = null;
        ontrack = null;
        onconnectionstatechange = null;
        connectionState = 'connected';
        close() {}
      })() as any;
      return;
    }

    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    // Utiliser RTCPeerConnection de react-native-webrtc ou mock
    this.peerConnection = new RTCPeerConnection(configuration);

    // Ajouter le stream local
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Gérer les candidats ICE
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.signalingChannel && this.currentCall) {
        console.log('[CallService] Sending ICE candidate');
        this.signalingChannel.push('ice_candidate', {
          call_id: this.currentCall.id,
          candidate: event.candidate,
        });
      }
    };

    // Gérer le stream distant
    this.peerConnection.ontrack = (event) => {
      console.log('[CallService] Received remote stream');
      this.remoteStream = event.streams[0];
      this.emit('callStateChanged', this.currentCall!);
    };

    // Gérer les changements de connexion
    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection || !this.currentCall) return;

      console.log('[CallService] Connection state:', this.peerConnection.connectionState);

      if (this.peerConnection.connectionState === 'connected') {
        this.currentCall.state = 'connected';
        if (!this.currentCall.startTime) {
          this.currentCall.startTime = new Date();
        }
        this.emit('callStateChanged', this.currentCall);
      } else if (this.peerConnection.connectionState === 'failed' || this.peerConnection.connectionState === 'disconnected') {
        this.endCall();
      }
    };
  }

  private handleIncomingCall(data: any): void {
    this.receiveIncomingCall(data);
  }

  private async handleCallAnswer(data: { call_id: string; answer: RTCSessionDescriptionInit }): Promise<void> {
    if (!this.peerConnection || !this.currentCall || this.currentCall.id !== data.call_id) {
      return;
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      this.currentCall.state = 'connected';
      this.currentCall.startTime = new Date();
      this.emit('callStateChanged', this.currentCall);
    } catch (error) {
      console.error('[CallService] Error handling call answer:', error);
      // En mode démo, on simule la connexion même en cas d'erreur
      if (!this.localStream) {
        this.currentCall.state = 'connected';
        this.currentCall.startTime = new Date();
        this.emit('callStateChanged', this.currentCall);
      } else {
        this.endCall();
      }
    }
  }

  private async handleIceCandidate(data: { call_id: string; candidate: RTCIceCandidateInit }): Promise<void> {
    if (!this.peerConnection || !this.currentCall || this.currentCall.id !== data.call_id) {
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('[CallService] Error handling ICE candidate:', error);
      // En mode démo, on ignore les erreurs ICE
    }
  }

  private handleCallEnd(data: { call_id: string }): void {
    if (this.currentCall && this.currentCall.id === data.call_id) {
      this.endCall(data.call_id);
    }
  }

  private cleanup(): void {
    console.log('[CallService] Cleaning up');

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.currentCall = null;
  }
}

export default CallService;
