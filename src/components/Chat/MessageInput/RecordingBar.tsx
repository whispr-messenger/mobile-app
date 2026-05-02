import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../../theme/colors";

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
  const recordingWaveBars = Array.from({ length: 16 }, (_, index) => {
    const base = 7 + (index % 4) * 2;
    const pulse = Math.round(
      ((Math.sin(wavePhase * 0.7 + index * 0.9) + 1) / 2) * 14,
    );
    return base + pulse;
  });

  return (
    <>
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
    </>
  );
};

const styles = StyleSheet.create({
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
});
