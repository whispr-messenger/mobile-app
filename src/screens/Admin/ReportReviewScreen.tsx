/**
 * ReportReviewScreen - Detailed report review with admin actions
 * Allows dismiss, warn, mute, ban with confirmation dialogs
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
import { useModerationStore } from "../../store/moderationStore";
import { sanctionsAPI } from "../../services/moderation/moderationApi";
import { AdminGate, ReportStatusBadge } from "../../components/Moderation";
import type { Report, ReportCategory } from "../../types/moderation";

type RouteParams = { ReportReview: { report: Report } };

const CATEGORY_ICONS: Record<ReportCategory, keyof typeof Ionicons.glyphMap> = {
  offensive: "alert-circle",
  spam: "mail-unread",
  nudity: "eye-off",
  violence: "skull",
  harassment: "megaphone",
  other: "ellipsis-horizontal-circle",
};

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  offensive: "Contenu offensant",
  spam: "Spam",
  nudity: "Nudité",
  violence: "Violence",
  harassment: "Harcèlement",
  other: "Autre",
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const ReportReviewScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "ReportReview">>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { resolveReport } = useModerationStore();

  const report = route.params.report;
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const categoryIcon = CATEGORY_ICONS[report.category] || "help-circle";
  const categoryLabel = CATEGORY_LABELS[report.category] || report.category;

  const handleAction = useCallback(
    (action: string, actionLabel: string, sanctionType?: string) => {
      const message = sanctionType
        ? `Cette action va résoudre le signalement et créer une sanction "${sanctionType}" pour l'utilisateur.`
        : `Cette action va résoudre le signalement comme "${actionLabel}".`;

      Alert.alert(
        `Confirmer : ${actionLabel}`,
        `${message}\n\nNotes : ${adminNotes || "(aucune)"}`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Confirmer",
            style: action === "dismiss" ? "default" : "destructive",
            onPress: async () => {
              setProcessing(true);
              try {
                await resolveReport(report.id, action, adminNotes || undefined);

                if (sanctionType) {
                  await sanctionsAPI.createSanction({
                    userId: report.reported_user_id,
                    type: sanctionType,
                    reason: `Signalement #${report.id.slice(0, 8)} - ${categoryLabel}: ${adminNotes || report.description || "N/A"}`,
                    evidenceRef: { reportId: report.id },
                    expiresAt:
                      sanctionType === "temp_ban"
                        ? new Date(Date.now() + 7 * 86400000).toISOString()
                        : undefined,
                  });
                }

                Alert.alert("Succès", "Signalement traité avec succès.", [
                  { text: "OK", onPress: () => navigation.goBack() },
                ]);
              } catch (e: any) {
                Alert.alert("Erreur", e.message || "Une erreur est survenue.");
              } finally {
                setProcessing(false);
              }
            },
          },
        ],
      );
    },
    [adminNotes, report, categoryLabel, resolveReport, navigation],
  );

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
              Examiner le signalement
            </Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Report Info */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: "rgba(254, 122, 92, 0.15)" },
                  ]}
                >
                  <Ionicons
                    name={categoryIcon}
                    size={28}
                    color={colors.primary.main}
                  />
                </View>
                <View style={styles.sectionHeaderInfo}>
                  <Text style={styles.sectionTitle}>{categoryLabel}</Text>
                  <Text style={styles.sectionSubtitle}>
                    {formatDate(report.created_at)}
                  </Text>
                </View>
                <ReportStatusBadge status={report.status} size="medium" />
              </View>

              {report.description && (
                <View style={styles.descriptionBox}>
                  <Text style={styles.descriptionLabel}>Description</Text>
                  <Text style={styles.descriptionText}>
                    {report.description}
                  </Text>
                </View>
              )}

              {report.auto_escalated && (
                <View style={styles.escalatedBadge}>
                  <Ionicons name="flash" size={16} color="#F5A623" />
                  <Text style={styles.escalatedText}>Auto-escaladé</Text>
                </View>
              )}
            </View>

            {/* Evidence Section */}
            {report.evidence && Object.keys(report.evidence).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Preuve</Text>
                {report.evidence.message_content && (
                  <View style={styles.evidenceBox}>
                    <Ionicons
                      name="chatbubble"
                      size={16}
                      color="rgba(255,255,255,0.5)"
                    />
                    <View style={styles.evidenceContent}>
                      <Text style={styles.evidenceLabel}>Message original</Text>
                      <Text style={styles.evidenceText}>
                        {report.evidence.message_content}
                      </Text>
                      {report.evidence.sender_id && (
                        <Text style={styles.evidenceMeta}>
                          Envoyé par : {report.evidence.sender_id.slice(0, 8)}
                          ...
                        </Text>
                      )}
                      {report.evidence.timestamp && (
                        <Text style={styles.evidenceMeta}>
                          {formatDate(report.evidence.timestamp)}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
                {!report.evidence.message_content && (
                  <View style={styles.evidenceBox}>
                    <Ionicons
                      name="document-text"
                      size={16}
                      color="rgba(255,255,255,0.5)"
                    />
                    <Text style={styles.evidenceText}>
                      {JSON.stringify(report.evidence, null, 2)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Reported User */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Utilisateur signalé</Text>
              <View style={styles.userRow}>
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: "rgba(255,59,48,0.15)" },
                  ]}
                >
                  <Ionicons name="person" size={20} color="#FF3B30" />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userId}>{report.reported_user_id}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("UserModeration", {
                        userId: report.reported_user_id,
                      })
                    }
                  >
                    <Text style={styles.viewProfileLink}>
                      Voir le profil de modération
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Reporter */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Signalé par</Text>
              <View style={styles.userRow}>
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: "rgba(103,116,189,0.15)" },
                  ]}
                >
                  <Ionicons name="person" size={20} color="#6774BD" />
                </View>
                <Text style={styles.userId}>{report.reporter_id}</Text>
              </View>
            </View>

            {/* Admin Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes admin</Text>
              <TextInput
                style={styles.notesInput}
                value={adminNotes}
                onChangeText={setAdminNotes}
                placeholder="Ajoutez vos notes ici..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Already resolved? */}
            {report.resolution && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Résolution précédente</Text>
                <View style={styles.resolutionBox}>
                  <Text style={styles.resolutionText}>
                    Action : {report.resolution.action}
                  </Text>
                  <Text style={styles.resolutionMeta}>
                    Par : {report.resolution.resolved_by.slice(0, 8)}...
                  </Text>
                  {report.resolution.notes && (
                    <Text style={styles.resolutionMeta}>
                      Notes : {report.resolution.notes}
                    </Text>
                  )}
                </View>
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Action Buttons */}
          {!report.resolution && (
            <View style={styles.actionsContainer}>
              {processing ? (
                <ActivityIndicator size="large" color={colors.primary.main} />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#8E8E93" }]}
                    onPress={() => handleAction("dismiss", "Rejeter")}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Rejeter</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#F5A623" }]}
                    onPress={() => handleAction("warn", "Avertir", "warning")}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="warning" size={18} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Avertir</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#FF6B35" }]}
                    onPress={() => handleAction("mute", "Muter", "temp_ban")}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="volume-mute" size={18} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Muter</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#FF3B30" }]}
                    onPress={() => handleAction("ban", "Bannir", "temp_ban")}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="ban" size={18} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Bannir</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 10,
  },
  descriptionBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 22,
  },
  escalatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
    backgroundColor: "rgba(245, 166, 35, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  escalatedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F5A623",
  },
  evidenceBox: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  evidenceContent: {
    flex: 1,
  },
  evidenceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
    marginBottom: 4,
  },
  evidenceText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 20,
  },
  evidenceMeta: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.4)",
    marginTop: 4,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarPlaceholder: {
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
  userId: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    fontFamily: "monospace",
    marginLeft: 10,
  },
  viewProfileLink: {
    fontSize: 13,
    color: colors.primary.main,
    fontWeight: "500",
    marginTop: 2,
  },
  notesInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  resolutionBox: {
    backgroundColor: "rgba(76, 217, 100, 0.1)",
    borderRadius: 8,
    padding: 12,
  },
  resolutionText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "600",
  },
  resolutionMeta: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 4,
  },
  bottomSpacer: {
    height: 100,
  },
  actionsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
