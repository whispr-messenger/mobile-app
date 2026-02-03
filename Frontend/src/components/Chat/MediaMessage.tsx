/**
 * MediaMessage - Display media content (images, videos, files)
 */

import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { MediaItem } from '../../types/media';

interface MediaMessageProps {
  uri: string;
  type: 'image' | 'video' | 'file';
  filename?: string;
  size?: number;
  thumbnailUri?: string;
  mediaItems?: MediaItem[]; // All media items in conversation for navigation
  initialIndex?: number; // Index of current media in mediaItems
  conversationId?: string;
}

export const MediaMessage: React.FC<MediaMessageProps> = ({
  uri,
  type,
  filename,
  size,
  thumbnailUri,
  mediaItems,
  initialIndex = 0,
  conversationId,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const navigation = useNavigation();

  const handleMediaPress = () => {
    // If we have mediaItems, navigate to MediaViewer with all items
    // Otherwise, create a single-item array
    const items: MediaItem[] = mediaItems || [{
      id: `media-${Date.now()}`,
      uri,
      type,
      filename,
      size,
      thumbnailUri,
    }];

    const index = mediaItems ? initialIndex : 0;

    navigation.navigate('MediaViewer' as never, {
      mediaItems: items,
      initialIndex: index,
      conversationId,
    } as never);
  };

  if (type === 'image') {
    return (
      <TouchableOpacity
        onPress={handleMediaPress}
        activeOpacity={0.9}
        style={styles.imageContainer}
      >
        <Image
          source={{ uri: thumbnailUri || uri }}
          style={styles.image}
          resizeMode="cover"
        />
      </TouchableOpacity>
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

  // Video placeholder
  return (
    <TouchableOpacity
      onPress={handleMediaPress}
      activeOpacity={0.9}
      style={styles.videoContainer}
    >
      <Image
        source={{ uri: thumbnailUri || uri }}
        style={styles.videoThumbnail}
        resizeMode="cover"
      />
      <View style={styles.videoOverlay}>
        <Ionicons name="play-circle" size={48} color={colors.text.light} />
        <Text style={styles.videoLabel}>Vidéo</Text>
      </View>
    </TouchableOpacity>
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
    overflow: 'hidden',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: {
    marginTop: 8,
    color: colors.text.light,
    fontSize: 14,
    fontWeight: '600',
  },
});

