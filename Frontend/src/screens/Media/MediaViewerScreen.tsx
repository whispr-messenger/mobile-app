/**
 * MediaViewerScreen - Fullscreen media viewer with zoom, navigation, and video playback
 * WHISPR-253: Écran de visualisation de médias avec zoom et navigation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '../../context/ThemeContext';
import { colors, withOpacity } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { MediaItem, MediaViewerParams } from '../../types/media';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 5;

type MediaViewerScreenRouteProp = {
  params?: MediaViewerParams;
};

export const MediaViewerScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const params = route.params as MediaViewerParams;
  const { mediaItems, initialIndex = 0, conversationId } = params || {};

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [videoStatus, setVideoStatus] = useState<AVPlaybackStatus | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Zoom and pan for images
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const videoRef = useRef<Video>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentMedia = mediaItems?.[currentIndex];

  // Auto-hide controls for videos
  useEffect(() => {
    if (currentMedia?.type === 'video') {
      if (showControls) {
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, currentMedia?.type]);

  // Reset zoom when changing media
  useEffect(() => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    setLoading(true);
  }, [currentIndex]);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    setLoading(false);
  }, []);

  // Handle video status update
  const handleVideoStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    setVideoStatus(status);
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
  }, []);

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan gesture for moving zoomed image
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Combined gesture
  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Double tap to zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  // Swipe gestures for navigation
  const swipeLeftGesture = Gesture.Pan()
    .activeOffsetX(-10)
    .onEnd((e) => {
      if (e.translationX < -50 && currentIndex < (mediaItems?.length || 0) - 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentIndex(prev => prev + 1);
      }
    });

  const swipeRightGesture = Gesture.Pan()
    .activeOffsetX(10)
    .onEnd((e) => {
      if (e.translationX > 50 && currentIndex > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentIndex(prev => prev - 1);
      }
    });

  // Animated styles
  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  // Handle share
  const handleShare = useCallback(async () => {
    if (!currentMedia) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (!isAvailable) {
        Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil');
        return;
      }

      await Sharing.shareAsync(currentMedia.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[MediaViewer] Share error:', error);
      Alert.alert('Erreur', 'Impossible de partager le média');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [currentMedia]);

  // Handle download
  const handleDownload = useCallback(async () => {
    if (!currentMedia) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);

      const fileUri = currentMedia.uri;
      const filename = currentMedia.filename || `media_${Date.now()}.${currentMedia.type === 'image' ? 'jpg' : 'mp4'}`;
      const fileExtension = filename.split('.').pop() || 'jpg';
      const downloadPath = `${FileSystem.documentDirectory}${filename}`;

      // Download file
      const { uri } = await FileSystem.downloadAsync(fileUri, downloadPath);
      
      // Save to media library (requires expo-media-library, but for now just show success)
      Alert.alert('Succès', 'Média téléchargé avec succès');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLoading(false);
    } catch (error) {
      console.error('[MediaViewer] Download error:', error);
      Alert.alert('Erreur', 'Impossible de télécharger le média');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
    }
  }, [currentMedia]);

  // Handle video play/pause
  const handlePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowControls(true);
    if (isPlaying) {
      videoRef.current?.pauseAsync();
    } else {
      videoRef.current?.playAsync();
    }
  }, [isPlaying]);

  // Toggle controls visibility
  const toggleControls = useCallback(() => {
    setShowControls(prev => !prev);
  }, []);

  // Combined gesture for images
  const imageGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
    swipeLeftGesture,
    swipeRightGesture
  );

  // Render image
  const renderImage = () => {
    if (!currentMedia) return null;

    return (
      <GestureHandlerRootView style={styles.gestureContainer}>
        <GestureDetector gesture={imageGesture}>
          <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
            <Image
              source={{ uri: currentMedia.uri }}
              style={styles.image}
              resizeMode="contain"
              onLoad={handleImageLoad}
              onLoadStart={() => setLoading(true)}
            />
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary.main} />
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    );
  };

  // Render video
  const renderVideo = () => {
    if (!currentMedia) return null;

    return (
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: currentMedia.uri }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          shouldPlay={false}
          onPlaybackStatusUpdate={handleVideoStatusUpdate}
          onLoad={() => setLoading(false)}
        />
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
          </View>
        )}
        {showControls && (
          <TouchableOpacity
            style={styles.videoOverlay}
            onPress={toggleControls}
            activeOpacity={1}
          >
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={handlePlayPause}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={48}
                color={colors.text.light}
              />
            </TouchableOpacity>
            {videoStatus?.isLoaded && (
              <View style={styles.videoInfo}>
                <Text style={styles.videoTime}>
                  {formatTime(videoStatus.positionMillis)} / {formatTime(videoStatus.durationMillis || 0)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Format time helper
  const formatTime = (millis: number): string => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Render file/document
  const renderFile = () => {
    if (!currentMedia) return null;

    return (
      <View style={styles.fileContainer}>
        <Ionicons name="document" size={80} color={colors.primary.main} />
        <Text style={styles.fileName}>{currentMedia.filename || 'Fichier'}</Text>
        {currentMedia.size && (
          <Text style={styles.fileSize}>
            {(currentMedia.size / 1024).toFixed(1)} KB
          </Text>
        )}
      </View>
    );
  };

  if (!mediaItems || mediaItems.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Aucun média à afficher</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={28} color={colors.text.light} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden={Platform.OS === 'ios'} barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={[]}>
        {/* Header */}
        {showControls && (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.header}
          >
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color={colors.text.light} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {currentMedia?.filename || `Média ${currentIndex + 1}`}
              </Text>
              {mediaItems.length > 1 && (
                <Text style={styles.headerSubtitle}>
                  {currentIndex + 1} / {mediaItems.length}
                </Text>
              )}
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleShare}
                style={styles.actionButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="share-outline" size={24} color={colors.text.light} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDownload}
                style={styles.actionButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="download-outline" size={24} color={colors.text.light} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Media Content */}
        <TouchableOpacity
          style={styles.content}
          activeOpacity={1}
          onPress={currentMedia?.type === 'video' ? toggleControls : undefined}
        >
          {currentMedia?.type === 'image' && renderImage()}
          {currentMedia?.type === 'video' && renderVideo()}
          {currentMedia?.type === 'file' && renderFile()}
        </TouchableOpacity>

        {/* Navigation hints for multiple media */}
        {mediaItems.length > 1 && showControls && (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.navigationHint}
          >
            <Text style={styles.hintText}>
              {currentIndex > 0 && '← '}Swipe{currentIndex < mediaItems.length - 1 && ' →'}
            </Text>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  safeArea: {
    flex: 1,
  },
  gestureContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: withOpacity(colors.background.dark, 0.9),
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.1),
  },
  closeButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: withOpacity(colors.background.darkCard, 0.5),
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.light,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: withOpacity(colors.text.light, 0.6),
    marginTop: spacing.xs / 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: withOpacity(colors.background.darkCard, 0.5),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: withOpacity(colors.background.dark, 0.3),
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: withOpacity(colors.background.darkCard, 0.7),
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  videoInfo: {
    position: 'absolute',
    bottom: spacing.xxl,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: withOpacity(colors.background.darkCard, 0.7),
    borderRadius: borderRadius.md,
  },
  videoTime: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.light,
  },
  fileContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  fileName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.light,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  fileSize: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: withOpacity(colors.text.light, 0.6),
    marginTop: spacing.xs,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: withOpacity(colors.background.dark, 0.5),
  },
  navigationHint: {
    position: 'absolute',
    bottom: spacing.xxl,
    alignSelf: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: withOpacity(colors.background.darkCard, 0.7),
    borderRadius: borderRadius.full,
  },
  hintText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: withOpacity(colors.text.light, 0.8),
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.dark,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.light,
    marginBottom: spacing.xl,
  },
});
