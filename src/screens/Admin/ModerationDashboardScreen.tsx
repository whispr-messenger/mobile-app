/**
 * ModerationDashboardScreen - Main admin/moderator dashboard
 * Shows stats overview, quick actions, pull to refresh
 */

import React, { useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { useModerationStore } from "../../store/moderationStore";
import { AdminGate, ModerationStatCard } from "../../components/Moderation";
import { sanctionsAPI } from "../../services/moderation/moderationApi";

export const ModerationDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const {
    stats,
    reportQueue,
    appealQueue,
    loading,
    fetchStats,
    fetchReportQueue,
    fetchAppealQueue,
  } = useModerationStore();

  const [activeSanctions, setActiveSanctions] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    await Promise.all([
      fetchStats(),
      fetchReportQueue(),
      fetchAppealQueue(),
      sanctionsAPI
        .getAllActive(1, 0)
        .then((list) => setActiveSanctions(list.length))
        .catch(() => {}),
    ]);
  }, [fetchStats, fetchReportQueue, fetchAppealQueue]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const pendingReports = stats?.pending ?? 0;
  const pendingAppeals = appealQueue.filter(
    (a) => a.status === "pending",
  ).length;
  const resolvedToday = stats?.resolved_today ?? 0;

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
              Modération
            </Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary.main}
              />
            }
          >
            {/* Stats Grid */}
            <Text style={styles.sectionTitle}>Vue d'ensemble</Text>

            {loading && !stats ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary.main} />
              </View>
            ) : (
              <>
                <View style={styles.statsRow}>
                  <ModerationStatCard
                    icon="alert-circle"
                    count={pendingReports}
                    label="Signalements en attente"
                    color="#F5A623"
                    onPress={() => navigation.navigate("ReportQueue")}
                  />
                  <View style={styles.statSpacer} />
                  <ModerationStatCard
                    icon="hand-left"
                    count={pendingAppeals}
                    label="Appels en attente"
                    color="#6774BD"
                    onPress={() => navigation.navigate("AppealQueue")}
                  />
                </View>

                <View style={styles.statsRow}>
                  <ModerationStatCard
                    icon="ban"
                    count={activeSanctions}
                    label="Sanctions actives"
                    color="#FF3B30"
                  />
                  <View style={styles.statSpacer} />
                  <ModerationStatCard
                    icon="checkmark-circle"
                    count={resolvedToday}
                    label="Résolus aujourd'hui"
                    color="#4CD964"
                  />
                </View>
              </>
            )}

            {/* Category Breakdown */}
            {stats?.by_category &&
              Object.keys(stats.by_category).length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Par catégorie</Text>
                  <View style={styles.categoryList}>
                    {Object.entries(stats.by_category).map(([cat, count]) => (
                      <View key={cat} style={styles.categoryRow}>
                        <Text style={styles.categoryLabel}>{cat}</Text>
                        <View style={styles.categoryBarContainer}>
                          <View
                            style={[
                              styles.categoryBar,
                              {
                                width: `${Math.min(100, (count / Math.max(pendingReports, 1)) * 100)}%`,
                                backgroundColor: colors.primary.main,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.categoryCount}>{count}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Actions rapides</Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate("ReportQueue")}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: "rgba(245, 166, 35, 0.15)" },
                ]}
              >
                <Ionicons name="list" size={22} color="#F5A623" />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>File de signalements</Text>
                <Text style={styles.actionSub}>
                  {pendingReports} en attente
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="rgba(255,255,255,0.4)"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate("AppealQueue")}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: "rgba(103, 116, 189, 0.15)" },
                ]}
              >
                <Ionicons name="hand-left" size={22} color="#6774BD" />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>File d'appels</Text>
                <Text style={styles.actionSub}>
                  {pendingAppeals} en attente
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="rgba(255,255,255,0.4)"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate("SanctionForm", {})}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: "rgba(255, 59, 48, 0.15)" },
                ]}
              >
                <Ionicons name="hammer" size={22} color="#FF3B30" />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>Sanctions</Text>
                <Text style={styles.actionSub}>{activeSanctions} actives</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="rgba(255,255,255,0.4)"
              />
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
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 12,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  statSpacer: {
    width: 12,
  },
  categoryList: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.7)",
    width: 90,
    textTransform: "capitalize",
  },
  categoryBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 3,
    marginHorizontal: 8,
  },
  categoryBar: {
    height: 6,
    borderRadius: 3,
  },
  categoryCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    width: 30,
    textAlign: "right",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  actionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionSub: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 2,
  },
  bottomSpacer: {
    height: 32,
  },
});
