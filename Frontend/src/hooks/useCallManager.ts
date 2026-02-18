/**
 * useCallManager - Hook pour gérer les appels audio/vidéo
 * Gère l'état global des appels et la navigation vers les écrans d'appel
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import CallService, { Call, CallState } from '../services/calls/CallService';
import { AuthStackParamList } from '../navigation/AuthNavigator';
import AuthService from '../services/AuthService';

type NavigationProp = StackNavigationProp<AuthStackParamList>;

export const useCallManager = () => {
  const navigation = useNavigation<NavigationProp>();
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const callService = CallService.getInstance();

  useEffect(() => {
    console.log('[useCallManager] Setting up call listeners');

    // Écouter les changements d'état des appels
    const handleCallStateChanged = (call: Call) => {
      console.log('[useCallManager] Call state changed:', call.state, call.id);
      setCurrentCall(call);

      // Naviguer vers l'écran d'appel si nécessaire
      if (call.state === 'connected' || call.state === 'ringing' || call.state === 'connecting') {
        navigation.navigate('AudioCall', {
          callId: call.id,
          participant: call.participant,
          direction: call.direction,
          conversationId: call.conversationId,
        });
      }
    };

    // Écouter les appels entrants
    const handleIncomingCall = (call: Call) => {
      console.log('[useCallManager] Incoming call received:', call.id);
      setIncomingCall(call);
      setCurrentCall(call);
    };

    // Écouter la fin des appels
    const handleCallEnded = (call: Call) => {
      console.log('[useCallManager] Call ended:', call.id);
      setCurrentCall(prev => prev?.id === call.id ? null : prev);
      setIncomingCall(prev => prev?.id === call.id ? null : prev);
    };

    // Écouter les erreurs d'appel
    const handleCallFailed = (call: Call, error: string) => {
      console.error('[useCallManager] Call failed:', call.id, error);
      setCurrentCall(prev => prev?.id === call.id ? null : prev);
      setIncomingCall(prev => prev?.id === call.id ? null : prev);
    };

    callService.on('callStateChanged', handleCallStateChanged);
    callService.on('incomingCall', handleIncomingCall);
    callService.on('callEnded', handleCallEnded);
    callService.on('callFailed', handleCallFailed);

    return () => {
      callService.removeListener('callStateChanged', handleCallStateChanged);
      callService.removeListener('incomingCall', handleIncomingCall);
      callService.removeListener('callEnded', handleCallEnded);
      callService.removeListener('callFailed', handleCallFailed);
    };
  }, [navigation]); // Retirer currentCall et incomingCall des dépendances pour éviter les re-renders

  const initiateCall = useCallback(async (
    participant: { id: string; displayName: string; avatarUrl?: string; username?: string },
    type: 'audio' | 'video' = 'audio',
    conversationId?: string
  ) => {
    try {
      console.log('[useCallManager] Initiating call to:', participant.id);
      const call = await callService.initiateOutgoingCall(participant, type, conversationId);
      return call;
    } catch (error: any) {
      console.error('[useCallManager] Error initiating call:', error);
      throw error;
    }
  }, [callService]);

  const acceptCall = useCallback(async (callId: string) => {
    try {
      console.log('[useCallManager] Accepting call:', callId);
      await callService.acceptCall(callId);
      setIncomingCall(null);
    } catch (error: any) {
      console.error('[useCallManager] Error accepting call:', error);
      throw error;
    }
  }, [callService]);

  const rejectCall = useCallback((callId: string) => {
    console.log('[useCallManager] Rejecting call:', callId);
    callService.rejectCall(callId);
    setIncomingCall(null);
  }, [callService]);

  const endCall = useCallback((callId?: string) => {
    console.log('[useCallManager] Ending call:', callId);
    callService.endCall(callId);
    setCurrentCall(null);
  }, [callService]);

  return {
    currentCall,
    incomingCall,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    callService,
  };
};
