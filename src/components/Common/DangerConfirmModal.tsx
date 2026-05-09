/**
 * DangerConfirmModal - confirmation forte pour actions destructives
 *
 * L'user doit taper un mot de validation (ex: "SUPPRIMER") avant que le
 * bouton de confirmation devienne actif. Empêche les déclenchements
 * accidentels (un simple tap sur "Confirmer" ne suffit plus).
 */

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors, withOpacity } from "../../theme/colors";

export type DangerConfirmActionVariant = "destructive" | "warning";

export interface DangerConfirmModalProps {
  visible: boolean;
  title: string;
  description: string;
  expectedText: string;
  caseInsensitive?: boolean;
  actionLabel: string;
  actionVariant?: DangerConfirmActionVariant;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export const DangerConfirmModal: React.FC<DangerConfirmModalProps> = ({
  visible,
  title,
  description,
  expectedText,
  caseInsensitive = true,
  actionLabel,
  actionVariant = "destructive",
  onCancel,
  onConfirm,
  loading = false,
}) => {
  const [input, setInput] = useState("");
  const { getThemeColors, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();

  // reset l'input a chaque ouverture pour ne pas garder l'ancien match
  useEffect(() => {
    if (visible) {
      setInput("");
    }
  }, [visible]);

  const normalize = (value: string): string =>
    caseInsensitive ? value.trim().toLowerCase() : value.trim();

  const isMatch = normalize(input) === normalize(expectedText);
  const canConfirm = isMatch && !loading;

  const variantColor =
    actionVariant === "warning" ? colors.ui.warning : colors.ui.error;

  const handleConfirm = () => {
    if (!canConfirm) return;
    void onConfirm();
  };

  const handleSubmitEditing = () => {
    if (canConfirm) handleConfirm();
  };

  const typeToConfirmLabel = getLocalizedText("confirm.typeToConfirm").replace(
    "{{text}}",
    expectedText,
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: colors.background.dark },
          ]}
        >
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: withOpacity(variantColor, 0.15) },
              ]}
            >
              <Ionicons name="warning-outline" size={32} color={variantColor} />
            </View>
          </View>

          <Text style={[styles.title, { color: themeColors.text.primary }]}>
            {title}
          </Text>

          <Text style={[styles.message, { color: themeColors.text.secondary }]}>
            {description}
          </Text>

          <Text
            style={[styles.typeLabel, { color: themeColors.text.secondary }]}
          >
            {typeToConfirmLabel}
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.text.primary,
                borderColor: isMatch
                  ? variantColor
                  : withOpacity(colors.text.light, 0.2),
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                opacity: loading ? 0.5 : 1,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder={expectedText}
            placeholderTextColor={withOpacity(colors.text.light, 0.4)}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
            onSubmitEditing={handleSubmitEditing}
            returnKeyType="done"
            // accessibilite : decrit l'effet attendu
            accessibilityLabel={typeToConfirmLabel}
            accessibilityHint={
              isMatch
                ? actionLabel
                : getLocalizedText("confirm.actionIrreversible")
            }
            testID="danger-confirm-input"
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { borderColor: withOpacity(colors.text.light, 0.2) },
              ]}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.7}
              accessibilityRole="button"
              testID="danger-confirm-cancel"
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  { color: themeColors.text.primary },
                ]}
              >
                {getLocalizedText("confirm.cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                {
                  backgroundColor: variantColor,
                  opacity: canConfirm ? 1 : 0.4,
                },
              ]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canConfirm }}
              testID="danger-confirm-action"
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.text.light} />
              ) : (
                <Text
                  style={[
                    styles.confirmButtonText,
                    { color: colors.text.light },
                  ]}
                >
                  {actionLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  typeLabel: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 8,
    alignSelf: "stretch",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {},
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
