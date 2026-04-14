/**
 * SanctionBadge - Colored badge displaying sanction type
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SanctionType } from "../../types/moderation";

const SANCTION_CONFIG: Record<
  SanctionType,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  warning: { label: "Avertissement", color: "#F5A623", icon: "warning" },
  temp_ban: { label: "Ban temporaire", color: "#FF6B35", icon: "timer" },
  perm_ban: { label: "Ban permanent", color: "#FF3B30", icon: "ban" },
};

interface Props {
  type: SanctionType;
  active?: boolean;
  size?: "small" | "medium";
}

export const SanctionBadge: React.FC<Props> = ({ type, active = true, size = "small" }) => {
  const config = SANCTION_CONFIG[type] || SANCTION_CONFIG.warning;
  const color = active ? config.color : "#8E8E93";
  const iconSize = size === "medium" ? 16 : 14;
  const fontSize = size === "medium" ? 13 : 11;

  return (
    <View style={[styles.badge, { backgroundColor: color + "20" }]}>
      <Ionicons name={config.icon} size={iconSize} color={color} />
      <Text style={[styles.text, { color, fontSize }]}>
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
