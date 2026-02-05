/**
 * CameraCapture - Integrated camera component with preview and caption
 * WHISPR-266: Caméra intégrée dans le chat
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { colors, withOpacity } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

export interface CameraCaptureResult {
  uri: string;
  type: 'image' | 'video';
  caption?: string;
}

interface CameraCaptureProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (result: CameraCaptureResult) => void;
  allowVideo?: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  visible,
  onClose,
  onCapture,
  allowVideo = true,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const [capturedMedia, setCapturedMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [caption, setCaption] = useState('');
  const [cameraType, setCameraType] = useState<'back' | 'front'>('back');

  // Request camera permissions
  const requestCameraPermissions = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Nous avons besoin de votre permission pour accéder à la caméra.'
      );
      return false;
    }
    return true;
  }, []);

  // Handle photo capture
  const handleTakePhoto = useCallback(async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
        cameraType: cameraType === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCapturedMedia({
          uri: result.assets[0].uri,
          type: 'image',
        });
      }
    } catch (error: any) {
      console.error('[CameraCapture] Error taking photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [cameraType, requestCameraPermissions]);

  // Handle video capture
  const handleTakeVideo = useCallback(async () => {
    if (!allowVideo) return;

    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.9,
        cameraType: cameraType === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCapturedMedia({
          uri: result.assets[0].uri,
          type: 'video',
        });
      }
    } catch (error: any) {
      console.error('[CameraCapture] Error taking video:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la vidéo.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [allowVideo, cameraType, requestCameraPermissions]);

  // Toggle camera (front/back)
  const handleToggleCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCameraType((prev) => (prev === 'back' ? 'front' : 'back'));
  }, []);

  // Retake photo/video
  const handleRetake = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCapturedMedia(null);
    setCaption('');
  }, []);

  // Confirm and send
  const handleConfirm = useCallback(() => {
    if (!capturedMedia) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCapture({
      uri: capturedMedia.uri,
      type: capturedMedia.type,
      caption: caption.trim() || undefined,
    });
    
    // Reset state
    setCapturedMedia(null);
    setCaption('');
    onClose();
  }, [capturedMedia, caption, onCapture, onClose]);

  // Cancel
  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCapturedMedia(null);
    setCaption('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
              {capturedMedia ? 'Prévisualisation' : 'Caméra'}
            </Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={themeColors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Preview or Camera Controls */}
          {capturedMedia ? (
            <View style={styles.previewContainer}>
              {capturedMedia.type === 'image' ? (
                <Image source={{ uri: capturedMedia.uri }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewVideo, { backgroundColor: withOpacity(themeColors.primary, 0.2) }]}>
                  <Ionicons name="videocam" size={64} color={themeColors.primary} />
                  <Text style={[styles.videoLabel, { color: themeColors.text.secondary }]}>
                    Vidéo capturée
                  </Text>
                </View>
              )}

              {/* Caption input */}
              <View style={styles.captionContainer}>
                <TextInput
                  style={[styles.captionInput, { 
                    color: themeColors.text.primary,
                    backgroundColor: withOpacity(themeColors.text.secondary, 0.1),
                  }]}
                  placeholder="Ajouter une légende..."
                  placeholderTextColor={themeColors.text.tertiary}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={200}
                />
              </View>

              {/* Action buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.retakeButton, { backgroundColor: withOpacity(themeColors.text.secondary, 0.1) }]}
                  onPress={handleRetake}
                >
                  <Ionicons name="refresh" size={20} color={themeColors.text.secondary} />
                  <Text style={[styles.retakeButtonText, { color: themeColors.text.secondary }]}>
                    Reprendre
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendButton, { backgroundColor: themeColors.primary }]}
                  onPress={handleConfirm}
                >
                  <Ionicons name="send" size={20} color={colors.text.light} />
                  <Text style={[styles.sendButtonText, { color: colors.text.light }]}>
                    Envoyer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.cameraControls}>
              {/* Camera type toggle */}
              <TouchableOpacity
                style={styles.toggleCameraButton}
                onPress={handleToggleCamera}
              >
                <Ionicons
                  name="camera-reverse"
                  size={24}
                  color={themeColors.text.primary}
                />
              </TouchableOpacity>

              {/* Capture buttons */}
              <View style={styles.captureButtons}>
                <TouchableOpacity
                  style={[styles.captureButton, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}
                  onPress={handleTakePhoto}
                >
                  <Ionicons name="camera" size={32} color={themeColors.primary} />
                  <Text style={[styles.captureButtonText, { color: themeColors.primary }]}>
                    Photo
                  </Text>
                </TouchableOpacity>

                {allowVideo && (
                  <TouchableOpacity
                    style={[styles.captureButton, { backgroundColor: withOpacity(themeColors.secondary, 0.1) }]}
                    onPress={handleTakeVideo}
                  >
                    <Ionicons name="videocam" size={32} color={themeColors.secondary} />
                    <Text style={[styles.captureButtonText, { color: themeColors.secondary }]}>
                      Vidéo
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    paddingBottom: spacing.base * 2,
    maxHeight: '90%',
    ...shadows.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    ...typography.h3,
    fontWeight: '600',
  },
  closeButton: {
    padding: spacing.small,
  },
  cameraControls: {
    padding: spacing.base * 2,
    alignItems: 'center',
  },
  toggleCameraButton: {
    alignSelf: 'flex-end',
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  captureButtons: {
    flexDirection: 'row',
    gap: spacing.base,
    width: '100%',
  },
  captureButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base * 2,
    borderRadius: borderRadius.medium,
    gap: spacing.small,
  },
  captureButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  previewContainer: {
    padding: spacing.base,
  },
  previewImage: {
    width: '100%',
    height: 400,
    borderRadius: borderRadius.medium,
    resizeMode: 'contain',
  },
  previewVideo: {
    width: '100%',
    height: 400,
    borderRadius: borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: {
    ...typography.body,
    marginTop: spacing.small,
  },
  captionContainer: {
    marginTop: spacing.base,
    marginBottom: spacing.base,
  },
  captionInput: {
    ...typography.body,
    padding: spacing.base,
    borderRadius: borderRadius.medium,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.medium,
    gap: spacing.small,
  },
  retakeButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.medium,
    gap: spacing.small,
  },
  sendButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
});
