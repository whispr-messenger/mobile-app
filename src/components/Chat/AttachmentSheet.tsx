import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
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

const { height: SCREEN_H } = Dimensions.get("window");
const APP_GRADIENT = colors.background.gradient.app;

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
  comingSoon?: boolean;
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
    comingSoon: true,
  },
  {
    id: "gif",
    label: "GIF",
    icon: "film",
    gradient: ["#FE7A5C", "#E04A2F"],
    comingSoon: true,
  },
  {
    id: "sticker",
    label: "Sticker",
    icon: "happy",
    gradient: ["#FFB07B", "#F0A53D"],
    comingSoon: true,
  },
  {
    id: "emoji",
    label: "Emoji",
    icon: "happy-outline",
    gradient: ["#5BD6A8", "#2E9C76"],
  },
];

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

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

  const animateOpen = useCallback(() => {
    slideY.setValue(SCREEN_H);
    backdropOp.setValue(0);
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }),
      Animated.timing(backdropOp, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideY, backdropOp]);

  const animateClose = useCallback(
    (done: () => void) => {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: SCREEN_H,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOp, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) done();
      });
    },
    [slideY, backdropOp],
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
      if (option.comingSoon) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateClose(() => {
        onClose();
        onSelect(option.id);
      });
    },
    [animateClose, onClose, onSelect],
  );

  const backdropStyle = {
    opacity: backdropOp.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.62],
    }),
  };

  if (!visible) return null;

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
          style={[StyleSheet.absoluteFill, styles.backdropTint, backdropStyle]}
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
            styles.sheetOuter,
            {
              paddingBottom: Math.max(insets.bottom, 12) + 12,
              transform: [{ translateY: slideY }],
            },
          ]}
        >
          <LinearGradient
            colors={[...APP_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheetGradient}
          >
            <View style={styles.handle} />
            <Text style={[styles.title, { color: themeColors.text.primary }]}>
              Ajouter une pièce jointe
            </Text>
            <View style={styles.grid}>
              {OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  testID={`attachment-option-${option.id}`}
                  style={styles.optionCell}
                  onPress={() => handleSelect(option)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ disabled: !!option.comingSoon }}
                >
                  <LinearGradient
                    colors={
                      option.comingSoon
                        ? [
                            withOpacity(colors.text.light, 0.18),
                            withOpacity(colors.text.light, 0.08),
                          ]
                        : option.gradient
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.optionIcon}
                  >
                    <Ionicons
                      name={option.icon}
                      size={28}
                      color={colors.text.light}
                    />
                  </LinearGradient>
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: option.comingSoon
                          ? themeColors.text.tertiary
                          : themeColors.text.primary,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.comingSoon && (
                    <Text style={styles.comingSoonBadge}>Bientôt</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropTint: {
    backgroundColor: "#0B1124",
  },
  sheetOuter: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 24,
  },
  sheetGradient: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: withOpacity(colors.text.light, 0.22),
    marginBottom: 14,
    marginTop: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  optionCell: {
    width: "31%",
    alignItems: "center",
    marginBottom: 18,
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  comingSoonBadge: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: withOpacity(colors.text.light, 0.5),
    marginTop: 2,
    textTransform: "uppercase",
  },
});
