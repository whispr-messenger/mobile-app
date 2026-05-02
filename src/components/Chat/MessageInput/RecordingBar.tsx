import React, { useEffect } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../../../theme/colors";

const CANCEL_THRESHOLD = -100;
const HINT_FADE_DISTANCE = 120;

interface RecordingBarProps {
  duration: number;
  wavePhase: number;
  onCancel: () => void;
  onSend: () => void;
}

const formatRecordingTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const RecordingBar: React.FC<RecordingBarProps> = ({
  duration,
  wavePhase,
  onCancel,
  onSend,
}) => {
  const translateX = useSharedValue(0);
  const cancelled = useSharedValue(false);

  useEffect(() => {
    cancelled.value = false;
    translateX.value = 0;
  }, [cancelled, translateX]);

  const recordingWaveBars = Array.from({ length: 16 }, (_, index) => {
    const base = 7 + (index % 4) * 2;
    const pulse = Math.round(
      ((Math.sin(wavePhase * 0.7 + index * 0.9) + 1) / 2) * 14,
    );
    return base + pulse;
  });

  const triggerCancel = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onCancel();
  };

  // On web, gesture-handler's pan can be flaky and clashes with text-selection.
  // Keep a static layout there — the trash/send buttons handle cancel/send.
  const panEnabled = Platform.OS !== "web";

  const panGesture = Gesture.Pan()
    .enabled(panEnabled)
    .activeOffsetX(-12)
    .failOffsetY([-20, 20])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd(() => {
      if (translateX.value < CANCEL_THRESHOLD && !cancelled.value) {
        cancelled.value = true;
        runOnJS(triggerCancel)();
        return;
      }
      translateX.value = withSpring(0, { damping: 16, stiffness: 200 });
    })
    .onFinalize(() => {
      if (translateX.value !== 0 && !cancelled.value) {
        translateX.value = withTiming(0, { duration: 180 });
      }
    });

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-HINT_FADE_DISTANCE, 0],
      [0, 1],
      "clamp",
    ),
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.row, slideStyle]} testID="recording-bar">
        <TouchableOpacity
          onPress={onCancel}
          style={styles.attachButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Annuler l'enregistrement vocal"
        >
          <Ionicons name="trash-outline" size={24} color={colors.ui.error} />
        </TouchableOpacity>
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            {formatRecordingTime(duration)}
          </Text>
          <View
            testID="recording-waveform"
            style={styles.recordingWaveform}
            pointerEvents="none"
          >
            {recordingWaveBars.map((height, index) => (
              <View
                key={`recording-bar-${index}`}
                testID="recording-wave-bar"
                style={[
                  styles.recordingWaveBar,
                  {
                    height,
                    opacity: 0.45 + ((index + wavePhase) % 4) * 0.12,
                  },
                ]}
              />
            ))}
          </View>
          {panEnabled && (
            <Animated.View
              style={[styles.cancelHint, hintStyle]}
              pointerEvents="none"
            >
              <Ionicons
                name="chevron-back"
                size={14}
                color={colors.text.light}
              />
              <Text style={styles.cancelHintText}>Glisser pour annuler</Text>
            </Animated.View>
          )}
        </View>
        <TouchableOpacity
          onPress={onSend}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Envoyer le message vocal"
        >
          <LinearGradient
            colors={["#FFB07B", "#F04882"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendButton}
          >
            <Ionicons name="send" size={18} color={colors.text.light} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  attachButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ui.error,
    marginRight: 8,
  },
  recordingText: {
    color: colors.ui.error,
    fontSize: 16,
    fontWeight: "600",
    marginRight: 12,
  },
  recordingWaveform: {
    flex: 1,
    height: 28,
    flexDirection: "row",
    alignItems: "center",
  },
  recordingWaveBar: {
    width: 3,
    borderRadius: 999,
    marginRight: 3,
    backgroundColor: "#FF8F94",
  },
  cancelHint: {
    position: "absolute",
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    backgroundColor: "rgba(11, 17, 36, 0.6)",
    borderRadius: 12,
    paddingVertical: 4,
  },
  cancelHintText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
});
