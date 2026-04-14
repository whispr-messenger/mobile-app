/**
 * ReportHistoryScreen - Liste des signalements soumis par l'utilisateur
 * Shows the user's submitted reports with status, category, and date
 */

import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { useModerationStore } from "../../store/moderationStore";
import type { Report, ReportCategory, ReportStatus } from "../../types/moderation";

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

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: "En attente", color: "#F5A623", icon: "time" },
  under_review: { label: "En cours d'examen", color: "#6774BD", icon: "eye" },
  resolved_action: { label: "Action prise", color: "#4CD964", icon: "checkmark-circle" },
  resolved_dismissed: { label: "Rejeté", color: "#8E8E93", icon: "close-circle" },
};

export const ReportHistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { myReports, loading, fetchMyReports } = useModerationStore();

  useEffect(() => {
    fetchMyReports();
  }, [fetchMyReports]);

  const onRefresh = useCallback(() => {
    fetchMyReports();
  }, [fetchMyReports]);

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderReport = useCallback(
    ({ item }: { item: Report }) => {
      const categoryIcon = CATEGORY_ICONS[item.category] || "help-circle";
      const categoryLabel = CATEGORY_LABELS[item.category] || item.category;
      const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

      return (
        <TouchableOpacity
          style={[styles.reportItem, { backgroundColor: themeColors.background.secondary }]}
          onPress={() => navigation.navigate("ReportDetail", { report: item })}
          activeOpacity={0.7}
        >
          <View style={[styles.categoryIconContainer, { backgroundColor: "rgba(254, 122, 92, 0.15)" }]}>
            <Ionicons name={categoryIcon} size={24} color={colors.primary.main} />
          </View>

          <View style={styles.reportInfo}>
            <Text style={[styles.categoryLabel, { color: themeColors.text.primary }]} numberOfLines={1}>
              {categoryLabel}
            </Text>
            <Text style={[styles.reportTarget, { color: themeColors.text.secondary }]} numberOfLines={1}>
              Utilisateur signalé: {item.reported_user_id.slice(0, 8)}...
            </Text>
            <Text style={[styles.reportDate, { color: themeColors.text.tertiary }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + "20" }]}>
            <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [themeColors, navigation],
  );

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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
            Mes signalements
          </Text>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        {loading && myReports.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={[styles.loadingText, { color: themeColors.text.secondary }]}>
              Chargement...
            </Text>
          </View>
        ) : myReports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={themeColors.text.tertiary} />
            <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
              Aucun signalement soumis
            </Text>
            <Text style={[styles.emptySubtext, { color: themeColors.text.tertiary }]}>
              Vos signalements apparaitront ici
            </Text>
          </View>
        ) : (
          <FlatList
            data={myReports}
            renderItem={renderReport}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={onRefresh}
                tintColor={colors.primary.main}
              />
            }
          />
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  reportItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  reportInfo: {
    flex: 1,
    marginLeft: 12,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  reportTarget: {
    fontSize: 14,
    marginTop: 2,
  },
  reportDate: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
