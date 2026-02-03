/**
 * MediaGalleryScreen - Gallery view of all media in a conversation
 * WHISPR-254: Galerie de médias dans le chat avec filtres et grille
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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

  // Render filter button with premium design
  const renderFilterButton = (filter: MediaFilter, label: string, icon: string) => {
    const isSelected = selectedFilter === filter;
    const count = mediaCounts[filter];
    const scale = useSharedValue(isSelected ? 1.05 : 1);
    
    useEffect(() => {
      scale.value = withSpring(isSelected ? 1.05 : 1, { damping: 15, stiffness: 300 });
    }, [isSelected, scale]);
    
    const animatedStyle = useAnimatedStyle(() => {
      return {
        backgroundColor: withTiming(
          isSelected ? colors.primary.main : withOpacity(colors.background.darkCard, 0.5),
          { duration: 250 }
        ),
        transform: [{ scale: scale.value }],
        borderWidth: withTiming(isSelected ? 0 : 1, { duration: 200 }),
        borderColor: withTiming(
          isSelected ? 'transparent' : withOpacity(colors.ui.divider, 0.3),
          { duration: 200 }
        ),
      };
    });

    const iconAnimatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ rotate: withTiming(isSelected ? '0deg' : '0deg', { duration: 200 }) }],
        opacity: withTiming(isSelected ? 1 : 0.7, { duration: 200 }),
      };
    });

    return (
      <TouchableOpacity
        onPress={() => handleFilterSelect(filter)}
        activeOpacity={0.9}
        style={styles.filterButtonContainer}
      >
        <Animated.View style={[styles.filterButton, animatedStyle]}>
          <Animated.View style={iconAnimatedStyle}>
            <Ionicons
              name={icon as any}
              size={18}
              color={isSelected ? colors.text.light : withOpacity(colors.text.light, 0.6)}
            />
          </Animated.View>
          <Text
            style={[
              styles.filterButtonText,
              {
                color: isSelected ? colors.text.light : withOpacity(colors.text.light, 0.6),
                fontWeight: isSelected ? typography.fontWeight.bold : typography.fontWeight.medium,
                letterSpacing: isSelected ? typography.letterSpacing.wide : typography.letterSpacing.normal,
              },
            ]}
          >
            {label}
          </Text>
          {count > 0 && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={[
                styles.filterBadge,
                {
                  backgroundColor: isSelected
                    ? withOpacity(colors.text.light, 0.25)
                    : withOpacity(colors.primary.main, 0.3),
                },
              ]}
            >
              <Text
                style={[
                  styles.filterBadgeText,
                  {
                    color: isSelected ? colors.text.light : colors.primary.main,
                    fontWeight: typography.fontWeight.bold,
                  },
                ]}
              >
                {count > 99 ? '99+' : count}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Render media item with premium animations
  const renderMediaItem = ({ item, index }: { item: typeof filteredMedia[0]; index: number }) => {
    const scale = useSharedValue(1);
    
    const handlePressIn = () => {
      scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    };
    
    const handlePressOut = () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    };
    
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <TouchableOpacity
        onPress={() => handleMediaPress(index)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.mediaItemContainer}
      >
        <Animated.View
          entering={FadeIn.delay(index * 20).duration(250)}
          style={[styles.mediaItem, animatedStyle]}
        >
          {item.type === 'image' && (
            <>
              <Image
                source={{ uri: item.thumbnailUri || item.uri }}
                style={styles.mediaThumbnail}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay} />
            </>
          )}
          {item.type === 'video' && (
            <View style={styles.videoThumbnailContainer}>
              <Image
                source={{ uri: item.thumbnailUri || item.uri }}
                style={styles.mediaThumbnail}
                resizeMode="cover"
              />
              <View style={styles.videoOverlay}>
                <Animated.View
                  entering={FadeIn.duration(200)}
                  style={styles.playIconContainer}
                >
                  <Ionicons name="play" size={20} color={colors.text.light} />
                </Animated.View>
                {item.size && (
                  <View style={styles.videoDurationBadge}>
                    <Ionicons name="time-outline" size={10} color={colors.text.light} />
                    <Text style={styles.videoDurationText}>
                      {item.size > 1000000 ? `${(item.size / 1000000).toFixed(1)}MB` : `${(item.size / 1000).toFixed(0)}KB`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
          {item.type === 'file' && (
            <View style={styles.fileThumbnailContainer}>
              <View style={styles.fileIconWrapper}>
                <Ionicons name="document-text" size={36} color={colors.primary.main} />
              </View>
              <Text style={styles.fileThumbnailText} numberOfLines={2}>
                {item.filename || 'Fichier'}
              </Text>
              {item.size && (
                <Text style={styles.fileSizeText}>
                  {item.size > 1000000 ? `${(item.size / 1000000).toFixed(1)} MB` : `${(item.size / 1000).toFixed(0)} KB`}
                </Text>
              )}
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
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.light,
    letterSpacing: typography.letterSpacing.tight,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: withOpacity(colors.text.light, 0.7),
    marginTop: spacing.xs / 2,
    letterSpacing: typography.letterSpacing.normal,
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
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md + 4,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    ...shadows.md,
    minHeight: 40,
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
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: withOpacity(colors.background.darkCard, 0.4),
    ...shadows.lg,
    borderWidth: 1,
    borderColor: withOpacity(colors.ui.divider, 0.1),
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
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withOpacity(colors.background.dark, 0.25),
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: withOpacity(colors.primary.main, 0.95),
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3, // Offset for play icon
    ...shadows.lg,
    borderWidth: 2,
    borderColor: withOpacity(colors.text.light, 0.2),
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withOpacity(colors.background.dark, 0.85),
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  videoDurationText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.light,
  },
  fileThumbnailContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: withOpacity(colors.background.darkCard, 0.6),
  },
  fileIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: withOpacity(colors.primary.main, 0.15),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  fileThumbnailText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.light,
    marginTop: spacing.xs,
    textAlign: 'center',
    letterSpacing: typography.letterSpacing.tight,
  },
  fileSizeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: withOpacity(colors.text.light, 0.6),
    marginTop: 2,
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
