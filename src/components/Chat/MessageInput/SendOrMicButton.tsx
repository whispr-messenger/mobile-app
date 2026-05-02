import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors } from "../../../theme/colors";

const SPRING_CONFIG = { damping: 14, stiffness: 220, mass: 0.6 } as const;

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
  const progress = useSharedValue(hasText ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(hasText ? 1 : 0, SPRING_CONFIG);
  }, [hasText, progress]);

  const sendStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: 0.6 + 0.4 * progress.value },
      { rotate: `${(progress.value - 1) * 90}deg` },
    ],
  }));

  const micStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { scale: 0.6 + 0.4 * (1 - progress.value) },
      { rotate: `${progress.value * -90}deg` },
    ],
  }));

  return (
    <Pressable
      onPress={hasText ? onSend : onMicPress}
      onLongPress={hasText ? onLongPressSend : onMicLongPress}
      delayLongPress={hasText ? 500 : Platform.OS === "web" ? 200 : 300}
      accessibilityRole="button"
      accessibilityLabel={
        hasText
          ? isEditing
            ? "Enregistrer la modification"
            : "Envoyer le message"
          : "Enregistrer un message vocal"
      }
      accessibilityHint={
        hasText
          ? "Maintenir pour programmer l'envoi"
          : "Maintenir pour démarrer l'enregistrement"
      }
      style={
        // iOS Safari: block native context menu / text-selection popup
        // from stealing the long-press gesture when in mic mode.
        Platform.OS === "web"
          ? ({
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            } as any)
          : undefined
      }
    >
      <View style={styles.shell}>
        <LinearGradient
          colors={["#FFB07B", "#F04882"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.iconLayer, sendStyle]}
            pointerEvents="none"
          >
            <Text style={styles.sendIcon}>→</Text>
          </Animated.View>
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.iconLayer, micStyle]}
            pointerEvents="none"
          >
            <Ionicons name="mic" size={20} color={colors.text.light} />
          </Animated.View>
        </LinearGradient>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  gradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconLayer: {
    justifyContent: "center",
    alignItems: "center",
  },
  sendIcon: {
    color: colors.text.light,
    fontSize: 20,
    fontWeight: "600",
  },
});
