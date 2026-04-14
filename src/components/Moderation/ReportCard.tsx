/**
 * ReportCard - Preview card for the report queue
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { ReportStatusBadge } from "./ReportStatusBadge";
import type { Report, ReportCategory } from "../../types/moderation";

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
  nudity: "Nudit\u00e9",
  violence: "Violence",
  harassment: "Harc\u00e8lement",
  other: "Autre",
};

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

interface Props {
  report: Report;
  onPress: () => void;
  backgroundColor?: string;
  textColor?: string;
  secondaryTextColor?: string;
}

export const ReportCard: React.FC<Props> = ({
  report,
  onPress,
  backgroundColor = "rgba(255, 255, 255, 0.08)",
  textColor = "#FFFFFF",
  secondaryTextColor = "rgba(255, 255, 255, 0.6)",
}) => {
  const categoryIcon = CATEGORY_ICONS[report.category] || "help-circle";
  const categoryLabel = CATEGORY_LABELS[report.category] || report.category;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: "rgba(254, 122, 92, 0.15)" }]}>
        <Ionicons name={categoryIcon} size={24} color={colors.primary.main} />
      </View>

      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={[styles.category, { color: textColor }]} numberOfLines={1}>
            {categoryLabel}
          </Text>
          <Text style={[styles.timeAgo, { color: secondaryTextColor }]}>
            {formatTimeAgo(report.created_at)}
          </Text>
        </View>
        <Text style={[styles.detail, { color: secondaryTextColor }]} numberOfLines={1}>
          Signal\u00e9 : {report.reported_user_id.slice(0, 8)}...
        </Text>
        <Text style={[styles.detail, { color: secondaryTextColor }]} numberOfLines={1}>
          Par : {report.reporter_id.slice(0, 8)}...
        </Text>
      </View>

      <ReportStatusBadge status={report.status} />
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
  category: {
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
});
