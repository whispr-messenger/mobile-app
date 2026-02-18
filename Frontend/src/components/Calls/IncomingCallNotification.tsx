/**
 * IncomingCallNotification - Notification pour les appels entrants
 * Affiche une notification modale pour les appels entrants avec options accepter/rejeter
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Call } from '../../services/calls/CallService';
import { colors } from '../../theme/colors';
import { Avatar } from '../Chat/Avatar';

const { width } = Dimensions.get('window');

interface IncomingCallNotificationProps {
  call: Call | null;
  visible: boolean;
  onAccept: (callId: string) => void;
  onReject: (callId: string) => void;
}

export const IncomingCallNotification: React.FC<IncomingCallNotificationProps> = ({
  call,
  visible,
  onAccept,
  onReject,
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible && call) {
      // Animation d'entrée
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Animation de pulsation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Vibration continue
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      // Animation de sortie
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, call]);

  if (!call || call.direction !== 'incoming') {
    return null;
  }

  const handleAccept = () => {
    console.log('[IncomingCallNotification] Accepting call:', call.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAccept(call.id);
  };

  const handleReject = () => {
    console.log('[IncomingCallNotification] Rejecting call:', call.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onReject(call.id);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={[colors.background.dark, colors.secondary.dark]}
            style={styles.gradient}
          >
            {/* Avatar avec animation */}
            <Animated.View
              style={[
                styles.avatarContainer,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Avatar
                size={80}
                name={call.participant.displayName}
                avatarUrl={call.participant.avatarUrl}
              />
            </Animated.View>

            {/* Informations */}
            <Text style={styles.name}>{call.participant.displayName}</Text>
            <Text style={styles.callType}>
              {call.type === 'video' ? 'Appel vidéo' : 'Appel audio'}
            </Text>

            {/* Boutons d'action */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={handleReject}
              >
                <Ionicons name="call" size={24} color={colors.text.light} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={handleAccept}
              >
                <Ionicons name="call" size={24} color={colors.text.light} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  gradient: {
    padding: 32,
    paddingBottom: 48,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 24,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.light,
    marginBottom: 8,
    textAlign: 'center',
  },
  callType: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 32,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: colors.ui.success,
  },
  rejectButton: {
    backgroundColor: colors.ui.error,
    transform: [{ rotate: '135deg' }],
  },
});
