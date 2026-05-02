import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../../theme/colors";

interface SendOrMicButtonProps {
  hasText: boolean;
  isEditing: boolean;
  onSend: () => void;
  onLongPressSend: () => void;
  onMicPress: () => void;
  onMicLongPress: () => void;
}

export const SendOrMicButton: React.FC<SendOrMicButtonProps> = ({
  hasText,
  isEditing,
  onSend,
  onLongPressSend,
  onMicPress,
  onMicLongPress,
}) => {
  if (hasText) {
    return (
      <TouchableOpacity
        onPress={onSend}
        onLongPress={onLongPressSend}
        delayLongPress={500}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          isEditing ? "Enregistrer la modification" : "Envoyer le message"
        }
        accessibilityHint="Maintenir pour programmer l'envoi"
      >
        <LinearGradient
          colors={["#FFB07B", "#F04882"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sendButton}
        >
          <Text style={styles.sendIcon}>→</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onMicPress}
      onLongPress={onMicLongPress}
      delayLongPress={Platform.OS === "web" ? 200 : 300}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Enregistrer un message vocal"
      accessibilityHint="Maintenir pour démarrer l'enregistrement"
      style={
        // iOS Safari: block native context menu / text-selection
        // popup from stealing the long-press gesture.
        Platform.OS === "web"
          ? ({
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            } as any)
          : undefined
      }
    >
      <LinearGradient
        colors={["#FFB07B", "#F04882"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sendButton}
      >
        <Ionicons name="mic" size={20} color={colors.text.light} />
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendIcon: {
    color: colors.text.light,
    fontSize: 20,
    fontWeight: "600",
  },
});
