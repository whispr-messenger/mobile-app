/**
 * ReportDetailScreen - Vue detaillee d'un signalement
 * Shows full report details including evidence, status, and resolution
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import type {
  Report,
  ReportCategory,
  ReportStatus,
} from "../../types/moderation";

type RouteParams = {
  ReportDetail: { report: Report };
};

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

const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { label: "En attente", color: "#F5A623", icon: "time" },
  under_review: { label: "En cours d'examen", color: "#6774BD", icon: "eye" },
  resolved_action: {
    label: "Action prise",
    color: "#4CD964",
    icon: "checkmark-circle",
  },
  resolved_dismissed: {
    label: "Rejeté",
    color: "#8E8E93",
    icon: "close-circle",
  },
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

export const ReportDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "ReportDetail">>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { report } = route.params;

  const categoryIcon = CATEGORY_ICONS[report.category] || "help-circle";
  const categoryLabel = CATEGORY_LABELS[report.category] || report.category;
  const statusConfig = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
  const isResolved = report.status.startsWith("resolved");

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
            Détail du signalement
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Status Badge */}
          <View
            style={[
              styles.statusCard,
              { backgroundColor: themeColors.background.secondary },
            ]}
          >
            <View
              style={[
                styles.statusBadgeLarge,
                { backgroundColor: statusConfig.color + "20" },
              ]}
            >
              <Ionicons
                name={statusConfig.icon}
                size={20}
                color={statusConfig.color}
              />
              <Text
                style={[styles.statusTextLarge, { color: statusConfig.color }]}
              >
                {statusConfig.label}
              </Text>
            </View>
            <Text
              style={[styles.dateText, { color: themeColors.text.tertiary }]}
            >
              Soumis le {formatDate(report.created_at)}
            </Text>
          </View>

          {/* Category Section */}
          <View
            style={[
              styles.section,
              { backgroundColor: themeColors.background.secondary },
            ]}
          >
            <Text
              style={[styles.sectionTitle, { color: themeColors.text.primary }]}
            >
              Catégorie
            </Text>
            <View style={styles.categoryRow}>
              <View
                style={[
                  styles.categoryIconContainer,
                  { backgroundColor: "rgba(254, 122, 92, 0.15)" },
                ]}
              >
                <Ionicons
                  name={categoryIcon}
                  size={24}
                  color={colors.primary.main}
                />
              </View>
              <Text
                style={[
                  styles.categoryLabel,
                  { color: themeColors.text.primary },
                ]}
              >
                {categoryLabel}
              </Text>
            </View>
          </View>

          {/* Description Section */}
          {report.description && (
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
                Description
              </Text>
              <Text
                style={[
                  styles.descriptionText,
                  { color: themeColors.text.secondary },
                ]}
              >
                {report.description}
              </Text>
            </View>
          )}

          {/* Evidence Section - Message Snapshot */}
          {report.evidence && Object.keys(report.evidence).length > 0 && (
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
                Preuve
              </Text>
              <View
                style={[
                  styles.evidenceBox,
                  { backgroundColor: "rgba(0, 0, 0, 0.15)" },
                ]}
              >
                {report.evidence.messageContent && (
                  <View style={styles.evidenceItem}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={16}
                      color={themeColors.text.tertiary}
                    />
                    <Text
                      style={[
                        styles.evidenceText,
                        { color: themeColors.text.secondary },
                      ]}
                    >
                      {report.evidence.messageContent}
                    </Text>
                  </View>
                )}
                {report.evidence.timestamp && (
                  <Text
                    style={[
                      styles.evidenceTimestamp,
                      { color: themeColors.text.tertiary },
                    ]}
                  >
                    Message du {formatDate(report.evidence.timestamp)}
                  </Text>
                )}
                {report.evidence.screenshot && (
                  <View style={styles.evidenceItem}>
                    <Ionicons
                      name="image-outline"
                      size={16}
                      color={themeColors.text.tertiary}
                    />
                    <Text
                      style={[
                        styles.evidenceText,
                        { color: themeColors.text.secondary },
                      ]}
                    >
                      Capture d'écran jointe
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Reported User Section */}
          <View
            style={[
              styles.section,
              { backgroundColor: themeColors.background.secondary },
            ]}
          >
            <Text
              style={[styles.sectionTitle, { color: themeColors.text.primary }]}
            >
              Utilisateur signalé
            </Text>
            <View style={styles.infoRow}>
              <Ionicons
                name="person-outline"
                size={18}
                color={themeColors.text.tertiary}
              />
              <Text
                style={[styles.infoText, { color: themeColors.text.secondary }]}
              >
                {report.reported_user_id}
              </Text>
            </View>
            {report.conversation_id && (
              <View style={styles.infoRow}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={18}
                  color={themeColors.text.tertiary}
                />
                <Text
                  style={[
                    styles.infoText,
                    { color: themeColors.text.secondary },
                  ]}
                >
                  Conversation: {report.conversation_id.slice(0, 12)}...
                </Text>
              </View>
            )}
          </View>

          {/* Resolution Section */}
          {isResolved && report.resolution && (
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
                Résolution
              </Text>
              <View style={styles.resolutionContent}>
                <View style={styles.infoRow}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color={statusConfig.color}
                  />
                  <Text
                    style={[
                      styles.resolutionAction,
                      { color: themeColors.text.primary },
                    ]}
                  >
                    Action: {report.resolution.action}
                  </Text>
                </View>
                {report.resolution.notes && (
                  <Text
                    style={[
                      styles.resolutionNotes,
                      { color: themeColors.text.secondary },
                    ]}
                  >
                    {report.resolution.notes}
                  </Text>
                )}
                <Text
                  style={[
                    styles.resolutionDate,
                    { color: themeColors.text.tertiary },
                  ]}
                >
                  Résolu le {formatDate(report.resolution.resolved_at)}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
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
    padding: 16,
    paddingBottom: 32,
  },
  statusCard: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  statusBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusTextLarge: {
    fontSize: 15,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 13,
    marginTop: 8,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    opacity: 0.7,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  evidenceBox: {
    borderRadius: 8,
    padding: 12,
  },
  evidenceItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  evidenceText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  evidenceTimestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  resolutionContent: {
    gap: 4,
  },
  resolutionAction: {
    fontSize: 15,
    fontWeight: "600",
  },
  resolutionNotes: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginLeft: 28,
  },
  resolutionDate: {
    fontSize: 12,
    marginTop: 8,
    marginLeft: 28,
  },
});
