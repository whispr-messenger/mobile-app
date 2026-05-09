/**
 * AppealFormScreen - Formulaire de contestation d'une sanction
 * Form to submit an appeal against a sanction with reason and optional evidence
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { useModerationStore } from "../../store/moderationStore";
import type { UserSanction, SanctionType } from "../../types/moderation";

type RouteParams = {
  AppealForm: { sanction: UserSanction };
};

const MIN_CHARS = 50;
const MAX_CHARS = 2000;
const MAX_IMAGES = 3;

const SANCTION_LABELS: Record<SanctionType, string> = {
  warning: "Avertissement",
  temp_ban: "Suspension temporaire",
  perm_ban: "Bannissement permanent",
};

const SANCTION_COLORS: Record<SanctionType, string> = {
  warning: "#F5A623",
  temp_ban: "#FF3B30",
  perm_ban: "#FF3B30",
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const AppealFormScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "AppealForm">>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { createAppeal } = useModerationStore();
  const { sanction } = route.params;

  const [reason, setReason] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const charCount = reason.length;
  const isValid = charCount >= MIN_CHARS;
  const sanctionColor = SANCTION_COLORS[sanction.type] || "#FF3B30";
  const sanctionLabel = SANCTION_LABELS[sanction.type] || sanction.type;

  const charCountColor = useMemo(() => {
    if (charCount === 0) return themeColors.text.tertiary;
    if (charCount < MIN_CHARS) return "#FF3B30";
    if (charCount > MAX_CHARS * 0.9) return "#F5A623";
    return "#4CD964";
  }, [charCount, themeColors.text.tertiary]);

  const handlePickImage = useCallback(async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert(
        "Limite atteinte",
        `Vous pouvez ajouter au maximum ${MAX_IMAGES} images.`,
      );
      return;
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission requise",
        "Veuillez autoriser l'accès à la galerie photo.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImages((prev) => [...prev, result.assets[0].uri]);
    }
  }, [images.length]);

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;

    Alert.alert(
      "Confirmer la contestation",
      "Êtes-vous sûr de vouloir soumettre cette contestation ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Soumettre",
          onPress: async () => {
            try {
              setSubmitting(true);
              const evidence: Record<string, any> = {};
              if (images.length > 0) {
                evidence.images = images;
              }
              await createAppeal(
                sanction.id,
                reason,
                Object.keys(evidence).length > 0 ? evidence : undefined,
              );
              navigation.replace("AppealStatus", { sanctionId: sanction.id });
            } catch (error: any) {
              Alert.alert(
                "Erreur",
                error.message || "Impossible de soumettre la contestation.",
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }, [isValid, reason, images, sanction.id, createAppeal, navigation]);

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: "transparent" }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, { color: themeColors.text.primary }]}
          >
            Contester la décision
          </Text>
          <View style={styles.placeholder} />
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Sanction Summary */}
            <View
              style={[
                styles.sanctionSummary,
                { backgroundColor: themeColors.background.secondary },
              ]}
            >
              <View style={styles.sanctionHeader}>
                <View
                  style={[
                    styles.sanctionBadge,
                    { backgroundColor: sanctionColor + "20" },
                  ]}
                >
                  <Ionicons name="ban" size={16} color={sanctionColor} />
                  <Text style={[styles.sanctionType, { color: sanctionColor }]}>
                    {sanctionLabel}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.sanctionDate,
                    { color: themeColors.text.tertiary },
                  ]}
                >
                  {formatDate(sanction.createdAt)}
                </Text>
              </View>
              <Text
                style={[
                  styles.sanctionReason,
                  { color: themeColors.text.secondary },
                ]}
              >
                {sanction.reason}
              </Text>
            </View>

            {/* Appeal Reason */}
            <View
              style={[
                styles.section,
                { backgroundColor: themeColors.background.secondary },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: themeColors.text.primary },
                ]}
              >
                Motif de la contestation
              </Text>
              <Text
                style={[
                  styles.sectionHint,
                  { color: themeColors.text.tertiary },
                ]}
              >
                Expliquez pourquoi vous pensez que cette sanction est
                injustifiée (minimum {MIN_CHARS} caractères)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: themeColors.text.primary,
                    backgroundColor: "rgba(0, 0, 0, 0.15)",
                    borderColor: isValid
                      ? "rgba(76, 217, 100, 0.3)"
                      : charCount > 0
                        ? "rgba(255, 59, 48, 0.3)"
                        : "transparent",
                  },
                ]}
                placeholder="Décrivez votre situation et les raisons de votre contestation..."
                placeholderTextColor={themeColors.text.tertiary}
                multiline
                maxLength={MAX_CHARS}
                value={reason}
                onChangeText={setReason}
                textAlignVertical="top"
              />
              <View style={styles.charCountRow}>
                <Text style={[styles.charCountText, { color: charCountColor }]}>
                  {charCount}/{MAX_CHARS}
                </Text>
                {charCount > 0 && charCount < MIN_CHARS && (
                  <Text style={[styles.charMinHint, { color: "#FF3B30" }]}>
                    {MIN_CHARS - charCount} caractères restants minimum
                  </Text>
                )}
              </View>
            </View>

            {/* Evidence Images */}
            <View
              style={[
                styles.section,
                { backgroundColor: themeColors.background.secondary },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: themeColors.text.primary },
                ]}
              >
                Preuves (optionnel)
              </Text>
              <Text
                style={[
                  styles.sectionHint,
                  { color: themeColors.text.tertiary },
                ]}
              >
                Ajoutez jusqu'à {MAX_IMAGES} captures d'écran pour appuyer votre
                contestation
              </Text>

              <View style={styles.imagesRow}>
                {images.map((uri, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image
                      source={{ uri }}
                      style={styles.imagePreview}
                      accessibilityLabel={`Preuve ${index + 1}`}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <Ionicons name="close-circle" size={22} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}

                {images.length < MAX_IMAGES && (
                  <TouchableOpacity
                    style={[
                      styles.addImageButton,
                      { borderColor: themeColors.text.tertiary + "40" },
                    ]}
                    onPress={handlePickImage}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={28}
                      color={themeColors.text.tertiary}
                    />
                    <Text
                      style={[
                        styles.addImageText,
                        { color: themeColors.text.tertiary },
                      ]}
                    >
                      Ajouter
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.submitContainer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor:
                    isValid && !submitting
                      ? colors.primary.main
                      : colors.primary.main + "40",
                },
              ]}
              onPress={handleSubmit}
              disabled={!isValid || submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>
                    Soumettre la contestation
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
  },
  placeholder: {
    width: 36,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 16,
  },
  sanctionSummary: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sanctionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sanctionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  sanctionType: {
    fontSize: 13,
    fontWeight: "700",
  },
  sanctionDate: {
    fontSize: 12,
  },
  sanctionReason: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  textInput: {
    minHeight: 140,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
  },
  charCountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  charCountText: {
    fontSize: 12,
    fontWeight: "600",
  },
  charMinHint: {
    fontSize: 12,
  },
  imagesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageWrapper: {
    position: "relative",
  },
  imagePreview: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
  removeImageButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 11,
  },
  addImageButton: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  addImageText: {
    fontSize: 11,
    fontWeight: "600",
  },
  submitContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
