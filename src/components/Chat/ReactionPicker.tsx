/**
 * Réactions rapides (spec) + bouton « Plus » ouvrant le sélecteur Unicode complet.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
  const [showFullPicker, setShowFullPicker] = useState(false);

  const handleQuick = (emoji: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onReactionSelect(emoji);
    onClose();
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <View
            style={styles.centerWrap}
            onStartShouldSetResponder={() => true}
          >
            <LinearGradient
              colors={[
                "rgba(26, 31, 58, 0.97)",
                "rgba(40, 45, 85, 0.98)",
                "rgba(79, 70, 229, 0.35)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.glowRing} />
              <View style={styles.row}>
                {QUICK_REACTION_DEFAULTS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionHit}
                    onPress={() => handleQuick(emoji)}
                    activeOpacity={0.65}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.plusWrap}
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setShowFullPicker(true);
                  }}
                  accessibilityLabel="Plus d'emojis"
                >
                  <LinearGradient
                    colors={[colors.primary.main, colors.secondary.main]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.plusGradient}
                  >
                    <Ionicons name="add" size={26} color={colors.text.light} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </TouchableOpacity>
      </Modal>

      <EmojiPickerSheet
        visible={showFullPicker}
        onClose={() => setShowFullPicker(false)}
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
    backgroundColor: "rgba(8, 10, 26, 0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  centerWrap: {
    borderRadius: 28,
    overflow: "visible",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  card: {
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 122, 92, 0.35)",
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
    marginLeft: 4,
  },
  plusGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
});
