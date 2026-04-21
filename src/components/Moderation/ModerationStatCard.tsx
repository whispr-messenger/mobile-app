/**
 * ModerationStatCard - Stat card for the moderation dashboard
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  label: string;
  color: string;
  onPress?: () => void;
}

export const ModerationStatCard: React.FC<Props> = ({
  icon,
  count,
  label,
  color,
  onPress,
}) => {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.card, { borderLeftColor: color, borderLeftWidth: 3 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.count, { color }]}>{count}</Text>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    minHeight: 130,
    justifyContent: "center",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  count: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
  },
});
