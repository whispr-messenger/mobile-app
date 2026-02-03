/**
 * MediaPickerScreen - Media selection screen
 * WHISPR-252: Écran de sélection de médias (photos, vidéos, documents)
 */

import React, { useState, useCallback, useEffect } from 'react';
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
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { colors, withOpacity } from '../../theme/colors';
import { typography, textStyles } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - 32 - (GRID_COLUMNS - 1) * 8) / GRID_COLUMNS;

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

type MediaPickerScreenRouteProp = {
  params?: {
    conversationId?: string;
    onMediaSelected?: (media: SelectedMedia[]) => void;
  };
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

  const tabAnimation = useSharedValue(0);
  const buttonScale = useSharedValue(1);

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

  // Handle tab change with animation
  const handleTabChange = useCallback((tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    const tabIndex = tab === 'gallery' ? 0 : tab === 'camera' ? 1 : 2;
    tabAnimation.value = withSpring(tabIndex, {
      damping: 15,
      stiffness: 150,
    });
  }, [tabAnimation]);

  // Handle media selection
  const handleSelectMedia = useCallback((media: SelectedMedia) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
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

  // Handle confirm selection
  const handleConfirm = useCallback(() => {
    if (selectedMedia.length === 0) {
      Alert.alert('Aucun média sélectionné', 'Veuillez sélectionner au moins un média');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onMediaSelected?.(selectedMedia);
    navigation.goBack();
  }, [selectedMedia, onMediaSelected, navigation]);

  // Animated tab indicator
  const tabIndicatorStyle = useAnimatedStyle(() => {
    const tabWidth = (SCREEN_WIDTH - spacing.base * 2) / 3;
    const translateX = tabAnimation.value * tabWidth + spacing.base; // Centré avec padding
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

  const renderMediaItem = ({ item, index }: { item: SelectedMedia; index: number }) => {
    const isSelected = selectedMedia.some(m => m.uri === item.uri);
    
    return (
      <Animated.View
        entering={FadeIn.delay(index * 50)}
        exiting={FadeOut}
        style={styles.mediaItemContainer}
      >
        <TouchableOpacity
          style={styles.mediaItem}
          onPress={() => handleSelectMedia(item)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: item.uri }} style={styles.mediaThumbnail} />
          {isSelected && (
            <>
              <Animated.View
                entering={FadeIn}
                exiting={FadeOut}
                style={styles.selectedOverlay}
              />
              <Animated.View
                entering={FadeIn}
                exiting={FadeOut}
                style={styles.selectedBadge}
              >
                <Ionicons name="checkmark" size={16} color={colors.primary.main} />
              </Animated.View>
            </>
          )}
          {item.type === 'video' && (
            <View style={styles.videoBadge}>
              <Ionicons name="play-circle" size={16} color={colors.text.light} />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
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
                      <Ionicons name="images-outline" size={22} color={colors.text.light} />
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
                <Text style={[styles.selectedCount, { color: colors.text.light }]}>
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
                style={styles.cameraButtonContainer}
                onPress={handleTakePhoto}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[withOpacity(colors.primary.main, 0.8), withOpacity(colors.primary.dark, 0.9)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cameraButton}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.text.light} />
                  ) : (
                    <Ionicons name="camera" size={28} color={colors.text.light} />
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
                <Text style={[styles.selectedCount, { color: colors.text.light }]}>
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
                    <Ionicons name="document-text-outline" size={22} color={colors.text.light} />
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
              <Text style={[styles.selectedCount, { color: colors.text.light }]}>
                {selectedMedia.length} document{selectedMedia.length > 1 ? 's' : ''} sélectionné{selectedMedia.length > 1 ? 's' : ''}
              </Text>
            </View>
            <FlatList
              data={selectedMedia}
              renderItem={({ item }) => (
                <Animated.View
                  entering={FadeIn}
                  style={[styles.documentItem, { backgroundColor: withOpacity(colors.background.darkCard, 0.3) }]}
                >
                  <Ionicons name="document" size={28} color={colors.primary.main} />
                  <Text style={[styles.documentName, { color: colors.text.light }]} numberOfLines={1}>
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
    <LinearGradient
      colors={['#0A0E27', '#1A1F3A', '#2D1B4E']} // Dégradé plus lisse et sombre
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color={colors.text.light} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text.light }]}>
            Sélectionner des médias
          </Text>
          <TouchableOpacity
            onPress={handleConfirm}
            style={styles.confirmButton}
            disabled={selectedMedia.length === 0}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.confirmButtonText,
                {
                  color: selectedMedia.length > 0
                    ? colors.primary.main
                    : withOpacity(colors.text.light, 0.4),
                  fontWeight: selectedMedia.length > 0 ? typography.fontWeight.bold : typography.fontWeight.regular,
                },
              ]}
            >
              Valider ({selectedMedia.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[styles.tabsContainer, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => handleTabChange('gallery')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="images-outline"
              size={20}
              color={activeTab === 'gallery' ? colors.primary.main : withOpacity(colors.text.light, 0.5)}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: activeTab === 'gallery'
                    ? colors.primary.main
                    : withOpacity(colors.text.light, 0.5),
                  fontWeight: activeTab === 'gallery' ? typography.fontWeight.semiBold : typography.fontWeight.medium,
                },
              ]}
            >
              Galerie
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => handleTabChange('camera')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="camera-outline"
              size={20}
              color={activeTab === 'camera' ? colors.primary.main : withOpacity(colors.text.light, 0.5)}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: activeTab === 'camera'
                    ? colors.primary.main
                    : withOpacity(colors.text.light, 0.5),
                  fontWeight: activeTab === 'camera' ? typography.fontWeight.semiBold : typography.fontWeight.medium,
                },
              ]}
            >
              Caméra
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => handleTabChange('documents')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={activeTab === 'documents' ? colors.primary.main : withOpacity(colors.text.light, 0.5)}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: activeTab === 'documents'
                    ? colors.primary.main
                    : withOpacity(colors.text.light, 0.5),
                  fontWeight: activeTab === 'documents' ? typography.fontWeight.semiBold : typography.fontWeight.medium,
                },
              ]}
            >
              Documents
            </Text>
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.tabIndicator,
              { backgroundColor: colors.primary.main },
              tabIndicatorStyle,
            ]}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>{renderTabContent()}</View>
      </SafeAreaView>
    </LinearGradient>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.1),
    backgroundColor: 'transparent',
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: typography.fontWeight.medium, // Weight 500
    fontSize: typography.fontSize.lg,
    color: colors.text.light,
    letterSpacing: typography.letterSpacing.tight,
  },
  confirmButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  confirmButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold, // Plus épais pour ressortir
    color: colors.primary.main, // Couleur plus vive
  },
  tabsContainer: {
    flexDirection: 'row',
    position: 'relative',
    paddingHorizontal: spacing.base, // Plus d'espacement
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm, // Espacement horizontal entre les onglets
    gap: spacing.xs,
  },
  tabLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: spacing.sm,
    width: (SCREEN_WIDTH - spacing.base * 2) / 3 - spacing.sm * 2, // Centré sous le texte avec padding
    height: 2, // Plus fine (2px au lieu de 3px)
    borderRadius: borderRadius.full, // Bords arrondis
    alignSelf: 'center',
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
    ...shadows.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    minHeight: 48,
  },
  actionButtonText: {
    ...textStyles.button,
    color: colors.text.light,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },
  selectedContainer: {
    flex: 1,
    marginTop: spacing.sm,
  },
  selectedHeader: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.1),
  },
  selectedCount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text.light,
  },
  mediaGrid: {
    gap: spacing.sm,
    paddingBottom: spacing.base,
  },
  mediaItemContainer: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: borderRadius.lg, // 12px
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: withOpacity(colors.background.darkCard, 0.2),
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: withOpacity(colors.background.darkCard, 0.3),
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withOpacity(colors.background.dark, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadge: {
    width: 28, // Plus petit
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text.light, // Fond blanc
    borderWidth: 2, // Bordure blanche fine
    borderColor: colors.text.light,
    ...shadows.sm,
    position: 'absolute',
    top: spacing.xs, // Décalage du bord
    right: spacing.xs,
  },
  videoBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    backgroundColor: withOpacity(colors.background.dark, 0.7),
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  documentName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.light,
  },
  cameraButtonContainer: {
    borderRadius: borderRadius.xxl, // 20px+
    overflow: 'hidden',
    alignSelf: 'center',
    width: 80,
    height: 80,
    ...shadows.lg,
  },
  cameraButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
