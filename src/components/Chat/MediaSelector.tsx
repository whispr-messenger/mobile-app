/**
 * MediaSelector - Enhanced media picker with multiple selection, videos, and documents
 * WHISPR-265: Améliorer le sélecteur de media existant
 */

import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  ScrollView,
  Image,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
// @ts-ignore
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { colors, withOpacity } from "../../theme/colors";
import { typography, textStyles } from "../../theme/typography";
import { spacing, borderRadius, shadows } from "../../theme/spacing";
import { compressImage } from "../../utils/imageCompression";

export interface SelectedMedia {
  uri: string;
  type: "image" | "video" | "file";
  filename?: string;
  size?: number;
  mimeType?: string;
}

interface MediaSelectorProps {
  visible: boolean;
  onClose: () => void;
  onMediaSelected: (media: SelectedMedia[]) => void;
  maxSelection?: number;
  allowMultiple?: boolean;
}

export const MediaSelector: React.FC<MediaSelectorProps> = ({
  visible,
  onClose,
  onMediaSelected,
  maxSelection = 10,
  allowMultiple = true,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);

  // Request permissions for media library
  const requestMediaPermissions = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission requise",
        "Nous avons besoin de votre permission pour accéder à vos médias.",
      );
      return false;
    }
    return true;
  }, []);

  // Handle image/video selection
  const handlePickMedia = useCallback(async () => {
    const hasPermission = await requestMediaPermissions();
    if (!hasPermission) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: allowMultiple,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Process each asset (compress images)
        const processedMedia: SelectedMedia[] = await Promise.all(
          result.assets.map(async (asset: any) => {
            let finalUri = asset.uri;

            // Compress images (not videos)
            if (asset.type === "image") {
              try {
                finalUri = await compressImage(asset.uri, {
                  maxWidth: 1920,
                  maxHeight: 1920,
                  quality: 0.8,
                });
              } catch (error) {
                console.error(
                  "[MediaSelector] Error compressing image:",
                  error,
                );
                // Use original URI if compression fails
              }
            }

            return {
              uri: finalUri,
              type: asset.type === "video" ? "video" : "image",
              filename:
                asset.fileName ||
                `media_${Date.now()}.${asset.type === "video" ? "mp4" : "jpg"}`,
              size: asset.fileSize || 0,
              mimeType:
                asset.mimeType ||
                (asset.type === "video" ? "video/mp4" : "image/jpeg"),
            };
          }),
        );

        if (allowMultiple) {
          const combined = [...selectedMedia, ...processedMedia].slice(
            0,
            maxSelection,
          );
          setSelectedMedia(combined);
        } else {
          setSelectedMedia(processedMedia.slice(0, 1));
        }
      }
    } catch (error: any) {
      console.error("[MediaSelector] Error picking media:", error);
      Alert.alert("Erreur", "Impossible de sélectionner les médias.");
    }
  }, [allowMultiple, maxSelection, requestMediaPermissions, selectedMedia]);

  // Handle document selection
  const handlePickDocuments = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: allowMultiple,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newMedia: SelectedMedia[] = result.assets.map((asset: any) => ({
          uri: asset.uri,
          type: "file",
          filename: asset.name || `document_${Date.now()}`,
          size: asset.size || 0,
          mimeType: asset.mimeType || "application/octet-stream",
        }));

        if (allowMultiple) {
          const combined = [...selectedMedia, ...newMedia].slice(
            0,
            maxSelection,
          );
          setSelectedMedia(combined);
        } else {
          setSelectedMedia(newMedia.slice(0, 1));
        }
      }
    } catch (error: any) {
      console.error("[MediaSelector] Error picking documents:", error);
      Alert.alert("Erreur", "Impossible de sélectionner les documents.");
    }
  }, [allowMultiple, maxSelection, selectedMedia]);

  // Remove selected media
  const handleRemoveMedia = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Confirm selection
  const handleConfirm = useCallback(() => {
    if (selectedMedia.length === 0) {
      Alert.alert("Aucun média", "Veuillez sélectionner au moins un média.");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onMediaSelected(selectedMedia);
    setSelectedMedia([]);
    onClose();
  }, [selectedMedia, onMediaSelected, onClose]);

  // Cancel selection
  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMedia([]);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: themeColors.background.primary },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[styles.headerTitle, { color: themeColors.text.primary }]}
            >
              Sélectionner des médias
            </Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Ionicons
                name="close"
                size={24}
                color={themeColors.text.secondary}
              />
            </TouchableOpacity>
          </View>

          {/* Selection buttons */}
          <View style={styles.selectionButtons}>
            <TouchableOpacity
              style={[
                styles.selectionButton,
                { backgroundColor: withOpacity(themeColors.primary, 0.1) },
              ]}
              onPress={handlePickMedia}
            >
              <Ionicons name="images" size={24} color={themeColors.primary} />
              <Text
                style={[
                  styles.selectionButtonText,
                  { color: themeColors.primary },
                ]}
              >
                Photos/Vidéos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.selectionButton,
                { backgroundColor: withOpacity(themeColors.secondary, 0.1) },
              ]}
              onPress={handlePickDocuments}
            >
              <Ionicons
                name="document"
                size={24}
                color={themeColors.secondary}
              />
              <Text
                style={[
                  styles.selectionButtonText,
                  { color: themeColors.secondary },
                ]}
              >
                Documents
              </Text>
            </TouchableOpacity>
          </View>

          {/* Selected media preview */}
          {selectedMedia.length > 0 && (
            <View style={styles.previewContainer}>
              <Text
                style={[
                  styles.previewTitle,
                  { color: themeColors.text.secondary },
                ]}
              >
                {selectedMedia.length} média
                {selectedMedia.length > 1 ? "s" : ""} sélectionné
                {selectedMedia.length > 1 ? "s" : ""}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.previewScroll}
              >
                {selectedMedia.map((media, index) => (
                  <View key={index} style={styles.previewItem}>
                    {media.type === "image" ? (
                      <Image
                        source={{ uri: media.uri }}
                        style={styles.previewImage}
                      />
                    ) : media.type === "video" ? (
                      <View
                        style={[
                          styles.previewVideo,
                          {
                            backgroundColor: withOpacity(
                              themeColors.primary,
                              0.2,
                            ),
                          },
                        ]}
                      >
                        <Ionicons
                          name="videocam"
                          size={32}
                          color={themeColors.primary}
                        />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.previewFile,
                          {
                            backgroundColor: withOpacity(
                              themeColors.secondary,
                              0.2,
                            ),
                          },
                        ]}
                      >
                        <Ionicons
                          name="document"
                          size={32}
                          color={themeColors.secondary}
                        />
                        <Text
                          style={[
                            styles.previewFileName,
                            { color: themeColors.text.secondary },
                          ]}
                          numberOfLines={1}
                        >
                          {media.filename || "Document"}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveMedia(index)}
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={colors.ui.error}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                {
                  backgroundColor: withOpacity(themeColors.text.secondary, 0.1),
                },
              ]}
              onPress={handleCancel}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  { color: themeColors.text.secondary },
                ]}
              >
                Annuler
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: themeColors.primary },
              ]}
              onPress={handleConfirm}
              disabled={selectedMedia.length === 0}
            >
              <Text
                style={[styles.confirmButtonText, { color: colors.text.light }]}
              >
                Envoyer ({selectedMedia.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.base * 2,
    maxHeight: "80%",
    ...shadows.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerTitle: {
    ...textStyles.h3,
    fontWeight: "600",
  },
  closeButton: {
    padding: spacing.sm,
  },
  selectionButtons: {
    flexDirection: "row",
    padding: spacing.base,
    gap: spacing.base,
  },
  selectionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  selectionButtonText: {
    ...textStyles.body,
    fontWeight: "600",
  },
  previewContainer: {
    padding: spacing.base,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  previewTitle: {
    ...textStyles.caption,
    marginBottom: spacing.sm,
  },
  previewScroll: {
    marginTop: spacing.sm,
  },
  previewItem: {
    marginRight: spacing.sm,
    position: "relative",
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
  },
  previewVideo: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  previewFile: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.sm,
  },
  previewFileName: {
    ...textStyles.caption,
    marginTop: spacing.sm / 2,
    fontSize: 10,
  },
  removeButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: colors.background.dark,
    borderRadius: 12,
  },
  actionButtons: {
    flexDirection: "row",
    padding: spacing.base,
    gap: spacing.base,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    alignItems: "center",
  },
  cancelButtonText: {
    ...textStyles.body,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    alignItems: "center",
  },
  confirmButtonText: {
    ...textStyles.body,
    fontWeight: "600",
  },
});
