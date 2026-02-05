/**
 * CameraCapture - Integrated camera component with preview and caption
 * WHISPR-266: Caméra intégrée dans le chat
 */

import React, { useState, useCallback, useEffect } from 'react';
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
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors, withOpacity } from '../../theme/colors';
import { typography, textStyles } from '../../theme/typography';
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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Log component lifecycle
  useEffect(() => {
    if (visible) {
      console.log('[CameraCapture] Modal opened');
      console.log('[CameraCapture] Camera type:', cameraType);
      console.log('[CameraCapture] Allow video:', allowVideo);
    } else {
      console.log('[CameraCapture] Modal closed');
    }
  }, [visible, cameraType, allowVideo]);

  // Request camera permissions
  const requestCameraPermissions = useCallback(async () => {
    console.log('[CameraCapture] Requesting camera permissions...');
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      console.log('[CameraCapture] Permission result:', JSON.stringify(permissionResult, null, 2));
      
      if (!permissionResult) {
        console.error('[CameraCapture] Permission result is null');
        Alert.alert('Erreur', 'Impossible de vérifier les permissions.');
        return false;
      }

      if (permissionResult.status !== 'granted') {
        console.warn('[CameraCapture] Permission denied:', permissionResult.status);
        Alert.alert(
          'Permission requise',
          'Nous avons besoin de votre permission pour accéder à la caméra.'
        );
        return false;
      }

      console.log('[CameraCapture] Permission granted');
      return true;
    } catch (error: any) {
      console.error('[CameraCapture] Error requesting permissions:', error);
      Alert.alert('Erreur', 'Erreur lors de la demande de permission.');
      return false;
    }
  }, []);

  // Handle photo capture
  const handleTakePhoto = useCallback(async () => {
    console.log('[CameraCapture] handleTakePhoto called');
    console.log('[CameraCapture] Current camera type:', cameraType);
    
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      console.log('[CameraCapture] Permission denied, aborting photo capture');
      return;
    }

    try {
      console.log('[CameraCapture] Launching camera for photo...');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: false,
        quality: 0.9,
        cameraType: cameraType === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      });

      console.log('[CameraCapture] Camera result:', {
        canceled: result.canceled,
        assetsCount: result.assets?.length || 0,
        hasAssets: !!result.assets && result.assets.length > 0,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('[CameraCapture] Photo captured successfully:', {
          uri: result.assets[0].uri.substring(0, 50) + '...',
          width: result.assets[0].width,
          height: result.assets[0].height,
          fileSize: result.assets[0].fileSize,
        });
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCapturedMedia({
          uri: result.assets[0].uri,
          type: 'image',
        });
        console.log('[CameraCapture] Preview state updated');
      } else {
        console.log('[CameraCapture] Photo capture canceled or no assets');
      }
    } catch (error: any) {
      console.error('[CameraCapture] Error taking photo:', error);
      console.error('[CameraCapture] Error details:', {
        message: error?.message,
        stack: error?.stack,
      });
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [cameraType, requestCameraPermissions]);

  // Handle video capture
  const handleTakeVideo = useCallback(async () => {
    if (!allowVideo) {
      console.log('[CameraCapture] Video not allowed, aborting');
      return;
    }

    console.log('[CameraCapture] handleTakeVideo called');
    console.log('[CameraCapture] Current camera type:', cameraType);
    
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      console.log('[CameraCapture] Permission denied, aborting video capture');
      return;
    }

    try {
      console.log('[CameraCapture] Launching camera for video...');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaType.Videos,
        allowsEditing: false,
        quality: 0.9,
        cameraType: cameraType === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        videoMaxDuration: 60, // 60 seconds max
      });

      console.log('[CameraCapture] Video result:', {
        canceled: result.canceled,
        assetsCount: result.assets?.length || 0,
        hasAssets: !!result.assets && result.assets.length > 0,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('[CameraCapture] Video captured successfully:', {
          uri: result.assets[0].uri.substring(0, 50) + '...',
          duration: result.assets[0].duration,
          fileSize: result.assets[0].fileSize,
        });
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCapturedMedia({
          uri: result.assets[0].uri,
          type: 'video',
        });
        console.log('[CameraCapture] Preview state updated');
      } else {
        console.log('[CameraCapture] Video capture canceled or no assets');
      }
    } catch (error: any) {
      console.error('[CameraCapture] Error taking video:', error);
      console.error('[CameraCapture] Error details:', {
        message: error?.message,
        stack: error?.stack,
      });
      Alert.alert('Erreur', 'Impossible d\'enregistrer la vidéo.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [allowVideo, cameraType, requestCameraPermissions]);

  // Toggle camera (front/back)
  const handleToggleCamera = useCallback(() => {
    const newType = cameraType === 'back' ? 'front' : 'back';
    console.log('[CameraCapture] Toggling camera from', cameraType, 'to', newType);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCameraType(newType);
  }, [cameraType]);

  // Retake photo/video
  const handleRetake = useCallback(() => {
    console.log('[CameraCapture] Retake requested');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCapturedMedia(null);
    setCaption('');
    console.log('[CameraCapture] Preview reset');
  }, []);

  // Handle caption input focus
  const handleCaptionFocus = useCallback(() => {
    console.log('[CameraCapture] Caption input focused');
    setIsKeyboardVisible(true);
  }, []);

  const handleCaptionBlur = useCallback(() => {
    console.log('[CameraCapture] Caption input blurred');
    setIsKeyboardVisible(false);
  }, []);

  // Handle caption change
  const handleCaptionChange = useCallback((text: string) => {
    console.log('[CameraCapture] Caption changed:', text.length, 'characters');
    setCaption(text);
  }, []);

  // Confirm and send
  const handleConfirm = useCallback(() => {
    if (!capturedMedia) {
      console.warn('[CameraCapture] Cannot confirm: no captured media');
      return;
    }

    console.log('[CameraCapture] Confirming capture:', {
      type: capturedMedia.type,
      hasCaption: !!caption && caption.trim().length > 0,
      captionLength: caption.trim().length,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCapture({
      uri: capturedMedia.uri,
      type: capturedMedia.type,
      caption: caption.trim() || undefined,
    });
    
    // Reset state
    console.log('[CameraCapture] Resetting state after confirmation');
    setCapturedMedia(null);
    setCaption('');
    onClose();
  }, [capturedMedia, caption, onCapture, onClose]);

  // Cancel
  const handleCancel = useCallback(() => {
    console.log('[CameraCapture] Cancel requested');
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
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={colors.background.gradient.app}
        style={styles.modalOverlay}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContent}>
            {/* Header with gradient */}
            <LinearGradient
              colors={[withOpacity(colors.primary.main, 0.2), 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <View style={styles.header}>
                <Text style={styles.headerTitle}>
                  {capturedMedia ? 'Prévisualisation' : 'Caméra'}
                </Text>
                <TouchableOpacity 
                  onPress={handleCancel} 
                  style={styles.closeButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color={colors.text.light} />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Preview or Camera Controls */}
              {capturedMedia ? (
                <View style={styles.previewContainer}>
                  {capturedMedia.type === 'image' ? (
                    <View style={styles.imageWrapper}>
                      <Image 
                        source={{ uri: capturedMedia.uri }} 
                        style={styles.previewImage}
                        resizeMode="contain"
                        onLoad={() => console.log('[CameraCapture] Preview image loaded')}
                        onError={(error) => console.error('[CameraCapture] Preview image error:', error)}
                      />
                    </View>
                  ) : (
                    <LinearGradient
                      colors={[withOpacity(colors.secondary.main, 0.3), withOpacity(colors.primary.main, 0.2)]}
                      style={styles.previewVideo}
                    >
                      <Ionicons name="videocam" size={64} color={colors.primary.main} />
                      <Text style={styles.videoLabel}>
                        Vidéo capturée
                      </Text>
                    </LinearGradient>
                  )}

                  {/* Caption input */}
                  <View style={styles.captionContainer}>
                    <TextInput
                      style={styles.captionInput}
                      placeholder="Ajouter une légende..."
                      placeholderTextColor={withOpacity(colors.text.light, 0.5)}
                      value={caption}
                      onChangeText={handleCaptionChange}
                      onFocus={handleCaptionFocus}
                      onBlur={handleCaptionBlur}
                      multiline
                      maxLength={200}
                      autoFocus={false}
                      returnKeyType="done"
                      blurOnSubmit={true}
                    />
                    <Text style={styles.captionCounter}>
                      {caption.length}/200
                    </Text>
                  </View>

                  {/* Action buttons */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.retakeButton}
                      onPress={handleRetake}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="refresh" size={20} color={colors.text.light} />
                      <Text style={styles.retakeButtonText}>
                        Reprendre
                      </Text>
                    </TouchableOpacity>
                    <LinearGradient
                      colors={[colors.primary.main, colors.primary.dark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sendButtonGradient}
                    >
                      <TouchableOpacity
                        style={styles.sendButton}
                        onPress={handleConfirm}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="send" size={20} color={colors.text.light} />
                        <Text style={styles.sendButtonText}>
                          Envoyer
                        </Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                </View>
              ) : (
                <View style={styles.cameraControls}>
                  {/* Camera type toggle */}
                  <TouchableOpacity
                    style={styles.toggleCameraButton}
                    onPress={handleToggleCamera}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={[withOpacity(colors.primary.main, 0.3), withOpacity(colors.secondary.main, 0.3)]}
                      style={styles.toggleButtonGradient}
                    >
                      <Ionicons
                        name="camera-reverse"
                        size={24}
                        color={colors.text.light}
                      />
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Capture buttons */}
                  <View style={styles.captureButtons}>
                    <TouchableOpacity
                      style={styles.captureButton}
                      onPress={handleTakePhoto}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={[withOpacity(colors.primary.main, 0.2), withOpacity(colors.primary.dark, 0.1)]}
                        style={styles.captureButtonGradient}
                      >
                        <Ionicons name="camera" size={40} color={colors.primary.main} />
                        <Text style={styles.captureButtonText}>
                          Photo
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    {allowVideo && (
                      <TouchableOpacity
                        style={styles.captureButton}
                        onPress={handleTakeVideo}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={[withOpacity(colors.secondary.main, 0.2), withOpacity(colors.secondary.dark, 0.1)]}
                          style={styles.captureButtonGradient}
                        >
                          <Ionicons name="videocam" size={40} color={colors.secondary.main} />
                          <Text style={styles.captureButtonText}>
                            Vidéo
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    maxHeight: '90%',
    backgroundColor: withOpacity(colors.background.darkCard, 0.95),
    ...shadows.large,
  },
  headerGradient: {
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    paddingTop: spacing.base * 1.5,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.2),
  },
  headerTitle: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.text.light,
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: spacing.small,
    borderRadius: borderRadius.small,
    backgroundColor: withOpacity(colors.background.dark, 0.3),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.base,
  },
  cameraControls: {
    padding: spacing.base * 2,
    alignItems: 'center',
    minHeight: 300,
  },
  toggleCameraButton: {
    alignSelf: 'flex-end',
    marginBottom: spacing.base * 2,
  },
  toggleButtonGradient: {
    padding: spacing.base,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: withOpacity(colors.primary.main, 0.3),
  },
  captureButtons: {
    flexDirection: 'row',
    gap: spacing.base,
    width: '100%',
  },
  captureButton: {
    flex: 1,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    ...shadows.medium,
  },
  captureButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base * 2,
    gap: spacing.small,
    minHeight: 120,
  },
  captureButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text.light,
    marginTop: spacing.small,
  },
  previewContainer: {
    padding: spacing.base,
  },
  imageWrapper: {
    width: '100%',
    height: 400,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    backgroundColor: withOpacity(colors.background.dark, 0.5),
    ...shadows.medium,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewVideo: {
    width: '100%',
    height: 400,
    borderRadius: borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  videoLabel: {
    ...typography.body,
    marginTop: spacing.small,
    color: colors.text.light,
    fontWeight: '600',
  },
  captionContainer: {
    marginTop: spacing.base * 1.5,
    marginBottom: spacing.base,
  },
  captionInput: {
    ...typography.body,
    padding: spacing.base,
    borderRadius: borderRadius.medium,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
    color: colors.text.light,
    backgroundColor: withOpacity(colors.background.dark, 0.4),
    borderWidth: 1,
    borderColor: withOpacity(colors.primary.main, 0.3),
  },
  captionCounter: {
    ...textStyles.caption,
    color: withOpacity(colors.text.light, 0.5),
    textAlign: 'right',
    marginTop: spacing.small / 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.base,
    marginTop: spacing.base,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.medium,
    gap: spacing.small,
    backgroundColor: withOpacity(colors.ui.divider, 0.2),
    borderWidth: 1,
    borderColor: withOpacity(colors.ui.divider, 0.3),
  },
  retakeButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.light,
  },
  sendButtonGradient: {
    flex: 1,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    ...shadows.medium,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    gap: spacing.small,
  },
  sendButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text.light,
  },
});
