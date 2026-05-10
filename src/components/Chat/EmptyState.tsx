/**
 * EmptyState - Empty state component for conversations list
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, withOpacity } from "../../theme/colors";
import { useTheme } from "../../context/ThemeContext";

interface EmptyStateProps {
  onNewConversation?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onNewConversation,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: "transparent" }]}>
      <Text style={[styles.title, { color: themeColors.text.primary }]}>
        Aucune conversation
      </Text>
      <Text
        style={[
          styles.subtitle,
          { color: withOpacity(themeColors.text.primary, 0.7) },
        ]}
      >
        Commencez une nouvelle conversation pour démarrer
      </Text>
      {onNewConversation && (
        <TouchableOpacity
          onPress={onNewConversation}
          style={styles.button}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[colors.primary.main, colors.secondary.main]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientButton}
          >
            <Ionicons name="add" size={20} color={colors.text.light} />
            <Text style={styles.buttonText}>Nouvelle conversation</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    borderRadius: 25,
    overflow: "hidden",
  },
  gradientButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  buttonText: {
    color: colors.text.light,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
