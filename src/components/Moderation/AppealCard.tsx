/**
 * AppealCard - Preview card for the appeal queue
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { SanctionBadge } from "./SanctionBadge";
import type { Appeal, SanctionType } from "../../types/moderation";

const formatTimeAgo = (dateStr: string): string => {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

interface Props {
  appeal: Appeal;
  sanctionType?: SanctionType;
  onPress: () => void;
  backgroundColor?: string;
  textColor?: string;
  secondaryTextColor?: string;
}

export const AppealCard: React.FC<Props> = ({
  appeal,
  sanctionType = "warning",
  onPress,
  backgroundColor = "rgba(255, 255, 255, 0.08)",
  textColor = "#FFFFFF",
  secondaryTextColor = "rgba(255, 255, 255, 0.6)",
}) => {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: "rgba(103, 116, 189, 0.15)" }]}>
        <Ionicons name="hand-left" size={24} color={colors.secondary.main} />
      </View>

      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={[styles.userName, { color: textColor }]} numberOfLines={1}>
            {appeal.userId.slice(0, 8)}...
          </Text>
          <Text style={[styles.timeAgo, { color: secondaryTextColor }]}>
            {formatTimeAgo(appeal.createdAt)}
          </Text>
        </View>
        <Text style={[styles.detail, { color: secondaryTextColor }]} numberOfLines={1}>
          Appel du {formatDate(appeal.createdAt)}
        </Text>
        <View style={styles.badgeRow}>
          <SanctionBadge type={sanctionType} />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
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
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  timeAgo: {
    fontSize: 12,
    marginLeft: 8,
  },
  detail: {
    fontSize: 13,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 6,
  },
});
