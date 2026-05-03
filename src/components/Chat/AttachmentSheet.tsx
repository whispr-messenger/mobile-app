import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { colors, withOpacity } from "../../theme/colors";

export type AttachmentAction =
  | "camera"
  | "gallery"
  | "document"
  | "gif"
  | "sticker"
  | "emoji";

interface AttachmentOption {
  id: AttachmentAction;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  gradient: readonly [string, string];
}

const OPTIONS: AttachmentOption[] = [
  {
    id: "camera",
    label: "Caméra",
    icon: "camera",
    gradient: ["#F04882", "#FFB07B"],
  },
  {
    id: "gallery",
    label: "Galerie",
    icon: "image",
    gradient: ["#7B5BD6", "#3C2E7C"],
  },
  {
    id: "document",
    label: "Document",
    icon: "document-text",
    gradient: ["#3FB7E0", "#1F6F9E"],
  },
  {
    id: "emoji",
    label: "Emoji",
    icon: "happy-outline",
    gradient: ["#5BD6A8", "#2E9C76"],
  },
];

// Approx. position of the "+" button so the popup grows out of it.
// MessageInput uses paddingHorizontal:12 + attachButtonWrapper marginRight:8
// and the AttachButton itself is 40x40, so the button's left edge sits at 12.
const POPUP_LEFT = 12;
// Sit just above the bottom bar (bar minHeight 56 + a small gap).
const POPUP_BOTTOM_OFFSET = 64;
const POPUP_WIDTH = 260;

interface AttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: AttachmentAction) => void;
}

export const AttachmentSheet: React.FC<AttachmentSheetProps> = ({
  visible,
  onClose,
  onSelect,
}) => {
  const insets = useSafeAreaInsets();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

  const animateOpen = useCallback(() => {
    scale.setValue(0.85);
    opacity.setValue(0);
    backdropOp.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 140,
        friction: 11,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOp, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity, backdropOp]);

  const animateClose = useCallback(
    (done: () => void) => {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 140,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOp, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) done();
      });
    },
    [scale, opacity, backdropOp],
  );

  useEffect(() => {
    if (visible) {
      animateOpen();
    }
  }, [visible, animateOpen]);

  const handleClose = useCallback(() => {
    animateClose(onClose);
  }, [animateClose, onClose]);

  const handleSelect = useCallback(
    (option: AttachmentOption) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateClose(() => {
        onClose();
        onSelect(option.id);
      });
    },
    [animateClose, onClose, onSelect],
  );

  if (!visible) return null;

  const bottomPosition = POPUP_BOTTOM_OFFSET + Math.max(insets.bottom, 0);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.root} testID="attachment-sheet">
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.backdropTint,
            { opacity: backdropOp },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer le menu des pièces jointes"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.popup,
            {
              left: POPUP_LEFT,
              bottom: bottomPosition,
              opacity,
              transform: [
                {
                  translateY: scale.interpolate({
                    inputRange: [0.85, 1],
                    outputRange: [12, 0],
                  }),
                },
                { scale },
              ],
            },
          ]}
        >
          {OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              testID={`attachment-option-${option.id}`}
              style={[
                styles.row,
                index < OPTIONS.length - 1 && styles.rowDivider,
              ]}
              onPress={() => handleSelect(option)}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel={option.label}
            >
              <LinearGradient
                colors={option.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconBubble}
              >
                <Ionicons
                  name={option.icon}
                  size={18}
                  color={colors.text.light}
                />
              </LinearGradient>
              <Text
                style={[styles.rowLabel, { color: themeColors.text.primary }]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdropTint: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  popup: {
    position: "absolute",
    width: POPUP_WIDTH,
    backgroundColor: "rgba(28, 28, 32, 0.92)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withOpacity(colors.text.light, 0.08),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withOpacity(colors.text.light, 0.08),
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
});
