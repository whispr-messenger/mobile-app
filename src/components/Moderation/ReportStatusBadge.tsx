/**
 * ReportStatusBadge - Colored badge displaying report status
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ReportStatus } from "../../types/moderation";

const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { label: "En attente", color: "#F5A623", icon: "time" },
  under_review: { label: "En examen", color: "#6774BD", icon: "eye" },
  resolved_action: { label: "Action prise", color: "#4CD964", icon: "checkmark-circle" },
  resolved_dismissed: { label: "Rejet\u00e9", color: "#8E8E93", icon: "close-circle" },
};

interface Props {
  status: ReportStatus;
  size?: "small" | "medium";
}

export const ReportStatusBadge: React.FC<Props> = ({ status, size = "small" }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const iconSize = size === "medium" ? 16 : 14;
  const fontSize = size === "medium" ? 13 : 11;

  return (
    <View style={[styles.badge, { backgroundColor: config.color + "20" }]}>
      <Ionicons name={config.icon} size={iconSize} color={config.color} />
      <Text style={[styles.text, { color: config.color, fontSize }]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  text: {
    fontWeight: "600",
  },
});
