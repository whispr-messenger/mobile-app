/**
 * AppealReviewScreen - Review an appeal with accept/reject actions
 * Shows appeal details, original sanction, and admin action buttons
 */

import React, { useState, useCallback, useEffect } from "react";
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
import { AdminGate, SanctionBadge } from "../../components/Moderation";
import type { Appeal, UserSanction } from "../../types/moderation";

type RouteParams = { AppealReview: { appeal: Appeal } };

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const AppealReviewScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "AppealReview">>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { reviewAppeal } = useModerationStore();

  const appeal = route.params.appeal;
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [sanction, setSanction] = useState<UserSanction | null>(null);
  const [loadingSanction, setLoadingSanction] = useState(true);

  useEffect(() => {
    sanctionsAPI
      .getSanction(appeal.sanctionId)
      .then(setSanction)
      .catch(() => {})
      .finally(() => setLoadingSanction(false));
  }, [appeal.sanctionId]);

  const handleAction = useCallback(
    (status: "accepted" | "rejected", actionLabel: string) => {
      const message =
        status === "accepted"
          ? "La sanction sera lev\u00e9e et l'utilisateur sera r\u00e9tabli."
          : "La sanction sera maintenue.";

      Alert.alert(
        `Confirmer : ${actionLabel}`,
        `${message}\n\nNotes : ${adminNotes || "(aucune)"}`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Confirmer",
            style: status === "rejected" ? "destructive" : "default",
            onPress: async () => {
              setProcessing(true);
              try {
                await reviewAppeal(appeal.id, status, adminNotes || undefined);

                if (status === "accepted" && sanction) {
                  try {
                    await sanctionsAPI.liftSanction(sanction.id);
                  } catch {
                    // sanction may already be expired
                  }
                }

                Alert.alert("Succ\u00e8s", "Appel trait\u00e9 avec succ\u00e8s.", [
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
    [adminNotes, appeal, sanction, reviewAppeal, navigation],
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
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
              Examiner l'appel
            </Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Appeal Details */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>D\u00e9tails de l'appel</Text>
              <View style={styles.userRow}>
                <View style={[styles.avatarPlaceholder, { backgroundColor: "rgba(103,116,189,0.15)" }]}>
                  <Ionicons name="person" size={20} color="#6774BD" />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userId}>{appeal.userId}</Text>
                  <Text style={styles.dateMeta}>
                    Soumis le {formatDate(appeal.createdAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Raison de l'appel</Text>
                <Text style={styles.reasonText}>{appeal.reason}</Text>
              </View>

              {/* Evidence images */}
              {appeal.evidence && Object.keys(appeal.evidence).length > 0 && (
                <View style={styles.evidenceSection}>
                  <Text style={styles.evidenceLabel}>Pi\u00e8ces jointes</Text>
                  {appeal.evidence.images && Array.isArray(appeal.evidence.images) ? (
                    appeal.evidence.images.map((img: string, idx: number) => (
                      <View key={idx} style={styles.evidenceItem}>
                        <Ionicons name="image" size={16} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.evidenceText} numberOfLines={1}>
                          {img}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.evidenceItem}>
                      <Ionicons name="document" size={16} color="rgba(255,255,255,0.5)" />
                      <Text style={styles.evidenceText}>
                        {JSON.stringify(appeal.evidence)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Original Sanction */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Sanction originale</Text>
              {loadingSanction ? (
                <ActivityIndicator size="small" color={colors.primary.main} />
              ) : sanction ? (
                <>
                  <View style={styles.sanctionRow}>
                    <SanctionBadge type={sanction.type} active={sanction.active} size="medium" />
                    {sanction.active && (
                      <View style={styles.activeDot}>
                        <Text style={styles.activeLabel}>Active</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.sanctionDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Raison</Text>
                      <Text style={styles.detailValue}>{sanction.reason}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailValue}>{formatDate(sanction.createdAt)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Par</Text>
                      <Text style={styles.detailValue}>{sanction.issuedBy.slice(0, 8)}...</Text>
                    </View>
                    {sanction.expiresAt && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Expire</Text>
                        <Text style={styles.detailValue}>{formatDate(sanction.expiresAt)}</Text>
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <Text style={styles.noData}>Sanction introuvable (ID: {appeal.sanctionId.slice(0, 8)}...)</Text>
              )}
            </View>

            {/* Previous review */}
            {appeal.reviewerId && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Examen pr\u00e9c\u00e9dent</Text>
                <Text style={styles.noData}>
                  Examin\u00e9 par {appeal.reviewerId.slice(0, 8)}...
                </Text>
                {appeal.reviewerNotes && (
                  <Text style={styles.previousNotes}>{appeal.reviewerNotes}</Text>
                )}
              </View>
            )}

            {/* Admin Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes de l'examinateur</Text>
              <TextInput
                style={styles.notesInput}
                value={adminNotes}
                onChangeText={setAdminNotes}
                placeholder="Expliquez votre d\u00e9cision..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Action Buttons */}
          {!appeal.resolvedAt && (
            <View style={styles.actionsContainer}>
              {processing ? (
                <ActivityIndicator size="large" color={colors.primary.main} />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleAction("rejected", "Rejeter l'appel")}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Rejeter l'appel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn]}
                    onPress={() => handleAction("accepted", "Accepter l'appel")}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Accepter l'appel</Text>
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
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 10,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  },
  dateMeta: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 2,
  },
  reasonBox: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 12,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 22,
  },
  evidenceSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  evidenceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
    marginBottom: 8,
  },
  evidenceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  evidenceText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.7)",
    flex: 1,
  },
  sanctionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  activeDot: {
    backgroundColor: "rgba(76, 217, 100, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4CD964",
  },
  sanctionDetails: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 12,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
    width: 70,
  },
  detailValue: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
    flex: 1,
  },
  noData: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    fontStyle: "italic",
  },
  previousNotes: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 6,
    fontStyle: "italic",
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
  bottomSpacer: {
    height: 100,
  },
  actionsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  rejectBtn: {
    backgroundColor: "#FF3B30",
  },
  acceptBtn: {
    backgroundColor: "#4CD964",
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
