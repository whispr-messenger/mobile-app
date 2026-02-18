/**
 * AudioCallScreen - Écran d'appel audio avec interface moderne
 * Affiche l'interface complète pour les appels audio entrants et sortants
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import CallService, { Call, CallState } from '../../services/calls/CallService';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { colors } from '../../theme/colors';
import { Avatar } from '../../components/Chat/Avatar';
import { useTheme } from '../../context/ThemeContext';

type AudioCallScreenRouteProp = RouteProp<AuthStackParamList, 'AudioCall'>;
type AudioCallScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'AudioCall'>;

const { width, height } = Dimensions.get('window');

export const AudioCallScreen: React.FC = () => {
  const route = useRoute<AudioCallScreenRouteProp>();
  const navigation = useNavigation<AudioCallScreenNavigationProp>();
  const { callId, participant, direction, conversationId } = route.params;
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const callService = CallService.getInstance();
  const [call, setCall] = useState<Call | null>(null);
  const [duration, setDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<string>('');

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('[AudioCallScreen] Mounted with params:', { callId, participant, direction });

    // Trouver l'appel actuel
    const currentCall = callService.getCurrentCall();
    if (currentCall && currentCall.id === callId) {
      setCall(currentCall);
      updateCallStatus(currentCall.state);
    }

    // Écouter les changements d'état
    const handleCallStateChanged = (updatedCall: Call) => {
      if (updatedCall.id === callId) {
        console.log('[AudioCallScreen] Call state changed:', updatedCall.state);
        setCall(updatedCall);
        updateCallStatus(updatedCall.state);

        // Si l'appel est terminé, naviguer en arrière après un délai
        if (updatedCall.state === 'ended' || updatedCall.state === 'rejected' || updatedCall.state === 'failed') {
          setTimeout(() => {
            navigation.goBack();
          }, 2000);
        }
      }
    };

    callService.on('callStateChanged', handleCallStateChanged);

    // Animation de pulsation pour l'état "ringing"
    if (call?.state === 'ringing') {
      startPulseAnimation();
    }

    // Animation d'entrée
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();

    return () => {
      callService.removeListener('callStateChanged', handleCallStateChanged);
    };
  }, [callId, navigation, callService]);

  useEffect(() => {
    // Timer pour la durée de l'appel
    let interval: NodeJS.Timeout | null = null;
    if (call?.state === 'connected' && call.startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - call.startTime!.getTime()) / 1000);
        setDuration(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [call?.state, call?.startTime]);

  const updateCallStatus = (state: CallState) => {
    switch (state) {
      case 'initiating':
        setCallStatus('Appel en cours...');
        break;
      case 'ringing':
        setCallStatus(direction === 'outgoing' ? 'Sonnerie en cours...' : 'Appel entrant');
        break;
      case 'connecting':
        setCallStatus('Connexion...');
        break;
      case 'connected':
        setCallStatus('En communication');
        break;
      case 'ended':
        setCallStatus('Appel terminé');
        break;
      case 'rejected':
        setCallStatus('Appel rejeté');
        break;
      case 'failed':
        setCallStatus('Échec de l\'appel');
        break;
      default:
        setCallStatus('');
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleAccept = async () => {
    console.log('[AudioCallScreen] Accepting call');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await callService.acceptCall(callId);
    } catch (error) {
      console.error('[AudioCallScreen] Error accepting call:', error);
    }
  };

  const handleReject = () => {
    console.log('[AudioCallScreen] Rejecting call');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    callService.rejectCall(callId);
    navigation.goBack();
  };

  const handleEndCall = () => {
    console.log('[AudioCallScreen] Ending call');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    callService.endCall(callId);
    navigation.goBack();
  };

  const handleToggleMute = () => {
    console.log('[AudioCallScreen] Toggling mute');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      callService.toggleMute();
      setCall(callService.getCurrentCall());
    } catch (error) {
      console.error('[AudioCallScreen] Error toggling mute:', error);
    }
  };

  const handleToggleSpeaker = () => {
    console.log('[AudioCallScreen] Toggling speaker');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      callService.toggleSpeaker();
      setCall(callService.getCurrentCall());
    } catch (error) {
      console.error('[AudioCallScreen] Error toggling speaker:', error);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isRinging = call?.state === 'ringing';
  const isConnected = call?.state === 'connected';
  const showControls = isConnected || call?.state === 'connecting';

  return (
    <LinearGradient
      colors={themeColors.background.gradient}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: slideAnim,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header avec bouton retour (seulement si pas en communication) */}
          {!isConnected && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                if (call?.state === 'ringing' && direction === 'outgoing') {
                  handleEndCall();
                } else {
                  navigation.goBack();
                }
              }}
            >
              <Ionicons name="close" size={28} color={colors.text.light} />
            </TouchableOpacity>
          )}

          {/* Avatar avec animation de pulsation */}
          <View style={styles.avatarContainer}>
            <Animated.View
              style={[
                styles.avatarWrapper,
                {
                  transform: [{ scale: isRinging ? pulseAnim : 1 }],
                },
              ]}
            >
              <Avatar
                size={120}
                name={participant.displayName}
                avatarUrl={participant.avatarUrl}
              />
              {isRinging && (
                <View style={styles.ringingIndicator}>
                  <View style={styles.ringingDot} />
                  <View style={[styles.ringingDot, { animationDelay: '0.2s' }]} />
                  <View style={[styles.ringingDot, { animationDelay: '0.4s' }]} />
                </View>
              )}
            </Animated.View>
          </View>

          {/* Nom du participant */}
          <Text style={styles.participantName}>{participant.displayName}</Text>

          {/* Statut de l'appel */}
          <Text style={styles.callStatus}>{callStatus}</Text>

          {/* Durée de l'appel */}
          {isConnected && duration > 0 && (
            <Text style={styles.duration}>{formatDuration(duration)}</Text>
          )}

          {/* Indicateurs de connexion */}
          {isConnected && (
            <View style={styles.connectionIndicators}>
              <View style={styles.connectionDot} />
              <Text style={styles.connectionText}>Connecté</Text>
            </View>
          )}

          {/* Contrôles principaux */}
          <View style={styles.controlsContainer}>
            {direction === 'incoming' && call?.state === 'ringing' && (
              <>
                <TouchableOpacity
                  style={[styles.controlButton, styles.rejectButton]}
                  onPress={handleReject}
                >
                  <Ionicons name="call" size={28} color={colors.text.light} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.controlButton, styles.acceptButton]}
                  onPress={handleAccept}
                >
                  <Ionicons name="call" size={28} color={colors.text.light} />
                </TouchableOpacity>
              </>
            )}

            {showControls && (
              <>
                {/* Bouton Mute */}
                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    styles.secondaryButton,
                    call?.isMuted && styles.activeButton,
                  ]}
                  onPress={handleToggleMute}
                >
                  <Ionicons
                    name={call?.isMuted ? 'mic-off' : 'mic'}
                    size={24}
                    color={call?.isMuted ? colors.ui.error : colors.text.light}
                  />
                </TouchableOpacity>

                {/* Bouton Speaker */}
                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    styles.secondaryButton,
                    call?.isSpeakerOn && styles.activeButton,
                  ]}
                  onPress={handleToggleSpeaker}
                >
                  <Ionicons
                    name={call?.isSpeakerOn ? 'volume-high' : 'volume-low'}
                    size={24}
                    color={colors.text.light}
                  />
                </TouchableOpacity>

                {/* Bouton Raccrocher */}
                <TouchableOpacity
                  style={[styles.controlButton, styles.endCallButton]}
                  onPress={handleEndCall}
                >
                  <Ionicons name="call" size={28} color={colors.text.light} />
                </TouchableOpacity>
              </>
            )}

            {direction === 'outgoing' && call?.state === 'ringing' && (
              <TouchableOpacity
                style={[styles.controlButton, styles.endCallButton]}
                onPress={handleEndCall}
              >
                <Ionicons name="call" size={28} color={colors.text.light} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  avatarContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  ringingIndicator: {
    position: 'absolute',
    top: -10,
    right: -10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ringingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
    marginHorizontal: 2,
  },
  participantName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.light,
    marginBottom: 8,
    textAlign: 'center',
  },
  callStatus: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    textAlign: 'center',
  },
  duration: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.light,
    marginTop: 8,
  },
  connectionIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ui.success,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 64,
    gap: 24,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  secondaryButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  acceptButton: {
    backgroundColor: colors.ui.success,
  },
  rejectButton: {
    backgroundColor: colors.ui.error,
    transform: [{ rotate: '135deg' }],
  },
  endCallButton: {
    backgroundColor: colors.ui.error,
  },
  activeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});
