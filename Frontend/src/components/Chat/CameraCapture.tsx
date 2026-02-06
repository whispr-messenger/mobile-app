/**
 * CameraCapture - Integrated camera component with preview and caption
 * WHISPR-266: Caméra intégrée dans le chat
 * Design premium avec animations et gradients créatifs
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  SafeAreaView,
  Keyboard,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { colors, withOpacity } from '../../theme/colors';
import { typography, textStyles } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const captionInputRef = useRef<TextInput>(null);

  // Animations
  const modalOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(SCREEN_HEIGHT);
  const photoButtonScale = useSharedValue(1);
  const videoButtonScale = useSharedValue(1);
  const toggleButtonRotation = useSharedValue(0);
  const previewScale = useSharedValue(0.8);
  const previewOpacity = useSharedValue(0);

  // Log component lifecycle
  useEffect(() => {
    if (visible) {
      console.log('[CameraCapture] Modal opened');
      modalOpacity.value = withTiming(1, { duration: 300 });
      modalTranslateY.value = withSpring(0, { damping: 20, stiffness: 90 });
      
      if (capturedMedia) {
        previewScale.value = withSpring(1, { damping: 15 });
        previewOpacity.value = withTiming(1, { duration: 400 });
      }
    } else {
      modalOpacity.value = withTiming(0, { duration: 200 });
      modalTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
      previewScale.value = 0.8;
      previewOpacity.value = 0;
    }
  }, [visible, capturedMedia]);

  // Keyboard listeners
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      console.log('[CameraCapture] Keyboard shown, height:', e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      console.log('[CameraCapture] Keyboard hidden');
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Animated styles
  const modalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ translateY: modalTranslateY.value }],
  }));

  const previewAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: previewScale.value }],
    opacity: previewOpacity.value,
  }));

  const photoButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: photoButtonScale.value }],
  }));

  const videoButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: videoButtonScale.value }],
  }));

  const toggleButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${toggleButtonRotation.value}deg` }],
  }));

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
    
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      console.log('[CameraCapture] Permission denied, aborting photo capture');
      return;
    }

    try {
      console.log('[CameraCapture] Launching camera for photo...');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Animation button press
      photoButtonScale.value = withSequence(
        withTiming(0.9, { duration: 100 }),
        withSpring(1, { damping: 10 })
      );

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
        console.log('[CameraCapture] Photo captured successfully');
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCapturedMedia({
          uri: result.assets[0].uri,
          type: 'image',
        });
        
        // Animate preview appearance
        previewScale.value = withSpring(1, { damping: 15 });
        previewOpacity.value = withTiming(1, { duration: 400 });
        
        console.log('[CameraCapture] Preview state updated');
      } else {
        console.log('[CameraCapture] Photo capture canceled or no assets');
      }
    } catch (error: any) {
      console.error('[CameraCapture] Error taking photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [cameraType, requestCameraPermissions, photoButtonScale, previewScale, previewOpacity]);

  // Handle video capture
  const handleTakeVideo = useCallback(async () => {
    if (!allowVideo) {
      console.log('[CameraCapture] Video not allowed, aborting');
      return;
    }

    console.log('[CameraCapture] handleTakeVideo called');
    
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      console.log('[CameraCapture] Permission denied, aborting video capture');
      return;
    }

    try {
      console.log('[CameraCapture] Launching camera for video...');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Animation button press
      videoButtonScale.value = withSequence(
        withTiming(0.9, { duration: 100 }),
        withSpring(1, { damping: 10 })
      );

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaType.Videos,
        allowsEditing: false,
        quality: 0.9,
        cameraType: cameraType === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        videoMaxDuration: 60,
      });

      console.log('[CameraCapture] Video result:', {
        canceled: result.canceled,
        assetsCount: result.assets?.length || 0,
        hasAssets: !!result.assets && result.assets.length > 0,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('[CameraCapture] Video captured successfully');
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCapturedMedia({
          uri: result.assets[0].uri,
          type: 'video',
        });
        
        // Animate preview appearance
        previewScale.value = withSpring(1, { damping: 15 });
        previewOpacity.value = withTiming(1, { duration: 400 });
        
        console.log('[CameraCapture] Preview state updated');
      } else {
        console.log('[CameraCapture] Video capture canceled or no assets');
      }
    } catch (error: any) {
      console.error('[CameraCapture] Error taking video:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la vidéo.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [allowVideo, cameraType, requestCameraPermissions, videoButtonScale, previewScale, previewOpacity]);

  // Toggle camera (front/back)
  const handleToggleCamera = useCallback(() => {
    const newType = cameraType === 'back' ? 'front' : 'back';
    console.log('[CameraCapture] Toggling camera from', cameraType, 'to', newType);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate rotation
    toggleButtonRotation.value = withSequence(
      withTiming(180, { duration: 300 }),
      withTiming(0, { duration: 0 })
    );
    
    setCameraType(newType);
  }, [cameraType, toggleButtonRotation]);

  // Retake photo/video
  const handleRetake = useCallback(() => {
    console.log('[CameraCapture] Retake requested');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    previewScale.value = withTiming(0.8, { duration: 200 });
    previewOpacity.value = withTiming(0, { duration: 200 }, () => {
      setCapturedMedia(null);
      setCaption('');
      previewScale.value = 0.8;
      previewOpacity.value = 0;
    });
    
    console.log('[CameraCapture] Preview reset');
  }, [previewScale, previewOpacity]);

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

    console.log('[CameraCapture] Confirming capture');
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
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.modalOverlay, modalAnimatedStyle]}>
        <LinearGradient
          colors={[
            '#1A0F2E', // Violet très foncé indigo
            '#2D1B4E', // Violet foncé indigo
            '#3C2558', // Violet moyen foncé
            '#4A2C6B', // Violet moyen
            '#5A3575'  // Violet foncé
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        >
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.keyboardView}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
              <View style={styles.modalContent}>
                {/* Header avec gradient créatif */}
                <LinearGradient
                  colors={[
                    withOpacity(colors.primary.main, 0.3),
                    withOpacity(colors.palette.violet, 0.25),
                    withOpacity(colors.palette.beige, 0.15),
                    'transparent'
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.headerGradient}
                >
                  <View style={styles.header}>
                    <View style={styles.headerTitleContainer}>
                      <Ionicons 
                        name={capturedMedia ? "image" : "camera"} 
                        size={20} 
                        color={colors.primary.main} 
                        style={styles.headerIcon}
                      />
                      <Text style={styles.headerTitle}>
                        {capturedMedia ? 'Prévisualisation' : 'Caméra'}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      onPress={handleCancel} 
                      style={styles.closeButton}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={[withOpacity(colors.ui.error, 0.3), withOpacity(colors.ui.error, 0.1)]}
                        style={styles.closeButtonGradient}
                      >
                        <Ionicons name="close" size={20} color={colors.text.light} />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>

                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: keyboardHeight > 0 ? keyboardHeight + spacing.base : spacing.base * 2 }
                  ]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* Preview or Camera Controls */}
                  {capturedMedia ? (
                    <Animated.View style={[styles.previewContainer, previewAnimatedStyle]}>
                      {capturedMedia.type === 'image' ? (
                        <View style={styles.imageWrapper}>
                          <LinearGradient
                            colors={[withOpacity(colors.primary.main, 0.1), 'transparent']}
                            style={styles.imageGradientOverlay}
                          />
                          <Image 
                            source={{ uri: capturedMedia.uri }} 
                            style={styles.previewImage}
                            resizeMode="cover"
                            onLoad={() => console.log('[CameraCapture] Preview image loaded')}
                            onError={(error) => console.error('[CameraCapture] Preview image error:', error)}
                          />
                        </View>
                      ) : (
                        <LinearGradient
                          colors={[
                            withOpacity(colors.palette.violet, 0.4),
                            withOpacity(colors.primary.main, 0.35),
                            withOpacity(colors.palette.darkViolet, 0.25)
                          ]}
                          style={styles.previewVideo}
                        >
                          <View style={styles.videoIconContainer}>
                            <LinearGradient
                              colors={[colors.primary.main, colors.palette.violet]}
                              style={styles.videoIconGradient}
                            >
                              <Ionicons name="videocam" size={48} color={colors.text.light} />
                            </LinearGradient>
                          </View>
                          <Text style={styles.videoLabel}>
                            Vidéo capturée
                          </Text>
                        </LinearGradient>
                      )}

                      {/* Caption input avec design premium */}
                      <View style={styles.captionContainer}>
                        <LinearGradient
                          colors={[
                            withOpacity('#4A2C6B', 0.7),
                            withOpacity('#6B3D8F', 0.5)
                          ]}
                          style={styles.captionInputWrapper}
                        >
                          <Ionicons 
                            name="create-outline" 
                            size={20} 
                            color={colors.primary.main} 
                            style={styles.captionIcon}
                          />
                          <TextInput
                            ref={captionInputRef}
                            style={styles.captionInput}
                            placeholder="Ajouter une légende..."
                            placeholderTextColor={withOpacity(colors.text.light, 0.4)}
                            value={caption}
                            onChangeText={handleCaptionChange}
                            multiline
                            maxLength={200}
                            returnKeyType="done"
                            blurOnSubmit={true}
                          />
                        </LinearGradient>
                        <Text style={styles.captionCounter}>
                          {caption.length}/200
                        </Text>
                      </View>

                      {/* Action buttons avec gradients créatifs */}
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={styles.retakeButton}
                          onPress={handleRetake}
                          activeOpacity={0.8}
                        >
                          <LinearGradient
                            colors={[
                              withOpacity(colors.ui.divider, 0.4),
                              withOpacity(colors.ui.divider, 0.2)
                            ]}
                            style={styles.retakeButtonGradient}
                          >
                            <Ionicons name="refresh" size={20} color={colors.text.light} />
                            <Text style={styles.retakeButtonText}>
                              Reprendre
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.sendButton}
                          onPress={handleConfirm}
                          activeOpacity={0.9}
                        >
                          <LinearGradient
                            colors={[colors.primary.main, colors.primary.dark, colors.palette.violet]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.sendButtonGradient}
                          >
                            <Ionicons name="send" size={20} color={colors.text.light} />
                            <Text style={styles.sendButtonText}>
                              Envoyer
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </Animated.View>
                  ) : (
                    <View style={styles.cameraControls}>
                      {/* Camera type toggle avec animation */}
                      <Animated.View style={toggleButtonAnimatedStyle}>
                        <TouchableOpacity
                          style={styles.toggleCameraButton}
                          onPress={handleToggleCamera}
                          activeOpacity={0.8}
                        >
                          <LinearGradient
                            colors={[
                              withOpacity(colors.primary.main, 0.4),
                              withOpacity(colors.palette.violet, 0.35),
                              withOpacity(colors.palette.beige, 0.2)
                            ]}
                            style={styles.toggleButtonGradient}
                          >
                            <Ionicons
                              name="camera-reverse"
                              size={24}
                              color={colors.text.light}
                            />
                          </LinearGradient>
                        </TouchableOpacity>
                      </Animated.View>

                      {/* Capture buttons avec animations et gradients créatifs */}
                      <View style={styles.captureButtons}>
                        <Animated.View style={photoButtonAnimatedStyle}>
                          <TouchableOpacity
                            style={styles.captureButton}
                            onPress={handleTakePhoto}
                            activeOpacity={0.9}
                          >
                            <LinearGradient
                              colors={[
                                withOpacity(colors.primary.main, 0.25),
                                withOpacity(colors.primary.dark, 0.15),
                                withOpacity(colors.primary.main, 0.1)
                              ]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.captureButtonGradient}
                            >
                              <View style={styles.captureIconContainer}>
                                <LinearGradient
                                  colors={[colors.primary.main, colors.primary.dark]}
                                  style={styles.captureIconGradient}
                                >
                                  <Ionicons name="camera" size={36} color={colors.text.light} />
                                </LinearGradient>
                              </View>
                              <Text style={styles.captureButtonText}>
                                Photo
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </Animated.View>

                        {allowVideo && (
                          <Animated.View style={videoButtonAnimatedStyle}>
                            <TouchableOpacity
                              style={styles.captureButton}
                              onPress={handleTakeVideo}
                              activeOpacity={0.9}
                            >
                              <LinearGradient
                                colors={[
                                  withOpacity(colors.palette.violet, 0.3),
                                  withOpacity(colors.palette.darkViolet, 0.2),
                                  withOpacity(colors.palette.beige, 0.15)
                                ]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.captureButtonGradient}
                              >
                                <View style={styles.captureIconContainer}>
                                  <LinearGradient
                                    colors={[colors.palette.violet, colors.palette.darkViolet]}
                                    style={styles.captureIconGradient}
                                  >
                                    <Ionicons name="videocam" size={36} color={colors.text.light} />
                                  </LinearGradient>
                                </View>
                                <Text style={styles.captureButtonText}>
                                  Vidéo
                                </Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          </Animated.View>
                        )}
                      </View>
                    </View>
                  )}
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    backgroundColor: 'transparent',
    overflow: 'hidden',
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
    paddingBottom: spacing.base * 1.2,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  headerIcon: {
    marginRight: spacing.small / 2,
  },
  headerTitle: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.text.light,
    letterSpacing: -0.5,
  },
  closeButton: {
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
  },
  closeButtonGradient: {
    padding: spacing.small,
    borderRadius: borderRadius.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  cameraControls: {
    padding: spacing.base * 2,
    alignItems: 'center',
    minHeight: 350,
    justifyContent: 'center',
  },
  toggleCameraButton: {
    alignSelf: 'flex-end',
    marginBottom: spacing.base * 2,
    borderRadius: borderRadius.large,
    overflow: 'hidden',
  },
  toggleButtonGradient: {
    padding: spacing.base,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    borderColor: withOpacity(colors.primary.main, 0.3),
  },
  captureButtons: {
    flexDirection: 'row',
    gap: spacing.base * 1.5,
    width: '100%',
  },
  captureButton: {
    flex: 1,
    borderRadius: borderRadius.large,
    overflow: 'hidden',
    ...shadows.medium,
  },
  captureButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base * 2.5,
    gap: spacing.base,
    minHeight: 140,
    borderRadius: borderRadius.large,
  },
  captureIconContainer: {
    marginBottom: spacing.small,
  },
  captureIconGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  captureButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text.light,
    fontSize: typography.fontSize.lg,
  },
  previewContainer: {
    padding: spacing.base,
  },
  imageWrapper: {
    width: '100%',
    height: 450,
    borderRadius: borderRadius.large,
    overflow: 'hidden',
    backgroundColor: withOpacity('#4A2C6B', 0.3),
    ...shadows.large,
  },
  imageGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    borderRadius: borderRadius.large,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewVideo: {
    width: '100%',
    height: 450,
    borderRadius: borderRadius.large,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.large,
  },
  videoIconContainer: {
    marginBottom: spacing.base,
  },
  videoIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.large,
  },
  videoLabel: {
    ...typography.body,
    marginTop: spacing.base,
    color: colors.text.light,
    fontWeight: '700',
    fontSize: typography.fontSize.lg,
  },
  captionContainer: {
    marginTop: spacing.base * 2,
    marginBottom: spacing.base,
  },
  captionInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.base,
    borderRadius: borderRadius.large,
    borderWidth: 2,
    borderColor: withOpacity(colors.primary.main, 0.4),
    ...shadows.medium,
  },
  captionIcon: {
    marginTop: spacing.small / 2,
    marginRight: spacing.small,
  },
  captionInput: {
    ...typography.body,
    flex: 1,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
    color: colors.text.light,
    padding: 0,
  },
  captionCounter: {
    ...textStyles.caption,
    color: withOpacity(colors.text.light, 0.5),
    textAlign: 'right',
    marginTop: spacing.small,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.base,
    marginTop: spacing.base * 1.5,
  },
  retakeButton: {
    flex: 1,
    borderRadius: borderRadius.large,
    overflow: 'hidden',
    ...shadows.medium,
  },
  retakeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base * 1.2,
    gap: spacing.small,
    borderRadius: borderRadius.large,
  },
  retakeButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.light,
  },
  sendButton: {
    flex: 1,
    borderRadius: borderRadius.large,
    overflow: 'hidden',
    ...shadows.large,
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base * 1.2,
    gap: spacing.small,
    borderRadius: borderRadius.large,
  },
  sendButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text.light,
    fontSize: typography.fontSize.lg,
  },
});
