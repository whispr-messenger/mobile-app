/**
 * AdminGate - Wrapper that checks admin/moderator role
 * Shows "Access Denied" if user lacks permissions
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useModerationStore } from "../../store/moderationStore";

interface Props {
  children: React.ReactNode;
}

export const AdminGate: React.FC<Props> = ({ children }) => {
  const { isAdmin, isModerator } = useModerationStore();

  if (!isAdmin && !isModerator) {
    return (
      <View style={styles.container}>
        <Ionicons name="lock-closed" size={64} color="#8E8E93" />
        <Text style={styles.title}>Acc\u00e8s refus\u00e9</Text>
        <Text style={styles.subtitle}>
          Vous devez \u00eatre administrateur ou mod\u00e9rateur pour acc\u00e9der \u00e0 cette page.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    marginTop: 8,
  },
});
