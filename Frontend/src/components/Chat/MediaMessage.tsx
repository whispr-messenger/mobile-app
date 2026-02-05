/**
 * MediaMessage - Display media content (images, videos, files)
 */

import React, { useState, useRef } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text, Modal, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { colors, withOpacity } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';

interface MediaMessageProps {
  uri: string;
  type: 'image' | 'video' | 'file';
  filename?: string;
  size?: number;
  thumbnailUri?: string;
}

export const MediaMessage: React.FC<MediaMessageProps> = ({
  uri,
  type,
  filename,
  size,
  thumbnailUri,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const [showFullImage, setShowFullImage] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const videoRef = useRef<Video>(null);
  const [videoStatus, setVideoStatus] = useState<any>({});

  if (type === 'image') {
    return (
      <>
        <TouchableOpacity
          onPress={() => setShowFullImage(true)}
          activeOpacity={0.9}
          style={styles.imageContainer}
        >
          <Image
            source={{ uri: thumbnailUri || uri }}
            style={styles.image}
            resizeMode="cover"
          />
        </TouchableOpacity>

        <Modal
          visible={showFullImage}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFullImage(false)}
        >
          <TouchableOpacity
            style={styles.fullImageOverlay}
            activeOpacity={1}
            onPress={() => setShowFullImage(false)}
          >
            <View style={styles.fullImageContainer}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowFullImage(false)}
              >
                <Ionicons name="close" size={28} color={colors.text.light} />
              </TouchableOpacity>
              <Image
                source={{ uri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  if (type === 'file') {
    return (
      <View
        style={[
          styles.fileContainer,
          { backgroundColor: themeColors.background.secondary },
        ]}
      >
        <Ionicons
          name="document"
          size={32}
          color={themeColors.primary}
          style={styles.fileIcon}
        />
        <View style={styles.fileInfo}>
          <Text
            style={[styles.fileName, { color: themeColors.text.primary }]}
            numberOfLines={1}
          >
            {filename || 'Fichier'}
          </Text>
          {size && (
            <Text style={[styles.fileSize, { color: themeColors.text.secondary }]}>
              {(size / 1024).toFixed(1)} KB
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Video with thumbnail and player
  const handleVideoPress = () => {
    console.log('[MediaMessage] Video pressed, opening player');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowVideoPlayer(true);
  };

  const handleCloseVideo = () => {
    console.log('[MediaMessage] Closing video player');
    if (videoRef.current) {
      videoRef.current.pauseAsync();
    }
    setShowVideoPlayer(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleVideoPress}
        activeOpacity={0.9}
        style={styles.videoContainer}
      >
        {/* Thumbnail background if available */}
        {thumbnailUri || uri ? (
          <Image
            source={{ uri: thumbnailUri || uri }}
            style={styles.videoThumbnail}
            resizeMode="cover"
          />
        ) : null}
        
        {/* Gradient overlay */}
        <LinearGradient
          colors={[
            withOpacity('#3C2558', 0.7),
            withOpacity('#4A2C6B', 0.5),
            withOpacity('#5A3575', 0.4)
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.videoGradientOverlay}
        >
          <View style={styles.videoIconWrapper}>
            <LinearGradient
              colors={[colors.primary.main, colors.palette.violet]}
              style={styles.videoPlayButton}
            >
              <Ionicons name="play" size={32} color={colors.text.light} />
            </LinearGradient>
          </View>
          <Text style={styles.videoLabel}>Vidéo</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Video Player Modal */}
      <Modal
        visible={showVideoPlayer}
        transparent
        animationType="fade"
        onRequestClose={handleCloseVideo}
        statusBarTranslucent
      >
        <View style={styles.videoPlayerOverlay}>
          <TouchableOpacity
            style={styles.videoCloseButton}
            onPress={handleCloseVideo}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[withOpacity(colors.ui.error, 0.8), withOpacity(colors.ui.error, 0.6)]}
              style={styles.videoCloseButtonGradient}
            >
              <Ionicons name="close" size={24} color={colors.text.light} />
            </LinearGradient>
          </TouchableOpacity>
          
          <View style={styles.videoPlayerContainer}>
            {videoStatus.isLoaded ? null : (
              <ActivityIndicator size="large" color={colors.primary.main} style={styles.videoLoading} />
            )}
            <Video
              ref={videoRef}
              source={{ uri }}
              style={styles.videoPlayer}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping={false}
              onPlaybackStatusUpdate={(status) => {
                setVideoStatus(status);
                console.log('[MediaMessage] Video status:', status.isLoaded, status.isPlaying);
              }}
              onError={(error) => {
                console.error('[MediaMessage] Video error:', error);
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: 250,
    maxHeight: 300,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    maxWidth: 250,
  },
  fileIcon: {
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
  },
  videoContainer: {
    width: 250,
    height: 200,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  videoThumbnail: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  videoGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIconWrapper: {
    marginBottom: 8,
    zIndex: 1,
  },
  videoPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: withOpacity(colors.text.light, 0.3),
  },
  videoLabel: {
    marginTop: 8,
    color: colors.text.light,
    fontSize: 14,
    fontWeight: '600',
    zIndex: 1,
  },
  videoPlayerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  videoCloseButtonGradient: {
    padding: 10,
    borderRadius: 20,
  },
  videoPlayerContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  videoLoading: {
    position: 'absolute',
    zIndex: 5,
  },
});

