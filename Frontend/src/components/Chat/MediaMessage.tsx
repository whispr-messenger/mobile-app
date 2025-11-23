/**
 * MediaMessage - Display media content (images, videos, files)
 */

import React, { useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text, Modal } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
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

  // Video placeholder
  return (
    <View style={styles.videoContainer}>
      <Ionicons name="play-circle" size={48} color={colors.text.light} />
      <Text style={styles.videoLabel}>Vidéo</Text>
    </View>
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
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: {
    marginTop: 8,
    color: colors.text.secondary,
    fontSize: 14,
  },
});

