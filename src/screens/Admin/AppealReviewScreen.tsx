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
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { useModerationStore } from "../../store/moderationStore";
import {
  sanctionsAPI,
  appealsAPI,
} from "../../services/moderation/moderationApi";
import { AdminGate, SanctionBadge } from "../../components/Moderation";
import type { Appeal, UserSanction } from "../../types/moderation";

// Route accepts either a full appeal object (legacy) or an appealId (preferred).
// Passing the full object triggers "[object Object]" in the web URL — always
// prefer the id form from navigators.
type RouteParams = {
  AppealReview: { appealId?: string; appeal?: Appeal };
};

const confirmAction = (
  title: string,
  message: string,
  onConfirm: () => void,
  isDestructive: boolean,
) => {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    if (
      typeof window !== "undefined" &&
      window.confirm(`${title}\n\n${message}`)
    ) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: "Annuler", style: "cancel" },
    {
      text: "Confirmer",
      style: isDestructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
};

const notify = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-alert
      window.alert(`${title}\n\n${message}`);
    }
    onOk?.();
    return;
  }
  Alert.alert(title, message, [{ text: "OK", onPress: onOk }]);
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

export const AppealReviewScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "AppealReview">>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { reviewAppeal, appealQueue } = useModerationStore();

  // Prefer resolving by appealId (string) so the URL stays clean on web and
  // the data always reflects the freshest server state. Fallback to the
  // inline object for legacy callers.
  const routeAppealId =
    route.params.appealId ?? route.params.appeal?.id ?? null;
  const appealFromQueue = routeAppealId
    ? appealQueue.find((a) => a.id === routeAppealId)
    : undefined;

  const [appeal, setAppeal] = useState<Appeal | null>(
    appealFromQueue ?? route.params.appeal ?? null,
  );
  const [loadingAppeal, setLoadingAppeal] = useState(
    !appeal && !!routeAppealId,
  );

  useEffect(() => {
    if (appeal || !routeAppealId) return;
    let cancelled = false;
    setLoadingAppeal(true);
    appealsAPI
      .getAppeal(routeAppealId)
      .then((fresh) => {
        if (!cancelled) setAppeal(fresh);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingAppeal(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routeAppealId, appeal]);

  const isBlockedImage = appeal?.type === "blocked_image";
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [sanction, setSanction] = useState<UserSanction | null>(null);
  const [loadingSanction, setLoadingSanction] = useState(false);

  useEffect(() => {
    if (!appeal || isBlockedImage || !appeal.sanctionId) {
      setLoadingSanction(false);
      return;
    }
    setLoadingSanction(true);
    sanctionsAPI
      .getSanction(appeal.sanctionId)
      .then(setSanction)
      .catch(() => {})
      .finally(() => setLoadingSanction(false));
  }, [appeal, isBlockedImage]);

  const handleAction = useCallback(
    (status: "accepted" | "rejected", actionLabel: string) => {
      if (!appeal) return;
      const message =
        status === "accepted"
          ? "La sanction sera levée et l'utilisateur sera rétabli."
          : "La sanction sera maintenue.";

      const confirmMessage = isBlockedImage
        ? status === "accepted"
          ? "L'image sera renvoyée à l'utilisateur."
          : "L'image restera bloquée."
        : message;

      confirmAction(
        `Confirmer : ${actionLabel}`,
        `${confirmMessage}\n\nNotes : ${adminNotes || "(aucune)"}`,
        async () => {
          setProcessing(true);
          try {
            await reviewAppeal(appeal.id, status, adminNotes || undefined);

            if (status === "accepted" && sanction && !isBlockedImage) {
              try {
                await sanctionsAPI.liftSanction(sanction.id);
              } catch {
                // sanction may already be expired
              }
            }

            notify("Succès", "Appel traité avec succès.", () =>
              navigation.goBack(),
            );
          } catch (e: any) {
            notify("Erreur", e.message || "Une erreur est survenue.");
          } finally {
            setProcessing(false);
          }
        },
        status === "rejected",
      );
    },
    [adminNotes, appeal, sanction, reviewAppeal, navigation, isBlockedImage],
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
              Examiner l'appel
            </Text>
            <View style={styles.placeholder} />
          </View>

          {!appeal ? (
            <View style={styles.loadingFull}>
              {loadingAppeal ? (
                <ActivityIndicator size="large" color={colors.primary.main} />
              ) : (
                <Text style={styles.noData}>Appel introuvable</Text>
              )}
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* Blocked image preview */}
              {isBlockedImage ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Image contestée</Text>
                  {appeal.evidence?.thumbnailBase64 ? (
                    <Image
                      source={{
                        uri: `data:image/jpeg;base64,${appeal.evidence.thumbnailBase64}`,
                      }}
                      style={styles.blockedPreview}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.noData}>
                      Aucune miniature transmise
                    </Text>
                  )}
                  {appeal.evidence?.blockReason ? (
                    <View style={styles.reasonBox}>
                      <Text style={styles.reasonLabel}>Raison du blocage</Text>
                      <Text style={styles.reasonText}>
                        {appeal.evidence.blockReason}
                      </Text>
                    </View>
                  ) : null}
                  {appeal.evidence?.scores &&
                  Object.keys(appeal.evidence.scores).length > 0 ? (
                    <View style={styles.scoresBox}>
                      <Text style={styles.reasonLabel}>
                        Scores du classifier
                      </Text>
                      {Object.entries(appeal.evidence.scores).map(([k, v]) => (
                        <View key={k} style={styles.scoreRow}>
                          <Text style={styles.scoreKey}>{k}</Text>
                          <Text style={styles.scoreVal}>
                            {typeof v === "number" ? v.toFixed(3) : String(v)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Appeal Details */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Détails de l'appel</Text>
                <View style={styles.userRow}>
                  <View
                    style={[
                      styles.avatarPlaceholder,
                      { backgroundColor: "rgba(103,116,189,0.15)" },
                    ]}
                  >
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
                    <Text style={styles.evidenceLabel}>Pièces jointes</Text>
                    {appeal.evidence.images &&
                    Array.isArray(appeal.evidence.images)
                      ? appeal.evidence.images.map(
                          (img: string, idx: number) => (
                            <View key={idx} style={styles.evidenceItem}>
                              <Ionicons
                                name="image"
                                size={16}
                                color="rgba(255,255,255,0.5)"
                              />
                              <Text
                                style={styles.evidenceText}
                                numberOfLines={1}
                              >
                                {img}
                              </Text>
                            </View>
                          ),
                        )
                      : (() => {
                          // Exclude thumbnailBase64 (10k+ chars, already rendered
                          // inline above as an Image) from the structured evidence
                          // dump below.
                          const evidenceEntries = Object.entries(
                            appeal.evidence,
                          ).filter(([k, v]) => {
                            if (k === "thumbnailBase64") return false;
                            if (v === null || v === undefined || v === "")
                              return false;
                            return true;
                          });
                          if (evidenceEntries.length === 0) return null;
                          return evidenceEntries.map(([k, v]) => (
                            <View key={k} style={styles.evidenceItem}>
                              <Ionicons
                                name="document"
                                size={16}
                                color="rgba(255,255,255,0.5)"
                              />
                              <Text style={styles.evidenceText}>
                                <Text style={styles.evidenceKey}>{k}: </Text>
                                {typeof v === "object"
                                  ? JSON.stringify(v)
                                  : String(v)}
                              </Text>
                            </View>
                          ));
                        })()}
                  </View>
                )}
              </View>

              {/* Original Sanction */}
              {!isBlockedImage ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Sanction originale</Text>
                  {loadingSanction ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primary.main}
                    />
                  ) : sanction ? (
                    <>
                      <View style={styles.sanctionRow}>
                        <SanctionBadge
                          type={sanction.type}
                          active={sanction.active}
                          size="medium"
                        />
                        {sanction.active && (
                          <View style={styles.activeDot}>
                            <Text style={styles.activeLabel}>Active</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.sanctionDetails}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Raison</Text>
                          <Text style={styles.detailValue}>
                            {sanction.reason}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Date</Text>
                          <Text style={styles.detailValue}>
                            {formatDate(sanction.createdAt)}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Par</Text>
                          <Text style={styles.detailValue}>
                            {sanction.issuedBy.slice(0, 8)}...
                          </Text>
                        </View>
                        {sanction.expiresAt && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Expire</Text>
                            <Text style={styles.detailValue}>
                              {formatDate(sanction.expiresAt)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.noData}>
                      Sanction introuvable (ID:{" "}
                      {appeal.sanctionId?.slice(0, 8) ?? "—"}...)
                    </Text>
                  )}
                </View>
              ) : null}

              {/* Previous review */}
              {appeal.reviewerId && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Examen précédent</Text>
                  <Text style={styles.noData}>
                    Examiné par {appeal.reviewerId.slice(0, 8)}...
                  </Text>
                  {appeal.reviewerNotes && (
                    <Text style={styles.previousNotes}>
                      {appeal.reviewerNotes}
                    </Text>
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
                  placeholder="Expliquez votre décision..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.bottomSpacer} />
            </ScrollView>
          )}

          {/* Action Buttons */}
          {appeal && !appeal.resolvedAt && (
            <View style={styles.actionsContainer}>
              {processing ? (
                <ActivityIndicator size="large" color={colors.primary.main} />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() =>
                      handleAction(
                        "rejected",
                        isBlockedImage
                          ? "Refuser (garder bloquée)"
                          : "Rejeter l'appel",
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>
                      {isBlockedImage
                        ? "Refuser (garder bloquée)"
                        : "Rejeter l'appel"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn]}
                    onPress={() =>
                      handleAction(
                        "accepted",
                        isBlockedImage
                          ? "Approuver (envoyer l'image)"
                          : "Accepter l'appel",
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionBtnText}>
                      {isBlockedImage
                        ? "Approuver (envoyer l'image)"
                        : "Accepter l'appel"}
                    </Text>
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
  evidenceKey: {
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
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
  loadingFull: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
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
  blockedPreview: {
    width: 200,
    height: 200,
    alignSelf: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 12,
  },
  scoresBox: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  scoreKey: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "monospace",
  },
  scoreVal: {
    fontSize: 12,
    color: "#FFFFFF",
    fontFamily: "monospace",
  },
});
