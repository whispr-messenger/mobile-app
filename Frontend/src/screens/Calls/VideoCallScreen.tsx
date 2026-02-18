/**
 * VideoCallScreen - Écran d'appel vidéo avec interface premium
 * Affiche l'interface complète pour les appels vidéo avec vue locale et distante
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
  Image,
  PanResponder,
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

type VideoCallScreenRouteProp = RouteProp<AuthStackParamList, 'VideoCall'>;
type VideoCallScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'VideoCall'>;

const { width, height } = Dimensions.get('window');
const LOCAL_VIDEO_SIZE = 120;
const LOCAL_VIDEO_MARGIN = 20;

export const VideoCallScreen: React.FC = () => {
  const route = useRoute<VideoCallScreenRouteProp>();
  const navigation = useNavigation<VideoCallScreenNavigationProp>();
  const { callId, participant, direction, conversationId } = route.params;
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const callService = CallService.getInstance();
  const [call, setCall] = useState<Call | null>(null);
  const [duration, setDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<string>('');
  const [isLocalVideoFullscreen, setIsLocalVideoFullscreen] = useState(false);

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const localVideoScale = useRef(new Animated.Value(1)).current;
  const localVideoPosition = useRef(new Animated.ValueXY({
    x: width - LOCAL_VIDEO_SIZE - LOCAL_VIDEO_MARGIN,
    y: LOCAL_VIDEO_MARGIN + (Platform.OS === 'ios' ? 50 : 20),
  })).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim1 = useRef(new Animated.Value(0)).current;
  const ringAnim2 = useRef(new Animated.Value(0)).current;
  const ringAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('[VideoCallScreen] Mounted with params:', { callId, participant, direction });

    // Trouver l'appel actuel
    const currentCall = callService.getCurrentCall();
    if (currentCall && currentCall.id === callId) {
      setCall(currentCall);
      updateCallStatus(currentCall.state);
    }

    // Écouter les changements d'état
    const handleCallStateChanged = (updatedCall: Call) => {
      if (updatedCall.id === callId) {
        console.log('[VideoCallScreen] Call state changed:', updatedCall.state, 'video:', updatedCall.isVideoEnabled);
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

    // Les contrôles restent toujours visibles

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
    
    if (isRinging) {
      startRingingAnimations();
      startPulseAnimation();
    } else {
      stopRingingAnimations();
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
          toValue: 1.1,
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

  const startRingingAnimations = () => {
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

  // Les contrôles restent toujours visibles et accessibles

  const handleAccept = async () => {
    console.log('[VideoCallScreen] Accepting call');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await callService.acceptCall(callId);
    } catch (error) {
      console.error('[VideoCallScreen] Error accepting call:', error);
    }
  };

  const handleReject = () => {
    console.log('[VideoCallScreen] Rejecting call');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    callService.rejectCall(callId);
    navigation.goBack();
  };

  const handleEndCall = () => {
    console.log('[VideoCallScreen] Ending call');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    callService.endCall(callId);
    navigation.goBack();
  };

  const handleToggleMute = () => {
    console.log('[VideoCallScreen] Toggling mute, current state:', call?.isMuted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const newMutedState = callService.toggleMute();
      const updatedCall = callService.getCurrentCall();
      if (updatedCall) {
        setCall({ ...updatedCall });
      }
      console.log('[VideoCallScreen] Mute toggled to:', newMutedState);
    } catch (error) {
      console.error('[VideoCallScreen] Error toggling mute:', error);
    }
  };

  const handleToggleVideo = () => {
    console.log('[VideoCallScreen] Toggling video, current state:', call?.isVideoEnabled);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const newVideoState = callService.toggleVideo();
      const updatedCall = callService.getCurrentCall();
      if (updatedCall) {
        setCall({ ...updatedCall });
      }
      console.log('[VideoCallScreen] Video toggled to:', newVideoState);
    } catch (error) {
      console.error('[VideoCallScreen] Error toggling video:', error);
    }
  };

  const handleToggleSpeaker = () => {
    console.log('[VideoCallScreen] Toggling speaker, current state:', call?.isSpeakerOn);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const newSpeakerState = callService.toggleSpeaker();
      const updatedCall = callService.getCurrentCall();
      if (updatedCall) {
        setCall({ ...updatedCall });
      }
      console.log('[VideoCallScreen] Speaker toggled to:', newSpeakerState);
    } catch (error) {
      console.error('[VideoCallScreen] Error toggling speaker:', error);
    }
  };

  const handleSwitchCamera = () => {
    console.log('[VideoCallScreen] Switching camera');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const success = callService.switchCamera();
      if (success) {
        console.log('[VideoCallScreen] Camera switched successfully');
      } else {
        console.log('[VideoCallScreen] Camera switch not available (demo mode)');
      }
    } catch (error) {
      console.error('[VideoCallScreen] Error switching camera:', error);
    }
  };

  const handleLocalVideoPress = () => {
    // Animation de scale pour feedback
    Animated.sequence([
      Animated.timing(localVideoScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(localVideoScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Switcher entre vue locale et distante (comme WhatsApp)
    setIsLocalVideoFullscreen(!isLocalVideoFullscreen);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // PanResponder pour glisser la vidéo locale
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        localVideoPosition.setOffset({
          x: (localVideoPosition.x as any)._value,
          y: (localVideoPosition.y as any)._value,
        });
        localVideoPosition.setValue({ x: 0, y: 0 });
        // Animation de scale au début du drag
        Animated.spring(localVideoScale, {
          toValue: 1.1,
          useNativeDriver: true,
          tension: 100,
          friction: 7,
        }).start();
      },
      onPanResponderMove: (evt, gestureState) => {
        const newX = gestureState.dx;
        const newY = gestureState.dy;
        
        // Limiter le mouvement dans les bounds de l'écran
        const maxX = width - LOCAL_VIDEO_SIZE - LOCAL_VIDEO_MARGIN;
        const maxY = height - LOCAL_VIDEO_SIZE - 120; // 120 pour laisser de la place pour les contrôles
        const minX = LOCAL_VIDEO_MARGIN;
        const minY = LOCAL_VIDEO_MARGIN + (Platform.OS === 'ios' ? 50 : 20);
        
        const boundedX = Math.max(minX, Math.min(maxX, newX));
        const boundedY = Math.max(minY, Math.min(maxY, newY));
        
        localVideoPosition.setValue({ x: boundedX, y: boundedY });
      },
      onPanResponderRelease: (evt, gestureState) => {
        localVideoPosition.flattenOffset();
        
        // Animation de scale à la fin du drag
        Animated.spring(localVideoScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 7,
        }).start();
        
        // Si le mouvement était très petit, considérer comme un clic pour switcher
        if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
          handleLocalVideoPress();
        }
      },
    })
  ).current;

  const isRinging = call?.state === 'ringing';
  const isConnected = call?.state === 'connected';
  const showVideoControls = isConnected || call?.state === 'connecting';

  return (
    <View style={styles.container}>
      {/* Vue vidéo distante (plein écran) */}
      <View style={styles.remoteVideoContainer}>
        {isConnected && call?.isVideoEnabled && !isLocalVideoFullscreen ? (
          // En mode démo, on affiche un placeholder avec gradient (vue distante)
          <LinearGradient
            colors={themeColors.background.gradient}
            style={styles.remoteVideo}
          >
            <Avatar
              size={200}
              name={participant.displayName}
              uri={participant.avatarUrl}
            />
          </LinearGradient>
        ) : isConnected && isLocalVideoFullscreen ? (
          // Vue locale en plein écran (switch)
          <LinearGradient
            colors={themeColors.background.gradient}
            style={styles.remoteVideo}
          >
            {call?.isVideoEnabled ? (
              <View style={styles.localVideoFullscreen}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
                  style={styles.localVideoGradientFullscreen}
                >
                  <Text style={styles.localVideoLabelFullscreen}>Vous</Text>
                </LinearGradient>
              </View>
            ) : (
              <Avatar
                size={200}
                name="Vous"
                uri={undefined}
              />
            )}
          </LinearGradient>
        ) : (
          // Pendant ringing/connecting, afficher avatar avec animations
          <LinearGradient
            colors={themeColors.background.gradient}
            style={styles.remoteVideo}
          >
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

            <Animated.View
              style={[
                styles.avatarWrapper,
                {
                  transform: [{ scale: isRinging ? pulseAnim : 1 }],
                },
              ]}
            >
              <Avatar
                size={200}
                name={participant.displayName}
                uri={participant.avatarUrl}
              />
            </Animated.View>

            {!isLocalVideoFullscreen && (
              <>
                <Text style={styles.participantName}>{participant.displayName}</Text>
                <Text style={styles.callStatus}>{callStatus}</Text>
              </>
            )}
            {isLocalVideoFullscreen && (
              <>
                <Text style={styles.participantName}>Vous</Text>
                <Text style={styles.callStatus}>{callStatus}</Text>
              </>
            )}
          </LinearGradient>
        )}
      </View>

      {/* Vue vidéo locale (overlay) */}
      {showVideoControls && (
        <Animated.View
          style={[
            styles.localVideoContainer,
            {
              transform: [
                { translateX: localVideoPosition.x },
                { translateY: localVideoPosition.y },
                { scale: localVideoScale },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLocalVideoPress}
            style={styles.localVideoTouchable}
          >
            {isLocalVideoFullscreen ? (
              // Afficher la vue distante en petit (Bill Gates)
              <View style={styles.localVideoPlaceholder}>
                {call?.isVideoEnabled ? (
                  <LinearGradient
                    colors={themeColors.background.gradient}
                    style={styles.localVideoSmall}
                  >
                    <Avatar
                      size={LOCAL_VIDEO_SIZE - 20}
                      name={participant.displayName}
                      uri={participant.avatarUrl}
                    />
                  </LinearGradient>
                ) : (
                  <>
                    <Avatar
                      size={LOCAL_VIDEO_SIZE}
                      name={participant.displayName}
                      uri={participant.avatarUrl}
                    />
                    <View style={styles.localVideoBadge}>
                      <Ionicons name="videocam-off" size={16} color={colors.text.light} />
                    </View>
                  </>
                )}
              </View>
            ) : call?.isVideoEnabled ? (
              // Vue locale normale avec vidéo
              <View style={styles.localVideo}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
                  style={styles.localVideoGradient}
                >
                  <Text style={styles.localVideoLabel}>Vous</Text>
                </LinearGradient>
              </View>
            ) : (
              // Vue locale sans vidéo - afficher avatar au lieu du rond noir
              <View style={styles.localVideoPlaceholder}>
                <Avatar
                  size={LOCAL_VIDEO_SIZE}
                  name="Vous"
                  uri={undefined}
                />
                <View style={styles.localVideoBadge}>
                  <Ionicons name="videocam-off" size={16} color={colors.text.light} />
                </View>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Overlay avec contrôles */}
      <Animated.View
        style={styles.overlay}
        pointerEvents="auto"
      >
        <View style={styles.overlayTouchable}>
          <SafeAreaView style={styles.safeArea}>
            {/* Header avec info */}
            <Animated.View
              style={[
                styles.header,
                {
                  opacity: slideAnim,
                  transform: [
                    {
                      translateY: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-50, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
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

              {isConnected && (
                <View style={styles.headerInfo}>
                  <Text style={styles.participantNameHeader}>{participant.displayName}</Text>
                  {duration > 0 && (
                    <Text style={styles.durationHeader}>{formatDuration(duration)}</Text>
                  )}
                </View>
              )}
            </Animated.View>

            {/* Contrôles principaux en bas */}
            <Animated.View
              style={[
                styles.controlsContainer,
                {
                  opacity: slideAnim,
                  transform: [
                    {
                      translateY: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [100, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
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
                    <Ionicons name="videocam" size={28} color={colors.text.light} />
                  </TouchableOpacity>
                </>
              )}

              {showVideoControls && (
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

                  {/* Bouton Vidéo */}
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      styles.secondaryButton,
                      !call?.isVideoEnabled && styles.activeButton,
                    ]}
                    onPress={handleToggleVideo}
                  >
                    <Ionicons
                      name={call?.isVideoEnabled ? 'videocam' : 'videocam-off'}
                      size={24}
                      color={call?.isVideoEnabled ? colors.text.light : colors.ui.error}
                    />
                  </TouchableOpacity>

                  {/* Bouton Switch Camera */}
                  {call?.isVideoEnabled && (
                    <TouchableOpacity
                      style={[styles.controlButton, styles.secondaryButton]}
                      onPress={handleSwitchCamera}
                    >
                      <Ionicons name="camera-reverse" size={24} color={colors.text.light} />
                    </TouchableOpacity>
                  )}

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
            </Animated.View>
          </SafeAreaView>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  remoteVideoContainer: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  remoteVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  remoteVideoLabel: {
    position: 'absolute',
    bottom: 100,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  localVideoContainer: {
    position: 'absolute',
    width: LOCAL_VIDEO_SIZE,
    height: LOCAL_VIDEO_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary.main,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 100,
    left: 0,
    top: 0,
  },
  localVideoTouchable: {
    flex: 1,
  },
  localVideo: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  localVideoGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
  },
  localVideoLabel: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: '600',
  },
  localVideoPlaceholder: {
    flex: 1,
    backgroundColor: colors.background.dark,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 12,
  },
  localVideoSmall: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  localVideoFullscreen: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background.dark,
  },
  localVideoGradientFullscreen: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  localVideoLabelFullscreen: {
    color: colors.text.light,
    fontSize: 18,
    fontWeight: '600',
  },
  localVideoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  overlayTouchable: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  headerInfo: {
    alignItems: 'center',
  },
  participantNameHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.light,
    marginBottom: 4,
  },
  durationHeader: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  avatarWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: colors.primary.main,
    zIndex: 1,
  },
  participantName: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.light,
    marginTop: 32,
    marginBottom: 8,
    textAlign: 'center',
  },
  callStatus: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
    textAlign: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 20,
    gap: 20,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
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
