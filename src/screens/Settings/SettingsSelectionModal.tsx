import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const SELECT_BLUE = "#4F9FFF";
const SELECT_BLUE_SOFT = "rgba(79, 159, 255, 0.22)";
const SELECT_BLUE_BORDER = "#6BB3FF";
const SELECT_GLOW = "rgba(79, 159, 255, 0.35)";

export type SelectionOption = { label: string; value: string };

type ThemeColors = {
  background: { primary: string; secondary: string };
  text: { primary: string; secondary: string; tertiary: string };
  primary: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: SelectionOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  themeColors: ThemeColors;
  getFontSize: (size: "xs" | "sm" | "base" | "lg" | "xl" | "xxl" | "xxxl") => number;
  cancelLabel: string;
};

const WINDOW_H = Dimensions.get("window").height;
const SHEET_MAX = Math.min(380, WINDOW_H * 0.52);

export function SettingsSelectionModal({
  visible,
  onClose,
  title,
  subtitle,
  options,
  selectedValue,
  onSelect,
  themeColors,
  getFontSize,
  cancelLabel,
}: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const backdropOp = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(WINDOW_H)).current;

  useEffect(() => {
    if (visible) {
      setOpen(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (visible) {
      sheetY.setValue(WINDOW_H);
      backdropOp.setValue(0);
      Animated.parallel([
        Animated.timing(backdropOp, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(sheetY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 56,
          friction: 11,
          velocity: 2,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOp, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetY, {
          toValue: WINDOW_H,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setOpen(false);
        }
      });
    }
  }, [visible, open, backdropOp, sheetY]);

  if (!open) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "rgba(5, 8, 22, 0.72)",
              opacity: backdropOp,
            },
          ]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={cancelLabel} />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: themeColors.background.secondary,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              maxHeight: SHEET_MAX + insets.bottom + 80,
              transform: [{ translateY: sheetY }],
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: themeColors.text.tertiary }]} />
          </View>

          <Text
            style={[
              styles.title,
              { color: themeColors.text.primary, fontSize: getFontSize("xl") },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                {
                  color: themeColors.text.secondary,
                  fontSize: getFontSize("sm"),
                },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            bounces={false}
            nestedScrollEnabled
          >
            {options.map((option) => {
              const selected = selectedValue === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    if (selectedValue !== option.value) {
                      onSelect(option.value);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      borderColor: selected ? SELECT_BLUE_BORDER : "rgba(255,255,255,0.1)",
                      backgroundColor: selected
                        ? SELECT_BLUE_SOFT
                        : pressed
                          ? "rgba(255,255,255,0.07)"
                          : "rgba(255,255,255,0.04)",
                      borderWidth: selected ? 2 : 1,
                      shadowColor: selected ? SELECT_GLOW : "transparent",
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: selected ? 0.85 : 0,
                      shadowRadius: selected ? 12 : 0,
                      elevation: selected ? 4 : 0,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: selected ? SELECT_BLUE : themeColors.text.primary,
                        fontSize: getFontSize("base"),
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={24} color={SELECT_BLUE} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelBtn,
              {
                borderColor: "rgba(255,255,255,0.22)",
                backgroundColor: pressed ? "rgba(255,255,255,0.08)" : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.cancelText,
                { color: themeColors.text.secondary, fontSize: getFontSize("base") },
              ]}
            >
              {cancelLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.08)",
  },
  handleWrap: {
    alignItems: "center",
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.45,
  },
  title: {
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
    opacity: 0.92,
    paddingHorizontal: 8,
  },
  scroll: {
    maxHeight: SHEET_MAX,
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginBottom: 10,
  },
  optionLabel: {
    fontWeight: "600",
    flex: 1,
    paddingRight: 12,
  },
  cancelBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelText: {
    fontWeight: "600",
  },
});
