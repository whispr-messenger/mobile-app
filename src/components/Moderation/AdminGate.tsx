/**
 * AdminGate - Wrapper that checks admin/moderator role and renders an
 * "Access Denied" screen if the user lacks permissions.
 *
 * Uses the shared `useIsStaff()` selector (WHISPR-1075) so every gate in
 * the app reads the same flag from moderationStore. This is a UX gate only;
 * authorisation is actually enforced server-side by user-service's
 * RolesGuard (WHISPR-1027) — any admin API call made by a non-staff user
 * gets a 403 regardless of what this store believes.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsStaff } from "../../store/moderationStore";

interface Props {
  children: React.ReactNode;
}

export const AdminGate: React.FC<Props> = ({ children }) => {
  const isStaff = useIsStaff();

  if (!isStaff) {
    return (
      <View style={styles.container}>
        <Ionicons name="lock-closed" size={64} color="#8E8E93" />
        <Text style={styles.title}>Acc\u00e8s refus\u00e9</Text>
        <Text style={styles.subtitle}>
          Vous devez \u00eatre administrateur ou mod\u00e9rateur pour
          acc\u00e9der \u00e0 cette page.
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
