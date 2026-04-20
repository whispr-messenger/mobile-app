/**
 * ReportQueueScreen - List of pending reports for admin review
 * Includes filter tabs and category filter
 */

import React, { useEffect, useCallback, useState } from "react";
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
import { AdminGate, ReportCard } from "../../components/Moderation";
import type {
  Report,
  ReportCategory,
  ReportStatus,
} from "../../types/moderation";

type StatusFilter = "all" | "pending" | "under_review";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "En attente" },
  { key: "under_review", label: "En examen" },
];

const CATEGORIES: { key: ReportCategory | "all"; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "offensive", label: "Offensant" },
  { key: "spam", label: "Spam" },
  { key: "nudity", label: "Nudité" },
  { key: "violence", label: "Violence" },
  { key: "harassment", label: "Harcèlement" },
  { key: "other", label: "Autre" },
];

export const ReportQueueScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { reportQueue, loading, fetchReportQueue } = useModerationStore();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | "all">(
    "all",
  );
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    fetchReportQueue();
  }, [fetchReportQueue]);

  const onRefresh = useCallback(() => {
    fetchReportQueue();
  }, [fetchReportQueue]);

  const filteredReports = reportQueue.filter((report) => {
    if (statusFilter !== "all" && report.status !== statusFilter) return false;
    if (categoryFilter !== "all" && report.category !== categoryFilter)
      return false;
    return true;
  });

  const pendingCount = reportQueue.filter((r) => r.status === "pending").length;

  const renderReport = useCallback(
    ({ item }: { item: Report }) => (
      <ReportCard
        report={item}
        onPress={() => navigation.navigate("ReportReview", { report: item })}
      />
    ),
    [navigation],
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
              Signalements
            </Text>
            {pendingCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
            <View style={styles.placeholder} />
          </View>

          {/* Status Filter Tabs */}
          <View style={styles.tabsContainer}>
            {STATUS_TABS.map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setStatusFilter(tab.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.tabText, isActive && styles.tabTextActive]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Category Filter */}
          <TouchableOpacity
            style={styles.categoryFilterButton}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            activeOpacity={0.7}
          >
            <Ionicons name="filter" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.categoryFilterText}>
              Catégorie :{" "}
              {CATEGORIES.find((c) => c.key === categoryFilter)?.label}
            </Text>
            <Ionicons
              name={showCategoryPicker ? "chevron-up" : "chevron-down"}
              size={16}
              color="rgba(255,255,255,0.7)"
            />
          </TouchableOpacity>

          {showCategoryPicker && (
            <View style={styles.categoryPicker}>
              {CATEGORIES.map((cat) => {
                const isActive = categoryFilter === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryChip,
                      isActive && styles.categoryChipActive,
                    ]}
                    onPress={() => {
                      setCategoryFilter(cat.key);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isActive && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Content */}
          {loading && reportQueue.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary.main} />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : filteredReports.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={64}
                color="rgba(255,255,255,0.3)"
              />
              <Text style={styles.emptyText}>Aucun signalement</Text>
              <Text style={styles.emptySubtext}>
                La file est vide pour ces filtres
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredReports}
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
  badgeContainer: {
    backgroundColor: colors.primary.main,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    marginRight: 8,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  placeholder: {
    width: 24,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  tabActive: {
    backgroundColor: colors.primary.main,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  categoryFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  categoryFilterText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.7)",
    flex: 1,
  },
  categoryPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  categoryChipActive: {
    backgroundColor: colors.secondary.main,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
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
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 8,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
});
