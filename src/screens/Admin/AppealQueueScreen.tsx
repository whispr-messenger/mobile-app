/**
 * AppealQueueScreen - List of pending appeals for admin review
 * Sorted by oldest first (FIFO), pull to refresh
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
import { AdminGate, AppealCard } from "../../components/Moderation";
import type { Appeal } from "../../types/moderation";

export const AppealQueueScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { appealQueue, loading, fetchAppealQueue } = useModerationStore();

  useEffect(() => {
    fetchAppealQueue();
  }, [fetchAppealQueue]);

  const onRefresh = useCallback(() => {
    fetchAppealQueue();
  }, [fetchAppealQueue]);

  // Sort by oldest first (FIFO)
  const sortedAppeals = [...appealQueue]
    .filter((a) => a.status === "pending" || a.status === "under_review")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const renderAppeal = useCallback(
    ({ item }: { item: Appeal }) => (
      <AppealCard
        appeal={item}
        onPress={() => navigation.navigate("AppealReview", { appeal: item })}
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
              File d'appels
            </Text>
            <View style={styles.placeholder} />
          </View>

          {/* Info bar */}
          <View style={styles.infoBar}>
            <Ionicons
              name="information-circle"
              size={16}
              color="rgba(255,255,255,0.5)"
            />
            <Text style={styles.infoText}>
              Trié par ancienneté (FIFO) - {sortedAppeals.length} en attente
            </Text>
          </View>

          {/* Content */}
          {loading && appealQueue.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary.main} />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : sortedAppeals.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="happy-outline"
                size={64}
                color="rgba(255,255,255,0.3)"
              />
              <Text style={styles.emptyText}>Aucun appel en attente</Text>
              <Text style={styles.emptySubtext}>
                Tous les appels ont été traités
              </Text>
            </View>
          ) : (
            <FlatList
              data={sortedAppeals}
              renderItem={renderAppeal}
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
  placeholder: {
    width: 36,
  },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
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
