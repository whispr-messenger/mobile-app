/**
 * Réactions rapides + bouton « Plus » (grille complète).
 * Design aligné palette Whispr (dark) ou carte claire simple (light).
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { QUICK_REACTION_DEFAULTS } from "../../data/emojiPickerData";
import { EmojiPickerSheet } from "./EmojiPickerSheet";

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onReactionSelect: (emoji: string) => void;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  visible,
  onClose,
  onReactionSelect,
}) => {
  const { settings } = useTheme();
  const isLight = settings.theme === "light";
  const [showFullPicker, setShowFullPicker] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowFullPicker(false);
    }
  }, [visible]);

  const handleQuick = (emoji: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onReactionSelect(emoji);
    onClose();
  };

  const openFullPicker = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowFullPicker(true);
  };

  /** Barre rapide : masquée quand la grille complète est ouverte (évite 2 modales qui se bloquent). */
  const showQuickBar = visible && !showFullPicker;

  return (
    <>
      <Modal
        visible={showQuickBar}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable
          style={styles.overlay}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.cardWrap,
              isLight ? styles.cardWrapLight : styles.cardWrapDark,
            ]}
          >
            {isLight ? (
              <View style={[styles.cardInner, styles.cardInnerLight]}>
                <Text style={styles.titleLight}>Réagir</Text>
                <View style={styles.row}>
                  {QUICK_REACTION_DEFAULTS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.reactionHit}
                      onPress={() => handleQuick(emoji)}
                      activeOpacity={0.65}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.plusWrap}
                    onPress={openFullPicker}
                    accessibilityLabel="Plus d'emojis"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={styles.plusCircleLight}>
                      <Ionicons
                        name="add"
                        size={26}
                        color={colors.primary.main}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <LinearGradient
                colors={[
                  "rgba(26, 31, 58, 0.98)",
                  "rgba(44, 36, 92, 0.95)",
                  "rgba(254, 122, 92, 0.22)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardInner}
              >
                <View style={styles.accentTop} />
                <View style={styles.row}>
                  {QUICK_REACTION_DEFAULTS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.reactionHit}
                      onPress={() => handleQuick(emoji)}
                      activeOpacity={0.65}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.plusWrap}
                    onPress={openFullPicker}
                    accessibilityLabel="Plus d'emojis"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <LinearGradient
                      colors={[colors.primary.main, colors.secondary.main]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.plusGradient}
                    >
                      <Ionicons
                        name="add"
                        size={26}
                        color={colors.text.light}
                      />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <EmojiPickerSheet
        visible={visible && showFullPicker}
        onClose={() => {
          setShowFullPicker(false);
        }}
        onSelect={(emoji) => {
          onReactionSelect(emoji);
          setShowFullPicker(false);
          onClose();
        }}
        title="Réagir avec un emoji"
        validateForReaction
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(8, 10, 26, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  cardWrap: {
    borderRadius: 24,
    maxWidth: 400,
    width: "100%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: { elevation: 14 },
      default: {},
    }),
  },
  cardWrapDark: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  cardWrapLight: {
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    backgroundColor: "#FFFFFF",
  },
  cardInner: {
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 10,
    overflow: "hidden",
  },
  cardInnerLight: {
    backgroundColor: "#FFFFFF",
  },
  accentTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary.main,
    opacity: 0.85,
  },
  titleLight: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "nowrap",
  },
  reactionHit: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginHorizontal: 2,
  },
  emoji: {
    fontSize: 30,
  },
  plusWrap: {
    marginLeft: 6,
  },
  plusGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  plusCircleLight: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(254, 122, 92, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(254, 122, 92, 0.35)",
  },
});
