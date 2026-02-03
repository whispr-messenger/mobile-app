/**
 * MediaPickerScreen - Premium Media Selection Screen
 * WHISPR-252: Écran de sélection de médias avec design glassmorphism moderne
 * Surpasse l'esthétique de Telegram et Instagram
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { colors, withOpacity } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - 48 - (GRID_COLUMNS - 1) * 12) / GRID_COLUMNS;
const NEON_COLOR = '#FF6347'; // Neon coral
const MESH_GRADIENT = ['#0A0E27', '#1A1F3A', '#2D1B4E', '#3C2E7C', '#4A3F8C']; // Bleu nuit → Violet profond

type MediaType = 'image' | 'video' | 'document';
type TabType = 'gallery' | 'camera' | 'documents';

interface SelectedMedia {
  uri: string;
  type: MediaType;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  scale: Animated.SharedValue<number>;
  opacity: Animated.SharedValue<number>;
}

type MediaPickerScreenRouteProp = {
  params?: {
    conversationId?: string;
    onMediaSelected?: (media: SelectedMedia[]) => void;
  };
};

// Particle component for confirm button animation
const Particle: React.FC<{ particle: Particle }> = ({ particle }) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: particle.scale.value }],
      opacity: particle.opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.primary.main,
          left: particle.x,
          top: particle.y,
        },
        animatedStyle,
      ]}
    />
  );
};

export const MediaPickerScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const params = route.params as MediaPickerScreenRouteProp['params'];
  const { conversationId, onMediaSelected } = params || {};

  const [activeTab, setActiveTab] = useState<TabType>('gallery');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  const tabAnimation = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const confirmButtonY = useSharedValue(0);
  const confirmButtonOpacity = useSharedValue(selectedMedia.length > 0 ? 1 : 0);

  // Update confirm button visibility
  useEffect(() => {
    confirmButtonOpacity.value = withTiming(selectedMedia.length > 0 ? 1 : 0, { duration: 200 });
    confirmButtonY.value = withSpring(selectedMedia.length > 0 ? 0 : 100, {
      damping: 20,
      stiffness: 300,
    });
  }, [selectedMedia.length]);

  // Request permissions on mount
  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const [mediaStatus, cameraStatus] = await Promise.all([
        ImagePicker.requestMediaLibraryPermissionsAsync(),
        ImagePicker.requestCameraPermissionsAsync(),
      ]);

      setHasPermission(
        mediaStatus.status === 'granted' && cameraStatus.status === 'granted'
      );
    } catch (error) {
      console.error('[MediaPicker] Permission error:', error);
      setHasPermission(false);
    }
  };

  // Handle tab change with smooth animation
  const handleTabChange = useCallback((tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    const tabIndex = tab === 'gallery' ? 0 : tab === 'camera' ? 1 : 2;
    tabAnimation.value = withSpring(tabIndex, {
      damping: 20,
      stiffness: 300,
      mass: 0.8,
    });
  }, [tabAnimation]);

  // Handle media selection with scale animation
  const handleSelectMedia = useCallback((media: SelectedMedia) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const isSelected = selectedMedia.some(m => m.uri === media.uri);
    
    if (isSelected) {
      setSelectedMedia(prev => prev.filter(m => m.uri !== media.uri));
    } else {
      setSelectedMedia(prev => [...prev, media]);
    }
  }, [selectedMedia]);

  // Handle gallery image picker
  const handlePickFromGallery = useCallback(async () => {
    if (!hasPermission) {
      Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la galerie');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      buttonScale.value = withSpring(0.95, { damping: 10 }, () => {
        buttonScale.value = withSpring(1);
      });

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets) {
        const newMedia: SelectedMedia[] = result.assets.map(asset => ({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
          name: asset.fileName || `media_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          size: asset.fileSize,
          width: asset.width,
          height: asset.height,
        }));

        setSelectedMedia(prev => [...prev, ...newMedia]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[MediaPicker] Gallery error:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder à la galerie');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [hasPermission, buttonScale]);

  // Handle camera capture
  const handleTakePhoto = useCallback(async () => {
    if (!hasPermission) {
      Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la caméra');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      buttonScale.value = withSpring(0.95, { damping: 10 }, () => {
        buttonScale.value = withSpring(1);
      });

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newMedia: SelectedMedia = {
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
          name: asset.fileName || `camera_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          size: asset.fileSize,
          width: asset.width,
          height: asset.height,
        };

        setSelectedMedia(prev => [...prev, newMedia]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[MediaPicker] Camera error:', error);
      Alert.alert('Erreur', 'Impossible d\'utiliser la caméra');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [hasPermission, buttonScale]);

  // Handle document picker
  const handlePickDocument = useCallback(async () => {
    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      buttonScale.value = withSpring(0.95, { damping: 10 }, () => {
        buttonScale.value = withSpring(1);
      });

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        const newMedia: SelectedMedia[] = result.assets
          .filter(asset => asset.type === 'image' || asset.type === 'video')
          .map(asset => ({
            uri: asset.uri,
            type: 'document',
            name: asset.fileName || `document_${Date.now()}`,
            size: asset.fileSize,
          }));

        setSelectedMedia(prev => [...prev, ...newMedia]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[MediaPicker] Document error:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le document');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [buttonScale]);

  // Create particles animation
  const createParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    const centerX = SCREEN_WIDTH - 80;
    const centerY = SCREEN_HEIGHT - 100;

    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const distance = 40 + Math.random() * 20;
      const particle: Particle = {
        id: i,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        scale: useSharedValue(0),
        opacity: useSharedValue(1),
      };

      particle.scale.value = withSpring(1.5, { damping: 8, stiffness: 200 });
      particle.opacity.value = withTiming(0, { duration: 600 });
      particle.scale.value = withTiming(0, { duration: 600 });

      newParticles.push(particle);
    }

    setParticles(newParticles);
    setTimeout(() => setParticles([]), 600);
  }, []);

  // Handle confirm selection with particles
  const handleConfirm = useCallback(() => {
    if (selectedMedia.length === 0) {
      Alert.alert('Aucun média sélectionné', 'Veuillez sélectionner au moins un média');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createParticles();

    // Delay navigation to show particles
    setTimeout(() => {
      onMediaSelected?.(selectedMedia);
      navigation.goBack();
    }, 300);
  }, [selectedMedia, onMediaSelected, navigation, createParticles]);

  // Animated tab indicator (Pill style)
  const tabIndicatorStyle = useAnimatedStyle(() => {
    const tabWidth = (SCREEN_WIDTH - 48) / 3;
    const translateX = tabAnimation.value * tabWidth;
    return {
      transform: [{ translateX }],
    };
  });

  // Animated button scale
  const buttonScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  // Animated confirm button (floating)
  const confirmButtonStyle = useAnimatedStyle(() => {
    return {
      opacity: confirmButtonOpacity.value,
      transform: [{ translateY: confirmButtonY.value }],
    };
  });

  // Render media item with glassmorphism and neon border
  const MediaItemComponent: React.FC<{ item: SelectedMedia; index: number }> = ({ item, index }) => {
    const isSelected = selectedMedia.some(m => m.uri === item.uri);
    const scale = useSharedValue(isSelected ? 0.95 : 1);
    const borderOpacity = useSharedValue(isSelected ? 1 : 0);
    const checkmarkScale = useSharedValue(isSelected ? 1 : 0);

    useEffect(() => {
      scale.value = withSpring(isSelected ? 0.95 : 1, {
        damping: 15,
        stiffness: 300,
      });
      borderOpacity.value = withTiming(isSelected ? 1 : 0, { duration: 200 });
      
      if (isSelected) {
        checkmarkScale.value = withSequence(
          withSpring(1.2, { damping: 8 }),
          withSpring(1, { damping: 10 })
        );
      } else {
        checkmarkScale.value = withSpring(0, { damping: 15 });
      }
    }, [isSelected]);

    const itemStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }],
        borderWidth: 2,
        borderColor: withOpacity(NEON_COLOR, borderOpacity.value),
      };
    });

    const checkmarkStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: checkmarkScale.value }],
        opacity: checkmarkScale.value,
      };
    });

    return (
      <Animated.View
        entering={FadeIn.delay(index * 30).springify()}
        exiting={FadeOut}
        style={[styles.mediaItemContainer]}
      >
        <Animated.View style={[styles.mediaItem, itemStyle]}>
          <Image source={{ uri: item.uri }} style={styles.mediaThumbnail} />
          {isSelected && (
            <Animated.View
              style={[styles.selectedOverlay, checkmarkStyle]}
            >
              <LinearGradient
                colors={[colors.primary.main, colors.primary.dark]}
                style={styles.selectedBadge}
              >
                <Ionicons name="checkmark" size={18} color={colors.text.light} />
              </LinearGradient>
            </Animated.View>
          )}
          {item.type === 'video' && (
            <View style={styles.videoBadge}>
              <Ionicons name="play-circle" size={14} color={colors.text.light} />
            </View>
          )}
        </Animated.View>
      </Animated.View>
    );
  };

  const renderMediaItem = ({ item, index }: { item: SelectedMedia; index: number }) => {
    return <MediaItemComponent item={item} index={index} />;
  };

  const renderTabContent = () => {
    if (activeTab === 'gallery') {
      return (
        <View style={styles.tabContent}>
          <View style={styles.actionSection}>
            <Animated.View style={buttonScaleStyle}>
              <TouchableOpacity
                style={styles.actionButtonContainer}
                onPress={handlePickFromGallery}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[colors.primary.main, colors.primary.dark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionButton}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.text.light} />
                  ) : (
                    <>
                      <Ionicons name="images-outline" size={20} color={colors.text.light} />
                      <Text style={styles.actionButtonText}>Ouvrir la galerie</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
          
          {selectedMedia.length > 0 && (
            <Animated.View
              entering={FadeIn}
              style={styles.selectedContainer}
            >
              <View style={styles.selectedHeader}>
                <Text style={styles.selectedCount}>
                  {selectedMedia.length} média{selectedMedia.length > 1 ? 'x' : ''} sélectionné{selectedMedia.length > 1 ? 's' : ''}
                </Text>
              </View>
              <FlatList
                data={selectedMedia}
                renderItem={renderMediaItem}
                keyExtractor={(item, index) => `${item.uri}-${index}`}
                numColumns={GRID_COLUMNS}
                contentContainerStyle={styles.mediaGrid}
                scrollEnabled={true}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
                initialNumToRender={9}
              />
            </Animated.View>
          )}
        </View>
      );
    }

    if (activeTab === 'camera') {
      return (
        <View style={styles.tabContent}>
          <View style={styles.actionSection}>
            <Animated.View style={buttonScaleStyle}>
              <TouchableOpacity
                style={styles.actionButtonContainer}
                onPress={handleTakePhoto}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[colors.primary.main, colors.primary.dark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionButton}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.text.light} />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={20} color={colors.text.light} />
                      <Text style={styles.actionButtonText}>Prendre une photo</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
          
          {selectedMedia.length > 0 && (
            <Animated.View
              entering={FadeIn}
              style={styles.selectedContainer}
            >
              <View style={styles.selectedHeader}>
                <Text style={styles.selectedCount}>
                  {selectedMedia.length} média{selectedMedia.length > 1 ? 'x' : ''} sélectionné{selectedMedia.length > 1 ? 's' : ''}
                </Text>
              </View>
              <FlatList
                data={selectedMedia}
                renderItem={renderMediaItem}
                keyExtractor={(item, index) => `${item.uri}-${index}`}
                numColumns={GRID_COLUMNS}
                contentContainerStyle={styles.mediaGrid}
                scrollEnabled={true}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
                initialNumToRender={9}
              />
            </Animated.View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={styles.actionSection}>
          <Animated.View style={buttonScaleStyle}>
            <TouchableOpacity
              style={styles.actionButtonContainer}
              onPress={handlePickDocument}
              disabled={loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[colors.secondary.main, colors.secondary.medium]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButton}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text.light} />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={20} color={colors.text.light} />
                    <Text style={styles.actionButtonText}>Sélectionner des documents</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
        
        {selectedMedia.length > 0 && (
          <Animated.View
            entering={FadeIn}
            style={styles.selectedContainer}
          >
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedCount}>
                {selectedMedia.length} document{selectedMedia.length > 1 ? 's' : ''} sélectionné{selectedMedia.length > 1 ? 's' : ''}
              </Text>
            </View>
            <FlatList
              data={selectedMedia}
              renderItem={({ item, index }) => (
                <Animated.View
                  entering={FadeIn.delay(index * 50)}
                  style={[styles.documentItem, { backgroundColor: withOpacity(colors.background.darkCard, 0.4) }]}
                >
                  <Ionicons name="document" size={24} color={colors.primary.main} />
                  <Text style={styles.documentName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Animated.View>
              )}
              keyExtractor={(item, index) => `${item.uri}-${index}`}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        )}
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={MESH_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.container} edges={['top']}>
          {/* Glassmorphism Header */}
          <View style={styles.headerGlass}>
            <LinearGradient
              colors={[withOpacity(colors.background.darkCard, 0.3), withOpacity(colors.background.darkCard, 0.1)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.header}
            >
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text.light} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                Sélectionner des médias
              </Text>
              <View style={styles.placeholder} />
            </LinearGradient>
          </View>

          {/* Pill Style Segmented Control */}
          <View style={styles.segmentedContainer}>
            <View style={styles.segmentedBackground}>
              <Animated.View
                style={[
                  styles.segmentedIndicator,
                  { backgroundColor: colors.primary.main },
                  tabIndicatorStyle,
                ]}
              />
              <View style={styles.segmentedButtons}>
                {(['gallery', 'camera', 'documents'] as TabType[]).map((tab, index) => (
                  <TouchableOpacity
                    key={tab}
                    style={styles.segmentedButton}
                    onPress={() => handleTabChange(tab)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.segmentedLabel,
                        {
                          color: activeTab === tab
                            ? colors.text.light
                            : withOpacity(colors.text.light, 0.6),
                          fontWeight: activeTab === tab
                            ? typography.fontWeight.semiBold
                            : typography.fontWeight.regular,
                        },
                      ]}
                    >
                      {tab === 'gallery' ? 'Galerie' : tab === 'camera' ? 'Caméra' : 'Documents'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>{renderTabContent()}</View>

          {/* Floating Confirm Button with Particles */}
          {particles.map(particle => (
            <Particle key={particle.id} particle={particle} />
          ))}
          <Animated.View
            style={[
              styles.confirmButtonContainer,
              confirmButtonStyle,
            ]}
            pointerEvents={selectedMedia.length > 0 ? 'auto' : 'none'}
          >
            <TouchableOpacity
              onPress={handleConfirm}
              style={styles.confirmButtonTouchable}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[colors.primary.main, colors.primary.dark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmButton}
              >
                <Text style={styles.confirmButtonText}>
                  Valider ({selectedMedia.length})
                </Text>
                <Ionicons name="checkmark-circle" size={20} color={colors.text.light} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerGlass: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: withOpacity(colors.text.light, 0.1),
    overflow: 'hidden',
  },
  closeButton: {
    padding: spacing.xs,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: typography.fontWeight.semiBold,
    fontSize: 18, // 18pt as specified
    color: colors.text.light,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif-medium',
      default: 'System',
    }),
  },
  placeholder: {
    width: 40,
  },
  segmentedContainer: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  segmentedBackground: {
    flexDirection: 'row',
    backgroundColor: withOpacity(colors.background.darkCard, 0.3),
    borderRadius: borderRadius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: withOpacity(colors.text.light, 0.1),
    position: 'relative',
    overflow: 'hidden',
  },
  segmentedIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: (SCREEN_WIDTH - 48 - 8) / 3,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  segmentedButtons: {
    flex: 1,
    flexDirection: 'row',
    zIndex: 1,
  },
  segmentedButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    zIndex: 2,
  },
  segmentedLabel: {
    fontSize: 14, // 14pt as specified
    fontWeight: typography.fontWeight.medium,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif-medium',
      default: 'System',
    }),
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  tabContent: {
    flex: 1,
  },
  actionSection: {
    marginBottom: spacing.lg,
  },
  actionButtonContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    minHeight: 52,
  },
  actionButtonText: {
    color: colors.text.light,
    fontSize: 14, // 14pt semi-bold as specified
    fontWeight: typography.fontWeight.semiBold,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif-medium',
      default: 'System',
    }),
  },
  selectedContainer: {
    flex: 1,
    marginTop: spacing.sm,
  },
  selectedHeader: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
  },
  selectedCount: {
    fontSize: 13,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.light,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif-medium',
      default: 'System',
    }),
  },
  mediaGrid: {
    gap: 12,
    paddingBottom: spacing.xxl,
  },
  mediaItemContainer: {
    marginRight: 12,
    marginBottom: 12,
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 16, // As specified
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: withOpacity(colors.background.darkCard, 0.2),
    ...shadows.md,
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: withOpacity(colors.background.darkCard, 0.3),
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withOpacity(colors.background.dark, 0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: withOpacity(colors.background.dark, 0.8),
    borderRadius: borderRadius.md,
    padding: 4,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: withOpacity(colors.text.light, 0.1),
  },
  documentName: {
    flex: 1,
    fontSize: 13,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.light,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'System',
    }),
  },
  confirmButtonContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.base,
    zIndex: 1000,
  },
  confirmButtonTouchable: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    ...shadows.xl,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    minWidth: 140,
  },
  confirmButtonText: {
    color: colors.text.light,
    fontSize: 14, // 14pt semi-bold as specified
    fontWeight: typography.fontWeight.semiBold,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif-medium',
      default: 'System',
    }),
  },
});
