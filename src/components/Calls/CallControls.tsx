import React from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { colors, withOpacity } from "../../theme/colors";

interface Props {
  muted: boolean;
  cameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlip: () => void;
  onEnd: () => void;
  bottomInset?: number;
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
  bottomInset = 0,
}) => {
  return (
    <View
      style={[styles.wrapper, { paddingBottom: Math.max(bottomInset, 12) }]}
    >
      <View style={styles.shadowFrame}>
        <BlurView
          intensity={Platform.OS === "ios" ? 60 : 85}
          tint="dark"
          style={styles.blur}
        >
          <View style={styles.overlay}>
            <View style={styles.bar}>
              <Ctrl
                label={muted ? "Micro" : "Micro"}
                helper={muted ? "Activé" : "Coupé"}
                accessibilityLabel={muted ? "Activer micro" : "Couper micro"}
                icon={muted ? "mic-off-outline" : "mic-outline"}
                active={!muted}
                onPress={onToggleMute}
              />
              <Ctrl
                label="Caméra"
                helper={cameraOff ? "Coupée" : "Active"}
                accessibilityLabel={
                  cameraOff ? "Activer caméra" : "Couper caméra"
                }
                icon={cameraOff ? "videocam-off-outline" : "videocam-outline"}
                active={!cameraOff}
                onPress={onToggleCamera}
              />
              <Ctrl
                label="Pivoter"
                helper="Caméra"
                icon="camera-reverse-outline"
                onPress={onFlip}
              />
              <Ctrl
                label=""
                helper="Fin"
                accessibilityLabel="Fin"
                icon="call-outline"
                danger
                onPress={onEnd}
              />
            </View>
          </View>
        </BlurView>
      </View>
    </View>
  );
};

interface CtrlProps {
  label: string;
  helper: string;
  accessibilityLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
}

const Ctrl: React.FC<CtrlProps> = ({
  label,
  helper,
  accessibilityLabel,
  icon,
  onPress,
  danger,
  active,
}) => (
  <TouchableOpacity
    style={[styles.btn, active && styles.btnActive, danger && styles.danger]}
    onPress={onPress}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel || label || helper}
  >
    <View
      style={[
        styles.iconWrap,
        active && styles.iconWrapActive,
        danger && styles.iconWrapDanger,
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={
          danger
            ? colors.text.light
            : active
              ? colors.primary.main
              : colors.text.light
        }
      />
    </View>
    <Text style={styles.text}>{label}</Text>
    <Text style={styles.helper}>{helper}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  shadowFrame: {
    borderRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  blur: {
    borderRadius: 30,
    overflow: "hidden",
  },
  overlay: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor:
      Platform.OS === "ios" ? "rgba(15,19,37,0.34)" : "rgba(15,19,37,0.72)",
  },
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  btn: {
    flex: 1,
    alignItems: "center",
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  btnActive: {
    backgroundColor: withOpacity(colors.secondary.main, 0.22),
    borderColor: withOpacity(colors.primary.main, 0.18),
  },
  danger: {
    backgroundColor: withOpacity(colors.ui.error, 0.82),
    borderColor: withOpacity(colors.primary.light, 0.2),
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  iconWrapActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  iconWrapDanger: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  text: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  helper: {
    color: "rgba(255,255,255,0.64)",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
});

export default CallControls;
