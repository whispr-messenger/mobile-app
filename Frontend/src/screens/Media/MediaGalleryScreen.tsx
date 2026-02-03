/**
 * MediaGalleryScreen - Gallery view of all media in a conversation
 * WHISPR-254: Galerie de médias dans le chat avec filtres et grille
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { colors, withOpacity } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const ITEM_GAP = 2;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.base * 2 - ITEM_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

type MediaFilter = 'all' | 'image' | 'video' | 'file';

interface MediaGalleryParams {
  mediaItems: MediaItem[];
  conversationId?: string;
}

type MediaGalleryScreenRouteProp = {
  params?: MediaGalleryParams;
};

export const MediaGalleryScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const params = route.params as MediaGalleryParams;
  const { mediaItems = [], conversationId } = params || {};

  const [selectedFilter, setSelectedFilter] = useState<MediaFilter>('all');

  // Filter media based on selected filter
  const filteredMedia = useMemo(() => {
    if (selectedFilter === 'all') return mediaItems;
    return mediaItems.filter(item => item.type === selectedFilter);
  }, [mediaItems, selectedFilter]);

  // Count media by type
  const mediaCounts = useMemo(() => {
    return {
      all: mediaItems.length,
      image: mediaItems.filter(m => m.type === 'image').length,
      video: mediaItems.filter(m => m.type === 'video').length,
      file: mediaItems.filter(m => m.type === 'file').length,
    };
  }, [mediaItems]);

  // Handle filter selection
  const handleFilterSelect = useCallback((filter: MediaFilter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFilter(filter);
  }, []);

  // Handle media item press
  const handleMediaPress = useCallback((index: number) => {
    const item = filteredMedia[index];
    if (!item) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Find original index in all mediaItems
    const originalIndex = mediaItems.findIndex(m => m.id === item.id);
    
    navigation.navigate('MediaViewer' as never, {
      mediaItems,
      initialIndex: originalIndex >= 0 ? originalIndex : index,
      conversationId,
    } as never);
  }, [filteredMedia, mediaItems, conversationId, navigation]);

  // Render filter button
  const renderFilterButton = (filter: MediaFilter, label: string, icon: string) => {
    const isSelected = selectedFilter === filter;
    const count = mediaCounts[filter];
    
    const animatedStyle = useAnimatedStyle(() => {
      return {
        backgroundColor: withTiming(
          isSelected ? colors.primary.main : withOpacity(colors.background.darkCard, 0.6),
          { duration: 200 }
        ),
        transform: [{ scale: withSpring(isSelected ? 1.05 : 1, { damping: 15 }) }],
      };
    });

    return (
      <TouchableOpacity
        onPress={() => handleFilterSelect(filter)}
        activeOpacity={0.8}
        style={styles.filterButtonContainer}
      >
        <Animated.View style={[styles.filterButton, animatedStyle]}>
          <Ionicons
            name={icon as any}
            size={16}
            color={isSelected ? colors.text.light : withOpacity(colors.text.light, 0.7)}
          />
          <Text
            style={[
              styles.filterButtonText,
              {
                color: isSelected ? colors.text.light : withOpacity(colors.text.light, 0.7),
                fontWeight: isSelected ? typography.fontWeight.semiBold : typography.fontWeight.regular,
              },
            ]}
          >
            {label}
          </Text>
          {count > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: withOpacity(colors.primary.main, 0.3) }]}>
              <Text style={styles.filterBadgeText}>{count}</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Render media item
  const renderMediaItem = ({ item, index }: { item: typeof filteredMedia[0]; index: number }) => {
    return (
      <TouchableOpacity
        onPress={() => handleMediaPress(index)}
        activeOpacity={0.9}
        style={styles.mediaItemContainer}
      >
        <Animated.View
          entering={FadeIn.delay(index * 30).duration(300)}
          style={styles.mediaItem}
        >
          {item.type === 'image' && (
            <Image
              source={{ uri: item.thumbnailUri || item.uri }}
              style={styles.mediaThumbnail}
              resizeMode="cover"
            />
          )}
          {item.type === 'video' && (
            <View style={styles.videoThumbnailContainer}>
              <Image
                source={{ uri: item.thumbnailUri || item.uri }}
                style={styles.mediaThumbnail}
                resizeMode="cover"
              />
              <View style={styles.videoOverlay}>
                <View style={styles.playIconContainer}>
                  <Ionicons name="play" size={24} color={colors.text.light} />
                </View>
              </View>
            </View>
          )}
          {item.type === 'file' && (
            <View style={styles.fileThumbnailContainer}>
              <Ionicons name="document" size={32} color={colors.primary.main} />
              <Text style={styles.fileThumbnailText} numberOfLines={1}>
                {item.filename || 'Fichier'}
              </Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.light} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Galerie</Text>
            <Text style={styles.headerSubtitle}>
              {filteredMedia.length} {filteredMedia.length === 1 ? 'média' : 'médias'}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Filter Pills */}
        <View style={styles.filtersContainer}>
          {renderFilterButton('all', 'Tous', 'grid-outline')}
          {renderFilterButton('image', 'Photos', 'image-outline')}
          {renderFilterButton('video', 'Vidéos', 'videocam-outline')}
          {renderFilterButton('file', 'Documents', 'document-text-outline')}
        </View>

        {/* Media Grid */}
        {filteredMedia.length > 0 ? (
          <FlashList
            data={filteredMedia}
            renderItem={renderMediaItem}
            numColumns={NUM_COLUMNS}
            estimatedItemSize={ITEM_SIZE}
            contentContainerStyle={styles.gridContent}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="images-outline"
              size={64}
              color={withOpacity(colors.text.light, 0.3)}
            />
            <Text style={styles.emptyText}>
              Aucun {selectedFilter === 'all' ? 'média' : selectedFilter === 'image' ? 'photo' : selectedFilter === 'video' ? 'vidéo' : 'document'} dans cette conversation
            </Text>
          </View>
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
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.light,
    letterSpacing: typography.letterSpacing.tight,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: withOpacity(colors.text.light, 0.6),
    marginTop: spacing.xs / 2,
  },
  headerRight: {
    width: 40,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: withOpacity(colors.background.dark, 0.5),
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.1),
  },
  filterButtonContainer: {
    flex: 1,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    ...shadows.sm,
  },
  filterButtonText: {
    fontSize: typography.fontSize.sm,
    letterSpacing: typography.letterSpacing.normal,
  },
  filterBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.light,
  },
  gridContent: {
    padding: spacing.base,
  },
  mediaItemContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginBottom: ITEM_GAP,
    marginRight: ITEM_GAP,
  },
  mediaItem: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: withOpacity(colors.background.darkCard, 0.3),
    ...shadows.md,
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoThumbnailContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withOpacity(colors.background.dark, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withOpacity(colors.primary.main, 0.9),
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 2, // Offset for play icon
  },
  fileThumbnailContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: withOpacity(colors.background.darkCard, 0.5),
  },
  fileThumbnailText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.light,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.regular,
    color: withOpacity(colors.text.light, 0.5),
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
