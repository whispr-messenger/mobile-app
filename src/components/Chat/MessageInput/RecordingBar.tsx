import React, { useEffect } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  onStop: () => void;
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
  onStop,
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

  const recordingWaveBars = Array.from({ length: 22 }, (_, index) => {
    const base = 6 + (index % 4) * 2;
    const pulse = Math.round(
      ((Math.sin(wavePhase * 0.7 + index * 0.9) + 1) / 2) * 12,
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

        <TouchableOpacity
          onPress={onCancel}
          style={styles.sideButton}
          activeOpacity={0.7}
          // hitSlop pour respecter iOS HIG 44pt
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Annuler l'enregistrement vocal"
        >
          <Ionicons name="trash-outline" size={22} color={colors.ui.error} />
        </TouchableOpacity>

        <View style={styles.pill}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            {formatRecordingTime(duration)}
          </Text>
          <View
            testID="recording-waveform"
            style={styles.waveform}
            pointerEvents="none"
          >
            {recordingWaveBars.map((height, index) => (
              <View
                key={`recording-bar-${index}`}
                testID="recording-wave-bar"
                style={[
                  styles.waveBar,
                  {
                    height,
                    opacity: isPaused
                      ? 0.3
                      : 0.5 + ((index + wavePhase) % 4) * 0.12,
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
                size={12}
                color={colors.text.light}
              />
              <Text style={styles.cancelHintText}>Glisser</Text>
            </Animated.View>
          )}
        </View>

        {isLocked && (
          <TouchableOpacity
            testID={isPaused ? "recording-resume-btn" : "recording-pause-btn"}
            onPress={handleTogglePause}
            style={styles.sideButton}
            activeOpacity={0.7}
            // hitSlop pour respecter iOS HIG 44pt
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={
              isPaused
                ? "Reprendre l'enregistrement vocal"
                : "Mettre en pause l'enregistrement vocal"
            }
          >
            <Ionicons
              name={isPaused ? "play" : "pause"}
              size={20}
              color={colors.text.light}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          testID="recording-stop-btn"
          onPress={onStop}
          activeOpacity={0.7}
          // hitSlop pour respecter iOS HIG 44pt
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Arrêter l'enregistrement vocal"
        >
          <View style={styles.stopButton}>
            <View style={styles.stopSquare} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
};

const PILL_BG = "rgba(11, 17, 36, 0.85)";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    height: 40,
  },
  sideButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  pill: {
    flex: 1,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: PILL_BG,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginHorizontal: 4,
    overflow: "hidden",
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ui.error,
    marginRight: 8,
  },
  recordingText: {
    color: colors.text.light,
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    minWidth: 32,
    marginRight: 8,
  },
  waveform: {
    flex: 1,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  waveBar: {
    width: 2,
    borderRadius: 999,
    marginRight: 2,
    backgroundColor: "#FF8F94",
  },
  cancelHint: {
    position: "absolute",
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(11, 17, 36, 0.9)",
    borderRadius: 10,
  },
  cancelHintText: {
    color: colors.text.light,
    fontSize: 11,
    fontWeight: "500",
    marginLeft: 2,
  },
  lockHint: {
    position: "absolute",
    top: -36,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 17, 36, 0.9)",
    zIndex: 1,
  },
  stopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ui.error,
    justifyContent: "center",
    alignItems: "center",
  },
  stopSquare: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: colors.text.light,
  },
});
