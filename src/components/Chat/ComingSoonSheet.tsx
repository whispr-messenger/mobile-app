import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { colors, withOpacity } from "../../theme/colors";

const APP_GRADIENT = colors.background.gradient.app;

interface ComingSoonSheetProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
}

/**
 * Lightweight placeholder sheet for attachment types whose backend wiring
 * is planned but not yet shipped (GIF picker via Tenor, Sticker picker via
 * a bundled CDN). Displays a centered illustration + "Bientôt" badge.
 */
export const ComingSoonSheet: React.FC<ComingSoonSheetProps> = ({
  visible,
  onClose,
  testID,
  icon,
  title,
  description,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root} testID={testID}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <LinearGradient
          colors={[...APP_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sheet}
        >
          <View style={styles.handle} />
          <View style={styles.iconWrap}>
            <LinearGradient
              colors={[colors.primary.main, colors.primary.dark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Ionicons name={icon} size={32} color={colors.text.light} />
            </LinearGradient>
            <Text style={styles.badge}>Bientôt</Text>
          </View>
          <Text style={[styles.title, { color: themeColors.text.primary }]}>
            {title}
          </Text>
          <Text
            style={[styles.description, { color: themeColors.text.secondary }]}
          >
            {description}
          </Text>
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <Text
              style={[styles.closeText, { color: themeColors.text.tertiary }]}
            >
              Fermer
            </Text>
          </Pressable>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 17, 36, 0.55)",
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 32,
    alignItems: "center",
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: withOpacity(colors.text.light, 0.22),
    marginBottom: 24,
    marginTop: 4,
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: withOpacity(colors.text.light, 0.12),
    color: colors.text.light,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  closeText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
