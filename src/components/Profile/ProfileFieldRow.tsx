import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../../theme";

interface ProfileFieldRowProps {
  label: string;
  value?: string;
  placeholder?: string;
}

export const ProfileFieldRow: React.FC<ProfileFieldRowProps> = ({
  label,
  value,
  placeholder = "—",
}) => (
  <View style={styles.section}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value || placeholder}</Text>
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
  value: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.light,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
});
