/**
 * MessageActionsMenu — actions sur un message (palette Whispr, dark / light).
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { MessageWithRelations } from "../../types/messaging";

interface MessageActionsMenuProps {
  visible: boolean;
  message: MessageWithRelations | null;
  isSent: boolean;
  isPinned: boolean;
  onClose: () => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: (deleteForEveryone: boolean) => void;
  onReact?: () => void;
  onPin?: () => void;
  onForward?: () => void;
}

const GRADIENT_DARK = [
  "rgba(11, 17, 36, 0.98)",
  "rgba(44, 36, 92, 0.96)",
  "rgba(254, 122, 92, 0.18)",
] as const;

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export const MessageActionsMenu: React.FC<MessageActionsMenuProps> = ({
  visible,
  message,
  isSent,
  isPinned,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onPin,
  onForward,
}) => {
  const { getThemeColors, settings } = useTheme();
  const themeColors = getThemeColors();
  const isLight = settings.theme === "light";

  if (!visible || !message) return null;

  const handleDelete = (deleteForEveryone: boolean) => {
    triggerHaptic();
    onDelete?.(deleteForEveryone);
    onClose();
  };

  const runAction = (fn?: () => void) => {
    triggerHaptic();
    fn?.();
    onClose();
  };

  const sepColor = isLight
    ? "rgba(0, 0, 0, 0.08)"
    : "rgba(255, 255, 255, 0.12)";
  const labelColor = isLight ? themeColors.text.primary : colors.text.light;
  const mutedLabel = isLight
    ? themeColors.text.secondary
    : "rgba(255, 255, 255, 0.65)";
  const iconBg = isLight
    ? "rgba(254, 122, 92, 0.12)"
    : "rgba(254, 122, 92, 0.2)";
  const iconColor = colors.primary.main;

  const ActionRow = ({
    label,
    onPress,
    danger,
    iconName,
  }: {
    iconName: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.actionItem}
      onPress={onPress}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.iconChip,
          { backgroundColor: danger ? "rgba(255, 59, 48, 0.15)" : iconBg },
        ]}
      >
        <Ionicons
          name={iconName}
          size={20}
          color={danger ? colors.ui.error : iconColor}
        />
      </View>
      <Text
        style={[
          styles.actionText,
          { color: danger ? colors.ui.error : labelColor },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const sheetContent = (
    <>
      {!isLight && <View style={styles.accentBar} />}
      {isLight && (
        <Text style={[styles.sheetTitle, { color: mutedLabel }]}>
          Actions du message
        </Text>
      )}

      {onReact && (
        <ActionRow
          iconName="happy-outline"
          label="Réagir"
          onPress={() => runAction(onReact)}
        />
      )}
      {onReply && (
        <ActionRow
          iconName="arrow-undo-outline"
          label="Répondre"
          onPress={() => runAction(onReply)}
        />
      )}
      {isSent && onEdit && (
        <ActionRow
          iconName="create-outline"
          label="Modifier"
          onPress={() => runAction(onEdit)}
        />
      )}
      {onPin && (
        <ActionRow
          iconName={isPinned ? "pin" : "pin-outline"}
          label={isPinned ? "Désépingler" : "Épingler"}
          onPress={() => runAction(onPin)}
        />
      )}
      {onForward && (
        <ActionRow
          iconName="arrow-redo-outline"
          label="Transférer"
          onPress={() => runAction(onForward)}
        />
      )}

      {onDelete && (
        <>
          <View style={[styles.separator, { backgroundColor: sepColor }]} />
          <ActionRow
            iconName="trash-outline"
            label="Supprimer pour moi"
            danger
            onPress={() => handleDelete(false)}
          />
          {isSent && (
            <ActionRow
              iconName="trash"
              label="Supprimer pour tous"
              danger
              onPress={() => handleDelete(true)}
            />
          )}
        </>
      )}

      <View style={[styles.separator, { backgroundColor: sepColor }]} />
      <TouchableOpacity
        style={styles.cancelRow}
        onPress={() => {
          triggerHaptic();
          onClose();
        }}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel="Annuler"
      >
        <Text
          style={[
            styles.cancelText,
            { color: isLight ? themeColors.text.tertiary : mutedLabel },
          ]}
        >
          Annuler
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={[
          styles.overlay,
          isLight
            ? { backgroundColor: "rgba(15, 18, 40, 0.45)" }
            : { backgroundColor: "rgba(8, 10, 26, 0.55)" },
        ]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.container,
            isLight ? styles.containerLight : styles.containerDark,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {isLight ? (
            <View style={styles.lightInner}>{sheetContent}</View>
          ) : (
            <LinearGradient
              colors={[...GRADIENT_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientContainer}
            >
              {sheetContent}
            </LinearGradient>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  container: {
    borderRadius: 22,
    minWidth: 280,
    maxWidth: 340,
    width: "100%",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: { elevation: 18 },
      default: {},
    }),
  },
  containerDark: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  containerLight: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  gradientContainer: {
    borderRadius: 22,
    paddingTop: 4,
    paddingBottom: 6,
  },
  lightInner: {
    paddingTop: 12,
    paddingBottom: 6,
  },
  accentBar: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary.main,
    marginBottom: 10,
    marginTop: 8,
    opacity: 0.95,
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
    marginHorizontal: 16,
  },
  cancelRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
