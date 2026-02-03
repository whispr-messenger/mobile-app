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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
// Document picker will be implemented with native file system access
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

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
  const [galleryImages, setGalleryImages] = useState<SelectedMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const tabAnimation = useSharedValue(0);

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
    tabAnimation.value = withSpring(tab === 'gallery' ? 0 : tab === 'camera' ? 1 : 2);
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
  }, [hasPermission]);

  // Handle camera capture
  const handleTakePhoto = useCallback(async () => {
    if (!hasPermission) {
      Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la caméra');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
  }, [hasPermission]);

  // Handle document picker
  const handlePickDocument = useCallback(async () => {
    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Use ImagePicker for documents (will be replaced with proper document picker)
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
  }, []);

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
    const translateX = tabAnimation.value * (SCREEN_WIDTH / 3);
    return {
      transform: [{ translateX }],
    };
  });

  const renderMediaItem = ({ item, index }: { item: SelectedMedia; index: number }) => {
    const isSelected = selectedMedia.some(m => m.uri === item.uri);
    
    return (
      <TouchableOpacity
        style={styles.mediaItem}
        onPress={() => handleSelectMedia(item)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: item.uri }} style={styles.mediaThumbnail} />
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <LinearGradient
              colors={[colors.primary.main, colors.primary.dark]}
              style={styles.selectedBadge}
            >
              <Ionicons name="checkmark" size={20} color={colors.text.light} />
            </LinearGradient>
          </View>
        )}
        {item.type === 'video' && (
          <View style={styles.videoBadge}>
            <Ionicons name="play-circle" size={16} color={colors.text.light} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'gallery') {
      return (
        <View style={styles.tabContent}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
            onPress={handlePickFromGallery}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.text.light} />
            ) : (
              <>
                <Ionicons name="images-outline" size={24} color={colors.text.light} />
                <Text style={styles.actionButtonText}>Ouvrir la galerie</Text>
              </>
            )}
          </TouchableOpacity>
          
          {selectedMedia.length > 0 && (
            <View style={styles.selectedContainer}>
              <Text style={[styles.selectedCount, { color: themeColors.text.secondary }]}>
                {selectedMedia.length} média{selectedMedia.length > 1 ? 'x' : ''} sélectionné{selectedMedia.length > 1 ? 's' : ''}
              </Text>
              <FlatList
                data={selectedMedia}
                renderItem={renderMediaItem}
                keyExtractor={(item, index) => `${item.uri}-${index}`}
                numColumns={GRID_COLUMNS}
                contentContainerStyle={styles.mediaGrid}
                scrollEnabled={false}
              />
            </View>
          )}
        </View>
      );
    }

    if (activeTab === 'camera') {
      return (
        <View style={styles.tabContent}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
            onPress={handleTakePhoto}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.text.light} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={24} color={colors.text.light} />
                <Text style={styles.actionButtonText}>Prendre une photo</Text>
              </>
            )}
          </TouchableOpacity>
          
          {selectedMedia.length > 0 && (
            <View style={styles.selectedContainer}>
              <Text style={[styles.selectedCount, { color: themeColors.text.secondary }]}>
                {selectedMedia.length} média{selectedMedia.length > 1 ? 'x' : ''} sélectionné{selectedMedia.length > 1 ? 's' : ''}
              </Text>
              <FlatList
                data={selectedMedia}
                renderItem={renderMediaItem}
                keyExtractor={(item, index) => `${item.uri}-${index}`}
                numColumns={GRID_COLUMNS}
                contentContainerStyle={styles.mediaGrid}
                scrollEnabled={false}
              />
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
          onPress={handlePickDocument}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.text.light} />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={24} color={colors.text.light} />
              <Text style={styles.actionButtonText}>Sélectionner des documents</Text>
            </>
          )}
        </TouchableOpacity>
        
        {selectedMedia.length > 0 && (
          <View style={styles.selectedContainer}>
            <Text style={[styles.selectedCount, { color: themeColors.text.secondary }]}>
              {selectedMedia.length} document{selectedMedia.length > 1 ? 's' : ''} sélectionné{selectedMedia.length > 1 ? 's' : ''}
            </Text>
            <FlatList
              data={selectedMedia}
              renderItem={({ item }) => (
                <View style={styles.documentItem}>
                  <Ionicons name="document" size={32} color={themeColors.primary} />
                  <Text style={[styles.documentName, { color: themeColors.text.primary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              )}
              keyExtractor={(item, index) => `${item.uri}-${index}`}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background.primary }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.background.primary }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={28} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
          Sélectionner des médias
        </Text>
        <TouchableOpacity
          onPress={handleConfirm}
          style={[
            styles.confirmButton,
            selectedMedia.length > 0 && { opacity: 1 },
            selectedMedia.length === 0 && { opacity: 0.5 },
          ]}
          disabled={selectedMedia.length === 0}
        >
          <Text
            style={[
              styles.confirmButtonText,
              { color: selectedMedia.length > 0 ? themeColors.primary : themeColors.text.tertiary },
            ]}
          >
            Valider ({selectedMedia.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: themeColors.background.secondary }]}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => handleTabChange('gallery')}
        >
          <Ionicons
            name="images-outline"
            size={20}
            color={activeTab === 'gallery' ? themeColors.primary : themeColors.text.tertiary}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'gallery' ? themeColors.primary : themeColors.text.tertiary,
              },
            ]}
          >
            Galerie
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => handleTabChange('camera')}
        >
          <Ionicons
            name="camera-outline"
            size={20}
            color={activeTab === 'camera' ? themeColors.primary : themeColors.text.tertiary}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'camera' ? themeColors.primary : themeColors.text.tertiary,
              },
            ]}
          >
            Caméra
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => handleTabChange('documents')}
        >
          <Ionicons
            name="document-text-outline"
            size={20}
            color={activeTab === 'documents' ? themeColors.primary : themeColors.text.tertiary}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'documents' ? themeColors.primary : themeColors.text.tertiary,
              },
            ]}
          >
            Documents
          </Text>
        </TouchableOpacity>
        <Animated.View
          style={[
            styles.tabIndicator,
            { backgroundColor: themeColors.primary },
            tabIndicatorStyle,
          ]}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>{renderTabContent()}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.divider,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  confirmButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.divider,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: SCREEN_WIDTH / 3,
    height: 3,
    borderRadius: 1.5,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  tabContent: {
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  actionButtonText: {
    color: colors.text.light,
    fontSize: 16,
    fontWeight: '600',
  },
  selectedContainer: {
    flex: 1,
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  mediaGrid: {
    gap: 8,
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
    marginBottom: 8,
    position: 'relative',
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.secondary,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  documentName: {
    flex: 1,
    fontSize: 14,
  },
});
