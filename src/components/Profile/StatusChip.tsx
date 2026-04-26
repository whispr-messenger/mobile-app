import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../../theme";

interface StatusChipProps {
  isOnline: boolean;
  lastSeen?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  isOnline,
  lastSeen,
}) => (
  <View style={styles.section}>
    <Text style={styles.label}>Statut</Text>
    <View
      style={[styles.chip, isOnline ? styles.chipOnline : styles.chipOffline]}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: isOnline
              ? colors.status.online
              : colors.status.offline,
          },
        ]}
      />
      <Text
        style={[styles.text, isOnline ? styles.textOnline : styles.textOffline]}
      >
        {isOnline ? "Actif maintenant" : `Hors ligne - ${lastSeen ?? ""}`}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: "rgba(255,255,255,0.8)",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 0,
  },
  chipOnline: {
    backgroundColor: "rgba(33, 192, 4, 0.18)",
  },
  chipOffline: {
    backgroundColor: "rgba(142, 142, 147, 0.18)",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  text: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  textOnline: {
    color: colors.text.light,
  },
  textOffline: {
    color: "rgba(255,255,255,0.85)",
  },
});
