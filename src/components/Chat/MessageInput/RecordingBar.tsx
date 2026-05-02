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
const LOCK_THRESHOLD = -60;
const HINT_FADE_DISTANCE = 120;

interface RecordingBarProps {
  duration: number;
  wavePhase: number;
  isLocked: boolean;
  isPaused: boolean;
  onCancel: () => void;
  onSend: () => void;
  onLock: () => void;
  onPause: () => void;
  onResume: () => void;
}

const formatRecordingTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const RecordingBar: React.FC<RecordingBarProps> = ({
  duration,
  wavePhase,
  isLocked,
  isPaused,
  onCancel,
  onSend,
  onLock,
  onPause,
  onResume,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cancelled = useSharedValue(false);
  const locked = useSharedValue(false);

  useEffect(() => {
    cancelled.value = false;
    translateX.value = 0;
    translateY.value = 0;
  }, [cancelled, translateX, translateY]);

  useEffect(() => {
    locked.value = isLocked;
    if (isLocked) {
      translateX.value = withSpring(0, { damping: 16, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 16, stiffness: 200 });
    }
  }, [isLocked, locked, translateX, translateY]);

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

  const triggerLock = () => {
    onLock();
  };

  // On web, gesture-handler's pan can be flaky and clashes with text-selection.
  // Keep a static layout there — the trash/send buttons handle cancel/send.
  const panEnabled = Platform.OS !== "web" && !isLocked;

  const panGesture = Gesture.Pan()
    .enabled(panEnabled)
    .activeOffsetX([-12, 12])
    .activeOffsetY(-12)
    .onUpdate((event) => {
      if (locked.value) return;
      if (event.translationX < 0) {
        translateX.value = event.translationX;
      }
      if (event.translationY < 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd(() => {
      if (locked.value) return;
      if (translateY.value < LOCK_THRESHOLD && !cancelled.value) {
        locked.value = true;
        runOnJS(triggerLock)();
        translateX.value = withSpring(0, { damping: 16, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 16, stiffness: 200 });
        return;
      }
      if (translateX.value < CANCEL_THRESHOLD && !cancelled.value) {
        cancelled.value = true;
        runOnJS(triggerCancel)();
        return;
      }
      translateX.value = withSpring(0, { damping: 16, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 16, stiffness: 200 });
    })
    .onFinalize(() => {
      if (
        (translateX.value !== 0 || translateY.value !== 0) &&
        !cancelled.value &&
        !locked.value
      ) {
        translateX.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(0, { duration: 180 });
      }
    });

  const slideStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const cancelHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-HINT_FADE_DISTANCE, 0],
      [0, 1],
      "clamp",
    ),
  }));

  const lockHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [LOCK_THRESHOLD, 0],
      [1, 0.4],
      "clamp",
    ),
    transform: [
      {
        translateY: interpolate(
          translateY.value,
          [LOCK_THRESHOLD, 0],
          [-24, 0],
          "clamp",
        ),
      },
    ],
  }));

  const handleTogglePause = () => {
    if (isPaused) {
      onResume();
    } else {
      onPause();
    }
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.row, slideStyle]} testID="recording-bar">
        {!isLocked && panEnabled && (
          <Animated.View
            testID="recording-lock-hint"
            style={[styles.lockHint, lockHintStyle]}
            pointerEvents="none"
          >
            <Ionicons name="lock-closed" size={14} color={colors.text.light} />
          </Animated.View>
        )}
        {isLocked ? (
          <View style={styles.lockedBadge} testID="recording-locked-badge">
            <Ionicons name="lock-closed" size={14} color={colors.text.light} />
          </View>
        ) : (
          <TouchableOpacity
            onPress={onCancel}
            style={styles.attachButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Annuler l'enregistrement vocal"
          >
            <Ionicons name="trash-outline" size={24} color={colors.ui.error} />
          </TouchableOpacity>
        )}
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
                    opacity: isPaused
                      ? 0.25
                      : 0.45 + ((index + wavePhase) % 4) * 0.12,
                  },
                ]}
              />
            ))}
          </View>
          {!isLocked && panEnabled && (
            <Animated.View
              style={[styles.cancelHint, cancelHintStyle]}
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
        {isLocked && (
          <TouchableOpacity
            testID={isPaused ? "recording-resume-btn" : "recording-pause-btn"}
            onPress={handleTogglePause}
            style={styles.attachButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              isPaused
                ? "Reprendre l'enregistrement vocal"
                : "Mettre en pause l'enregistrement vocal"
            }
          >
            <Ionicons
              name={isPaused ? "play" : "pause"}
              size={22}
              color={colors.text.light}
            />
          </TouchableOpacity>
        )}
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
  lockHint: {
    position: "absolute",
    top: -32,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 17, 36, 0.7)",
  },
  lockedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 17, 36, 0.7)",
    marginLeft: 4,
  },
});
