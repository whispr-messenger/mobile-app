/**
 * MySanctionsScreen - Liste des sanctions reçues par l'utilisateur
 * WHISPR-1043
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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { useModerationStore } from "../../store/moderationStore";
import type { UserSanction, SanctionType } from "../../types/moderation";

const SANCTION_CONFIG: Record<
  SanctionType,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  warning: { label: "Avertissement", color: "#F5A623", icon: "warning" },
  temp_ban: {
    label: "Suspension temporaire",
    color: "#FF9500",
    icon: "ban",
  },
  perm_ban: {
    label: "Bannissement permanent",
    color: "#FF3B30",
    icon: "close-circle",
  },
};

export const MySanctionsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { mySanctions, loading, fetchMySanctions } = useModerationStore();

  useEffect(() => {
    fetchMySanctions();
  }, [fetchMySanctions]);

  const onRefresh = useCallback(() => {
    fetchMySanctions();
  }, [fetchMySanctions]);

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderSanction = useCallback(
    ({ item }: { item: UserSanction }) => {
      const config = SANCTION_CONFIG[item.type] || SANCTION_CONFIG.warning;
      const isActive = item.active;

      return (
        <TouchableOpacity
          style={[
            styles.item,
            { backgroundColor: themeColors.background.secondary },
          ]}
          onPress={() =>
            navigation.navigate("SanctionNotice", { sanctionId: item.id })
          }
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: config.color + "20" },
            ]}
          >
            <Ionicons name={config.icon} size={24} color={config.color} />
          </View>

          <View style={styles.info}>
            <Text
              style={[styles.label, { color: themeColors.text.primary }]}
              numberOfLines={1}
            >
              {config.label}
            </Text>
            <Text
              style={[styles.reason, { color: themeColors.text.secondary }]}
              numberOfLines={2}
            >
              {item.reason}
            </Text>
            <Text style={[styles.date, { color: themeColors.text.tertiary }]}>
              {formatDate(item.createdAt)}
              {item.expiresAt
                ? ` - expire le ${formatDate(item.expiresAt)}`
                : ""}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isActive
                  ? config.color + "20"
                  : "rgba(142,142,147,0.2)",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: isActive ? config.color : "#8E8E93" },
              ]}
            >
              {isActive ? "Active" : "Levée"}
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
            Mes sanctions
          </Text>
          <View style={styles.placeholder} />
        </View>

        {loading && mySanctions.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text
              style={[
                styles.loadingText,
                { color: themeColors.text.secondary },
              ]}
            >
              Chargement...
            </Text>
          </View>
        ) : mySanctions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="shield-checkmark-outline"
              size={64}
              color={themeColors.text.tertiary}
            />
            <Text
              style={[styles.emptyText, { color: themeColors.text.secondary }]}
            >
              Aucune sanction
            </Text>
            <Text
              style={[
                styles.emptySubtext,
                { color: themeColors.text.tertiary },
              ]}
            >
              Votre compte est en règle
            </Text>
          </View>
        ) : (
          <FlatList
            data={mySanctions}
            renderItem={renderSanction}
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
    // WHISPR-1254 - sur react-native-web, le wrapper racine doit borner la
    // hauteur du viewport sinon flex:1 ne propage pas aux enfants.
    ...(Platform.OS === "web" ? { height: "100%" } : {}),
  },
  container: {
    flex: 1,
    // WHISPR-1254 - minHeight:0 permet a la FlatList enfant d'overflow
    // verticalement au lieu de pousser le parent.
    ...(Platform.OS === "web" ? { minHeight: 0 } : {}),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  backButton: { marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "600" },
  placeholder: { width: 36 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: { marginTop: 16, fontSize: 16 },
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
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: "center" },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  info: { flex: 1, marginLeft: 12 },
  label: { fontSize: 16, fontWeight: "600" },
  reason: { fontSize: 14, marginTop: 2 },
  date: { fontSize: 12, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
});
