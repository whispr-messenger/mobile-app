import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

interface Props {
  muted: boolean;
  cameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlip: () => void;
  onEnd: () => void;
}

/**
 * In-call action bar: mute, camera on/off, flip, end.
 * Positioned by the parent (usually absolute at bottom of the call view).
 */
export const CallControls: React.FC<Props> = ({
  muted,
  cameraOff,
  onToggleMute,
  onToggleCamera,
  onFlip,
  onEnd,
}) => {
  return (
    <View style={styles.bar}>
      <Ctrl label={muted ? "Activer micro" : "Couper micro"} onPress={onToggleMute} />
      <Ctrl label={cameraOff ? "Activer caméra" : "Couper caméra"} onPress={onToggleCamera} />
      <Ctrl label="Pivoter" onPress={onFlip} />
      <Ctrl label="Raccrocher" danger onPress={onEnd} />
    </View>
  );
};

interface CtrlProps {
  label: string;
  onPress: () => void;
  danger?: boolean;
}

const Ctrl: React.FC<CtrlProps> = ({ label, onPress, danger }) => (
  <TouchableOpacity
    style={[styles.btn, danger && styles.danger]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Text style={styles.text}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  btn: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: "#333",
    minWidth: 70,
    alignItems: "center",
  },
  danger: { backgroundColor: "#e53935" },
  text: { color: "#fff", fontFamily: "Inter_600SemiBold" },
});

export default CallControls;
