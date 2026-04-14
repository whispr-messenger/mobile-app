/**
 * UserModerationScreen - User moderation history and manual actions
 * Shows user info, sanction history, and manual action buttons
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { sanctionsAPI } from "../../services/moderation/moderationApi";
import { AdminGate, SanctionBadge } from "../../components/Moderation";
import type { UserSanction } from "../../types/moderation";

type RouteParams = {
  UserModeration: {
    userId: string;
    userName?: string;
    userAvatar?: string;
  };
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const UserModerationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "UserModeration">>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const { userId, userName, userAvatar } = route.params;
  const [sanctions, setSanctions] = useState<UserSanction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSanctions = useCallback(async () => {
    setLoading(true);
    try {
      const all = await sanctionsAPI.getAllActive();
      const userSanctions = all.filter((s) => s.userId === userId);
      setSanctions(userSanctions);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSanctions();
  }, [fetchSanctions]);

  const handleQuickAction = useCallback(
    (type: "warning" | "temp_ban" | "perm_ban", label: string) => {
      Alert.alert(
        `${label}`,
        `Voulez-vous cr\u00e9er un formulaire de sanction pour cet utilisateur ?`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Continuer",
            onPress: () =>
              navigation.navigate("SanctionForm", {
                userId,
                userName,
                defaultType: type,
              }),
          },
        ],
      );
    },
    [navigation, userId, userName],
  );

  const activeSanctions = sanctions.filter((s) => s.active);
  const inactiveSanctions = sanctions.filter((s) => !s.active);

  const renderSanction = useCallback(
    ({ item }: { item: UserSanction }) => {
      return (
        <View
          style={[
            styles.sanctionItem,
            item.active && styles.sanctionItemActive,
          ]}
        >
          <View style={styles.sanctionHeader}>
            <SanctionBadge type={item.type} active={item.active} size="medium" />
            {item.active && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeText}>Active</Text>
              </View>
            )}
          </View>
          <Text style={styles.sanctionReason} numberOfLines={2}>
            {item.reason}
          </Text>
          <View style={styles.sanctionMeta}>
            <Text style={styles.sanctionDate}>{formatDate(item.createdAt)}</Text>
            {item.expiresAt && (
              <Text style={styles.sanctionExpiry}>
                Expire : {formatDate(item.expiresAt)}
              </Text>
            )}
          </View>
          <Text style={styles.sanctionIssuer}>
            Par : {item.issuedBy.slice(0, 8)}...
          </Text>
        </View>
      );
    },
    [],
  );

  const allSanctions = [...activeSanctions, ...inactiveSanctions];

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
              Mod\u00e9ration utilisateur
            </Text>
            <View style={styles.placeholder} />
          </View>

          <FlatList
            data={allSanctions}
            renderItem={renderSanction}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={fetchSanctions}
                tintColor={colors.primary.main}
              />
            }
            ListHeaderComponent={
              <>
                {/* User Info */}
                <View style={styles.userCard}>
                  <View style={[styles.avatarContainer, { backgroundColor: "rgba(254, 122, 92, 0.15)" }]}>
                    {userAvatar ? (
                      <Text style={styles.avatarText}>{userName?.[0]?.toUpperCase() || "?"}</Text>
                    ) : (
                      <Ionicons name="person" size={32} color={colors.primary.main} />
                    )}
                  </View>
                  <View style={styles.userInfo}>
                    {userName && (
                      <Text style={styles.userName}>{userName}</Text>
                    )}
                    <Text style={styles.userIdText}>{userId}</Text>
                    <View style={styles.sanctionSummary}>
                      <Text style={styles.summaryText}>
                        {activeSanctions.length} active{activeSanctions.length !== 1 ? "s" : ""}
                        {" / "}
                        {sanctions.length} total
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Actions manuelles</Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.quickAction, { backgroundColor: "rgba(245, 166, 35, 0.15)" }]}
                    onPress={() => handleQuickAction("warning", "Avertissement")}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="warning" size={20} color="#F5A623" />
                    <Text style={[styles.quickActionText, { color: "#F5A623" }]}>Avertir</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.quickAction, { backgroundColor: "rgba(255, 107, 53, 0.15)" }]}
                    onPress={() => handleQuickAction("temp_ban", "Ban temporaire")}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="timer" size={20} color="#FF6B35" />
                    <Text style={[styles.quickActionText, { color: "#FF6B35" }]}>Ban temp.</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.quickAction, { backgroundColor: "rgba(255, 59, 48, 0.15)" }]}
                    onPress={() => handleQuickAction("perm_ban", "Ban permanent")}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="ban" size={20} color="#FF3B30" />
                    <Text style={[styles.quickActionText, { color: "#FF3B30" }]}>Ban perm.</Text>
                  </TouchableOpacity>
                </View>

                {/* Sanctions Header */}
                <Text style={styles.sectionTitle}>
                  Historique des sanctions ({sanctions.length})
                </Text>

                {loading && sanctions.length === 0 && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary.main} />
                  </View>
                )}

                {!loading && sanctions.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="checkmark-circle-outline" size={48} color="rgba(255,255,255,0.3)" />
                    <Text style={styles.emptyText}>Aucune sanction</Text>
                    <Text style={styles.emptySubtext}>
                      Cet utilisateur n'a aucune sanction enregistr\u00e9e
                    </Text>
                  </View>
                )}
              </>
            }
          />
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primary.main,
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  userIdText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    fontFamily: "monospace",
    marginTop: 2,
  },
  sanctionSummary: {
    marginTop: 6,
  },
  summaryText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.4)",
    marginTop: 4,
    textAlign: "center",
  },
  sanctionItem: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "rgba(255, 255, 255, 0.1)",
  },
  sanctionItemActive: {
    borderLeftColor: "#FF3B30",
    backgroundColor: "rgba(255, 59, 48, 0.08)",
  },
  sanctionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  activeBadge: {
    backgroundColor: "rgba(255, 59, 48, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FF3B30",
  },
  sanctionReason: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 20,
    marginBottom: 6,
  },
  sanctionMeta: {
    flexDirection: "row",
    gap: 12,
  },
  sanctionDate: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.4)",
  },
  sanctionExpiry: {
    fontSize: 12,
    color: "rgba(245, 166, 35, 0.8)",
  },
  sanctionIssuer: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.4)",
    marginTop: 4,
  },
});
