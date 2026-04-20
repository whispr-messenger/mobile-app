import React from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type ChoiceOption = { label: string; value: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  options: ChoiceOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  cancelLabel: string;
  /** auto: 2 choix → ligne horizontale (style iOS), sinon pile verticale */
  layout?: "auto" | "horizontal" | "vertical";
};

const CARD_MAX = Math.min(320, Dimensions.get("window").width - 40);

const IOS_BG = "rgba(245, 245, 250, 0.98)";
const IOS_SEP = "rgba(60, 60, 67, 0.29)";
const IOS_TITLE = "#000000";
const IOS_BODY = "#3C3C43";
const IOS_ACTION = "#007AFF";
const IOS_ACTION_WEIGHT = "400" as const;

export function SettingsChoiceAlert({
  visible,
  onClose,
  title,
  message,
  options,
  selectedValue,
  onSelect,
  cancelLabel,
  layout = "auto",
}: Props) {
  const mode =
    layout === "auto"
      ? options.length === 2
        ? "horizontal"
        : "vertical"
      : layout;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
        />
        <View
          style={[styles.card, { maxWidth: CARD_MAX }]}
          accessibilityViewIsModal
        >
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {message ? (
            <Text style={styles.message}>{message}</Text>
          ) : (
            <View style={styles.titleSpacer} />
          )}

          {mode === "horizontal" && options.length === 2 ? (
            <View style={styles.rowActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.halfBtn,
                  pressed && styles.pressedLight,
                ]}
                onPress={() => onSelect(options[0].value)}
              >
                <Text
                  style={[
                    styles.actionText,
                    selectedValue === options[0].value && styles.actionSelected,
                  ]}
                >
                  {options[0].label}
                </Text>
              </Pressable>
              <View style={styles.vSep} />
              <Pressable
                style={({ pressed }) => [
                  styles.halfBtn,
                  pressed && styles.pressedLight,
                ]}
                onPress={() => onSelect(options[1].value)}
              >
                <Text
                  style={[
                    styles.actionText,
                    selectedValue === options[1].value && styles.actionSelected,
                  ]}
                >
                  {options[1].label}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.colActions}>
              {options.map((opt, index) => (
                <View key={opt.value}>
                  {index > 0 ? <View style={styles.hSep} /> : null}
                  <Pressable
                    style={({ pressed }) => [
                      styles.colBtn,
                      pressed && styles.pressedLight,
                    ]}
                    onPress={() => onSelect(opt.value)}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        selectedValue === opt.value && styles.actionSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && styles.pressedLight,
            ]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  card: {
    width: "100%",
    backgroundColor: IOS_BG,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: IOS_TITLE,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_BODY,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  titleSpacer: {
    height: 8,
  },
  rowActions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_SEP,
    minHeight: 48,
  },
  halfBtn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
  },
  vSep: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: IOS_SEP,
  },
  colActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_SEP,
  },
  colBtn: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  hSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_SEP,
  },
  actionText: {
    fontSize: 17,
    fontWeight: IOS_ACTION_WEIGHT,
    color: IOS_ACTION,
    textAlign: "center",
  },
  actionSelected: {
    fontWeight: "700",
  },
  pressedLight: {
    backgroundColor: "rgba(0, 0, 0, 0.04)",
  },
  cancelBtn: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 8,
    borderTopColor: "#E9E9EB",
  },
  cancelText: {
    fontSize: 17,
    fontWeight: "600",
    color: IOS_ACTION,
  },
});
