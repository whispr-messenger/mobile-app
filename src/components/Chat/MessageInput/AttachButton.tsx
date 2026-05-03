import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";

interface AttachButtonProps {
  onPress: () => void;
}

export const AttachButton: React.FC<AttachButtonProps> = ({ onPress }) => {
  return (
    <Pressable
      testID="attachment-sheet-trigger"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ouvrir les pièces jointes"
      style={styles.shell}
    >
      <Ionicons name="add" size={22} color={colors.text.light} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
});
