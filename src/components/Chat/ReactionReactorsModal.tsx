/**
 * Liste des personnes ayant réagi avec un emoji donné (spec : sur demande).
 */

import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { Avatar } from "./Avatar";
import type { MessageReaction } from "../../types/messaging";

export interface ReactionReactorsModalProps {
  visible: boolean;
  emoji: string;
  reactors: MessageReaction[];
  /** userId -> nom affiché */
  resolveName: (userId: string) => string;
  onClose: () => void;
}

export const ReactionReactorsModal: React.FC<ReactionReactorsModalProps> = ({
  visible,
  emoji,
  reactors,
  resolveName,
  onClose,
}) => {
  const { getThemeColors, getFontSize } = useTheme();
  const themeColors = getThemeColors();
  const byUser = reactors.filter(
    (r, i, arr) => arr.findIndex((x) => x.user_id === r.user_id) === i,
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.sheetWrap} onStartShouldSetResponder={() => true}>
          <LinearGradient
            colors={["#1a1f3a", "#252a4a", "#2d1f3d"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheet}
          >
            <View style={styles.sheetHeader}>
              <Text
                style={[styles.emojiHuge, { fontSize: getFontSize("xxxl") }]}
              >
                {emoji}
              </Text>
              <View style={styles.headerText}>
                <Text
                  style={[
                    styles.title,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("lg"),
                    },
                  ]}
                >
                  Réactions
                </Text>
                <Text
                  style={[
                    styles.sub,
                    {
                      color: themeColors.text.secondary,
                      fontSize: getFontSize("sm"),
                    },
                  ]}
                >
                  {byUser.length} participant{byUser.length > 1 ? "s" : ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={12}
                style={styles.closeBtn}
              >
                <Ionicons
                  name="close"
                  size={26}
                  color={themeColors.text.primary}
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={Platform.OS === "web"}
            >
              {byUser.map((r) => (
                <View key={`${r.user_id}-${r.id}`} style={styles.row}>
                  <Avatar size={40} name={resolveName(r.user_id)} />
                  <Text
                    style={[
                      styles.name,
                      {
                        color: themeColors.text.primary,
                        fontSize: getFontSize("base"),
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {resolveName(r.user_id)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheetWrap: {
    borderRadius: 20,
    overflow: "hidden",
    maxHeight: "70%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,122,92,0.25)",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  emojiHuge: {
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: "800",
  },
  sub: {
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  name: {
    flex: 1,
    fontWeight: "600",
  },
});
