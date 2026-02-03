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
import * as FileSystem from 'expo-file-system/legacy';
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

  // Log initial params
  useEffect(() => {
    console.log('📸 [MediaViewer] Screen opened');
    console.log('📸 [MediaViewer] Media items count:', mediaItems?.length || 0);
    console.log('📸 [MediaViewer] Initial index:', initialIndex);
    console.log('📸 [MediaViewer] Conversation ID:', conversationId);
    if (mediaItems && mediaItems.length > 0) {
      console.log('📸 [MediaViewer] First media:', {
        id: mediaItems[0].id,
        type: mediaItems[0].type,
        uri: mediaItems[0].uri.substring(0, 50) + '...',
      });
    }
  }, []);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(false); // Start with false, show only if loading takes time
  const [showControls, setShowControls] = useState(true);
  const [videoStatus, setVideoStatus] = useState<AVPlaybackStatus | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    console.log('📸 [MediaViewer] Media changed to index:', currentIndex);
    if (currentMedia) {
      console.log('📸 [MediaViewer] Current media:', {
        id: currentMedia.id,
        type: currentMedia.type,
        filename: currentMedia.filename,
      });
    }
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    // Don't set loading to true immediately - let handleImageLoadStart manage it
    setLoading(false);
    // Clear any pending timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, [currentIndex]);

  // Handle image load start - show spinner only if loading takes more than 200ms
  const handleImageLoadStart = useCallback(() => {
    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    // Show spinner only after 200ms to avoid flickering for fast loads (cached images)
    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(true);
    }, 200);
  }, []);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    console.log('📸 [MediaViewer] Image loaded successfully');
    // Clear timeout if image loads before spinner appears
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    setLoading(false);
  }, []);

  // Handle image load error
  const handleImageError = useCallback(() => {
    console.error('❌ [MediaViewer] Image load error');
    // Clear timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
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
      const currentScale = scale.value;
      console.log('📸 [MediaViewer] Double tap - current scale:', currentScale);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (scale.value > 1) {
        console.log('📸 [MediaViewer] Zooming out');
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        console.log('📸 [MediaViewer] Zooming in to 2x');
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  // Swipe gestures for navigation
  const swipeLeftGesture = Gesture.Pan()
    .activeOffsetX(-10)
    .onEnd((e) => {
      if (e.translationX < -50 && currentIndex < (mediaItems?.length || 0) - 1) {
        console.log('📸 [MediaViewer] Swipe left - navigating to next media');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentIndex(prev => prev + 1);
      }
    });

  const swipeRightGesture = Gesture.Pan()
    .activeOffsetX(10)
    .onEnd((e) => {
      if (e.translationX > 50 && currentIndex > 0) {
        console.log('📸 [MediaViewer] Swipe right - navigating to previous media');
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
    if (!currentMedia) {
      console.log('❌ [MediaViewer] Share failed - no current media');
      return;
    }

    try {
      console.log('📤 [MediaViewer] Sharing media:', currentMedia.type, currentMedia.filename);
      console.log('📤 [MediaViewer] Media URI:', currentMedia.uri.substring(0, 100));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (!isAvailable) {
        console.log('❌ [MediaViewer] Sharing not available on this device');
        Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil');
        return;
      }

      // Check if URI is a remote URL (http/https) - these cannot be shared directly
      const isRemoteUrl = currentMedia.uri.startsWith('http://') || currentMedia.uri.startsWith('https://');
      
      if (isRemoteUrl) {
        console.log('⚠️ [MediaViewer] Remote URL detected, downloading first...');
        // For remote URLs, we need to download first
        const downloadPath = `${FileSystem.cacheDirectory}share_${Date.now()}.${currentMedia.type === 'image' ? 'jpg' : 'mp4'}`;
        
        try {
          const { uri: localUri } = await FileSystem.downloadAsync(currentMedia.uri, downloadPath);
          console.log('✅ [MediaViewer] Downloaded to:', localUri);
          await Sharing.shareAsync(localUri);
          console.log('✅ [MediaViewer] Share successful');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (downloadError) {
          console.error('❌ [MediaViewer] Download error:', downloadError);
          Alert.alert('Erreur', 'Impossible de télécharger le média pour le partager. Les URLs distantes ne peuvent pas être partagées directement.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else {
        // Local file, can be shared directly
        await Sharing.shareAsync(currentMedia.uri);
        console.log('✅ [MediaViewer] Share successful');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('❌ [MediaViewer] Share error:', error);
      Alert.alert('Erreur', 'Impossible de partager le média. Les URLs distantes (comme Unsplash) ne peuvent pas être partagées directement.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [currentMedia]);

  // Handle download
  const handleDownload = useCallback(async () => {
    if (!currentMedia) {
      console.log('❌ [MediaViewer] Download failed - no current media');
      return;
    }

    try {
      console.log('⬇️ [MediaViewer] Downloading media:', currentMedia.type, currentMedia.filename);
      console.log('⬇️ [MediaViewer] Media URI:', currentMedia.uri.substring(0, 100));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);

      const fileUri = currentMedia.uri;
      const filename = currentMedia.filename || `media_${Date.now()}.${currentMedia.type === 'image' ? 'jpg' : 'mp4'}`;
      
      // Use documentDirectory or fallback to cacheDirectory if undefined
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      if (!baseDir) {
        throw new Error('Aucun répertoire de stockage disponible');
      }
      const downloadPath = `${baseDir}${filename}`;

      console.log('⬇️ [MediaViewer] Download path:', downloadPath);
      
      // Check if URI is a remote URL
      const isRemoteUrl = fileUri.startsWith('http://') || fileUri.startsWith('https://');
      
      if (isRemoteUrl) {
        // Download from remote URL
        console.log('⬇️ [MediaViewer] Downloading from remote URL...');
        const { uri } = await FileSystem.downloadAsync(fileUri, downloadPath);
        console.log('✅ [MediaViewer] Download successful:', uri);
        Alert.alert('Succès', `Média téléchargé avec succès`);
      } else {
        // Local file - copy to documents
        console.log('⬇️ [MediaViewer] Copying local file...');
        await FileSystem.copyAsync({
          from: fileUri,
          to: downloadPath,
        });
        console.log('✅ [MediaViewer] Copy successful:', downloadPath);
        Alert.alert('Succès', `Média copié avec succès`);
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLoading(false);
    } catch (error: any) {
      console.error('❌ [MediaViewer] Download error:', error);
      const errorMessage = error?.message || 'Erreur inconnue';
      console.error('❌ [MediaViewer] Error details:', errorMessage);
      Alert.alert(
        'Erreur', 
        `Impossible de télécharger le média.\n\n${errorMessage}\n\nNote: Les URLs distantes peuvent nécessiter une connexion internet.`
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
    }
  }, [currentMedia]);

  // Handle video play/pause
  const handlePlayPause = useCallback(() => {
    console.log('▶️ [MediaViewer] Video play/pause - current state:', isPlaying ? 'playing' : 'paused');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowControls(true);
    if (isPlaying) {
      console.log('⏸️ [MediaViewer] Pausing video');
      videoRef.current?.pauseAsync();
    } else {
      console.log('▶️ [MediaViewer] Playing video');
      videoRef.current?.playAsync();
    }
  }, [isPlaying]);

  // Toggle controls visibility
  const toggleControls = useCallback(() => {
    setShowControls(prev => !prev);
  }, []);

  // Combined gesture for images - use Simultaneous for pinch/pan, Race for navigation
  // NOTE: Zoom only works for images, not videos
  const imageGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
    Gesture.Race(swipeLeftGesture, swipeRightGesture)
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
              onError={handleImageError}
              onLoadStart={handleImageLoadStart}
              // Optimize image loading - use cache when available
              cache="force-cache"
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
    console.log('⚠️ [MediaViewer] No media items to display');
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Aucun média à afficher</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            console.log('📸 [MediaViewer] Closing - no media');
            navigation.goBack();
          }}
        >
          <Ionicons name="close" size={28} color={colors.text.light} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={[]}>
        {/* Header */}
        {showControls && (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.header}
          >
            <TouchableOpacity
              onPress={() => {
                console.log('📸 [MediaViewer] Close button pressed');
                navigation.goBack();
              }}
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
    backgroundColor: colors.background.dark, // Noir très sombre Whispr (#0A0E27) - comme Telegram
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
    backgroundColor: withOpacity(colors.background.dark, 0.95),
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
