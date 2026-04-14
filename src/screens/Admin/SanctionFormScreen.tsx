/**
 * SanctionFormScreen - Manual sanction creation form
 * Type picker, reason input, duration picker, submit with confirmation
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { sanctionsAPI } from "../../services/moderation/moderationApi";
import { AdminGate, SanctionBadge } from "../../components/Moderation";
import type { SanctionType } from "../../types/moderation";

type RouteParams = {
  SanctionForm: {
    userId?: string;
    userName?: string;
    defaultType?: SanctionType;
  };
};

const SANCTION_TYPES: { key: SanctionType; label: string; description: string }[] = [
  { key: "warning", label: "Avertissement", description: "Notifie l'utilisateur sans restriction" },
  { key: "temp_ban", label: "Ban temporaire", description: "Suspension temporaire du compte" },
  { key: "perm_ban", label: "Ban permanent", description: "Suspension d\u00e9finitive du compte" },
];

const DURATION_OPTIONS: { label: string; days: number }[] = [
  { label: "1 jour", days: 1 },
  { label: "3 jours", days: 3 },
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "Personnalis\u00e9", days: 0 },
];

export const SanctionFormScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "SanctionForm">>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const targetUserId = route.params?.userId || "";
  const targetUserName = route.params?.userName;

  const [sanctionType, setSanctionType] = useState<SanctionType>(
    route.params?.defaultType || "warning",
  );
  const [reason, setReason] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(7);
  const [customDays, setCustomDays] = useState("");
  const [userIdInput, setUserIdInput] = useState(targetUserId);
  const [submitting, setSubmitting] = useState(false);

  const effectiveDays =
    selectedDuration === 0 ? parseInt(customDays, 10) || 1 : selectedDuration;

  const handleSubmit = useCallback(() => {
    const uid = userIdInput.trim();
    if (!uid) {
      Alert.alert("Erreur", "Veuillez sp\u00e9cifier l'ID de l'utilisateur.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Erreur", "Veuillez sp\u00e9cifier une raison.");
      return;
    }

    const typeLabel = SANCTION_TYPES.find((t) => t.key === sanctionType)?.label || sanctionType;
    const durationInfo =
      sanctionType === "temp_ban" ? `\nDur\u00e9e : ${effectiveDays} jour(s)` : "";

    Alert.alert(
      "Confirmer la sanction",
      `Type : ${typeLabel}\nUtilisateur : ${uid.slice(0, 12)}...${durationInfo}\nRaison : ${reason}`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          style: "destructive",
          onPress: async () => {
            setSubmitting(true);
            try {
              const expiresAt =
                sanctionType === "temp_ban"
                  ? new Date(Date.now() + effectiveDays * 86400000).toISOString()
                  : undefined;

              await sanctionsAPI.createSanction({
                userId: uid,
                type: sanctionType,
                reason: reason.trim(),
                expiresAt,
              });

              Alert.alert("Succ\u00e8s", "Sanction cr\u00e9\u00e9e avec succ\u00e8s.", [
                { text: "OK", onPress: () => navigation.goBack() },
              ]);
            } catch (e: any) {
              Alert.alert("Erreur", e.message || "Une erreur est survenue.");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }, [userIdInput, reason, sanctionType, effectiveDays, navigation]);

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <AdminGate>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
              Nouvelle sanction
            </Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* User Info */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Utilisateur cible</Text>
              {targetUserName ? (
                <View style={styles.userRow}>
                  <View style={[styles.avatarSmall, { backgroundColor: "rgba(254,122,92,0.15)" }]}>
                    <Ionicons name="person" size={18} color={colors.primary.main} />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{targetUserName}</Text>
                    <Text style={styles.userIdDisplay}>{targetUserId}</Text>
                  </View>
                </View>
              ) : (
                <TextInput
                  style={styles.textInput}
                  value={userIdInput}
                  onChangeText={setUserIdInput}
                  placeholder="ID de l'utilisateur"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="none"
                />
              )}
            </View>

            {/* Sanction Type */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Type de sanction</Text>
              {SANCTION_TYPES.map((type) => {
                const isSelected = sanctionType === type.key;
                return (
                  <TouchableOpacity
                    key={type.key}
                    style={[styles.typeOption, isSelected && styles.typeOptionSelected]}
                    onPress={() => setSanctionType(type.key)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.typeOptionLeft}>
                      <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <View style={styles.typeInfo}>
                        <SanctionBadge type={type.key} size="medium" />
                        <Text style={styles.typeDescription}>{type.description}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Duration (only for temp_ban) */}
            {sanctionType === "temp_ban" && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Dur\u00e9e</Text>
                <View style={styles.durationGrid}>
                  {DURATION_OPTIONS.map((opt) => {
                    const isSelected = selectedDuration === opt.days;
                    return (
                      <TouchableOpacity
                        key={opt.days}
                        style={[styles.durationChip, isSelected && styles.durationChipSelected]}
                        onPress={() => setSelectedDuration(opt.days)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.durationChipText, isSelected && styles.durationChipTextSelected]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {selectedDuration === 0 && (
                  <View style={styles.customDurationRow}>
                    <TextInput
                      style={[styles.textInput, styles.customDaysInput]}
                      value={customDays}
                      onChangeText={setCustomDays}
                      placeholder="Nombre de jours"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      keyboardType="numeric"
                    />
                    <Text style={styles.daysLabel}>jours</Text>
                  </View>
                )}
              </View>
            )}

            {/* Reason */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Raison</Text>
              <TextInput
                style={[styles.textInput, styles.reasonInput]}
                value={reason}
                onChangeText={setReason}
                placeholder="D\u00e9crivez la raison de cette sanction..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="hammer" size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Appliquer la sanction</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </AdminGate>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 10,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  userIdDisplay: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    fontFamily: "monospace",
    marginTop: 2,
  },
  textInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  typeOptionSelected: {
    borderColor: colors.primary.main,
    backgroundColor: "rgba(254, 122, 92, 0.08)",
  },
  typeOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  radioOuterSelected: {
    borderColor: colors.primary.main,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.main,
  },
  typeInfo: {
    flex: 1,
  },
  typeDescription: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 4,
  },
  durationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  durationChipSelected: {
    backgroundColor: colors.primary.main,
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
  },
  durationChipTextSelected: {
    color: "#FFFFFF",
  },
  customDurationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  customDaysInput: {
    flex: 1,
  },
  daysLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
  },
  reasonInput: {
    minHeight: 100,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  bottomSpacer: {
    height: 32,
  },
});
