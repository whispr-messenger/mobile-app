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
  const ringAnim1 = useRef(new Animated.Value(0)).current;
  const ringAnim2 = useRef(new Animated.Value(0)).current;
  const ringAnim3 = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

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
        console.log('[AudioCallScreen] Call state changed:', updatedCall.state, 'muted:', updatedCall.isMuted, 'speaker:', updatedCall.isSpeakerOn);
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

  // Gérer les animations selon l'état de l'appel
  useEffect(() => {
    const isRinging = call?.state === 'ringing';
    const isConnecting = call?.state === 'connecting';
    
    if (isRinging || isConnecting) {
      startPulseAnimation();
      startRingingAnimations();
      startGlowAnimation();
    } else {
      stopRingingAnimations();
      stopGlowAnimation();
    }
  }, [call?.state]);

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
    pulseAnim.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startRingingAnimations = () => {
    // Cercle concentrique 1
    ringAnim1.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim1, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim1, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Cercle concentrique 2 (décalé)
    ringAnim2.setValue(0);
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim2, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim2, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, 400);

    // Cercle concentrique 3 (décalé)
    ringAnim3.setValue(0);
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim3, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim3, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, 800);
  };

  const stopRingingAnimations = () => {
    ringAnim1.stopAnimation();
    ringAnim2.stopAnimation();
    ringAnim3.stopAnimation();
    ringAnim1.setValue(0);
    ringAnim2.setValue(0);
    ringAnim3.setValue(0);
  };

  const startGlowAnimation = () => {
    glowAnim.setValue(0.5);
    // Utiliser useNativeDriver: true pour shadowOpacity car c'est supporté
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true, // shadowOpacity est supporté avec useNativeDriver
        }),
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopGlowAnimation = () => {
    glowAnim.stopAnimation();
    glowAnim.setValue(0);
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
    console.log('[AudioCallScreen] Toggling mute, current state:', call?.isMuted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const newMutedState = callService.toggleMute();
      // L'événement callStateChanged sera émis automatiquement et mettra à jour l'UI
      // Mais on force aussi la mise à jour immédiate pour être sûr
      const updatedCall = callService.getCurrentCall();
      if (updatedCall) {
        setCall({ ...updatedCall });
      }
      console.log('[AudioCallScreen] Mute toggled to:', newMutedState);
    } catch (error) {
      console.error('[AudioCallScreen] Error toggling mute:', error);
    }
  };

  const handleToggleSpeaker = () => {
    console.log('[AudioCallScreen] Toggling speaker, current state:', call?.isSpeakerOn);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const newSpeakerState = callService.toggleSpeaker();
      // L'événement callStateChanged sera émis automatiquement et mettra à jour l'UI
      // Mais on force aussi la mise à jour immédiate pour être sûr
      const updatedCall = callService.getCurrentCall();
      if (updatedCall) {
        setCall({ ...updatedCall });
      }
      console.log('[AudioCallScreen] Speaker toggled to:', newSpeakerState);
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

          {/* Avatar avec animations améliorées */}
          <View style={styles.avatarContainer}>
            {/* Cercles concentriques animés */}
            {isRinging && (
              <>
                <Animated.View
                  style={[
                    styles.ring,
                    {
                      opacity: ringAnim1.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.6, 0.3, 0],
                      }),
                      transform: [
                        {
                          scale: ringAnim1.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 2.5],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.ring,
                    {
                      opacity: ringAnim2.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.6, 0.3, 0],
                      }),
                      transform: [
                        {
                          scale: ringAnim2.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 2.5],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.ring,
                    {
                      opacity: ringAnim3.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.6, 0.3, 0],
                      }),
                      transform: [
                        {
                          scale: ringAnim3.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 2.5],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </>
            )}

            {/* Avatar avec glow effect */}
            <Animated.View
              style={[
                styles.avatarWrapper,
                {
                  transform: [{ scale: isRinging ? pulseAnim : 1 }],
                  shadowOpacity: isRinging
                    ? glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 0.8],
                      })
                    : 0.3,
                  shadowRadius: isRinging
                    ? glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 40],
                      })
                    : 20,
                },
              ]}
            >
              <Avatar
                size={120}
                name={participant.displayName}
                uri={participant.avatarUrl}
              />
              {isRinging && (
                <View style={styles.ringingIndicator}>
                  <Animated.View
                    style={[
                      styles.ringingDot,
                      {
                        opacity: pulseAnim.interpolate({
                          inputRange: [1, 1.15],
                          outputRange: [0.8, 1],
                        }),
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.ringingDot,
                      {
                        opacity: pulseAnim.interpolate({
                          inputRange: [1, 1.15],
                          outputRange: [0.6, 0.8],
                        }),
                        transform: [
                          {
                            translateX: pulseAnim.interpolate({
                              inputRange: [1, 1.15],
                              outputRange: [0, -8],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.ringingDot,
                      {
                        opacity: pulseAnim.interpolate({
                          inputRange: [1, 1.15],
                          outputRange: [0.4, 0.6],
                        }),
                        transform: [
                          {
                            translateX: pulseAnim.interpolate({
                              inputRange: [1, 1.15],
                              outputRange: [0, 8],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
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
    position: 'relative',
    width: 300,
    height: 300,
  },
  avatarWrapper: {
    position: 'relative',
    zIndex: 10,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.primary.main,
    top: '50%',
    left: '50%',
    marginTop: -60,
    marginLeft: -60,
    zIndex: 1,
  },
  ringingIndicator: {
    position: 'absolute',
    top: -15,
    right: -15,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  ringingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.main,
    marginHorizontal: 3,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
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
