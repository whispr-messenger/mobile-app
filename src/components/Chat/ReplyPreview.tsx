/**
 * ReplyPreview - Preview of the message being replied to
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { Message } from "../../types/messaging";

interface ReplyPreviewProps {
  replyTo: Message;
  currentUserId?: string;
  onPress?: () => void;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  replyTo,
  currentUserId,
  onPress,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  // Media-only messages (photo, vocal, etc.) can ship with empty/missing
  // content. Fall back to a sensible placeholder so we never call .length on
  // undefined and the bubble keeps showing the reply context after reload.
  const rawContent = replyTo.content ?? "";
  const placeholderForMedia =
    replyTo.message_type === "media" && !rawContent
      ? "Pièce jointe"
      : rawContent;
  const content = replyTo.is_deleted
    ? "[Message supprimé]"
    : placeholderForMedia.length > 50
      ? placeholderForMedia.substring(0, 50) + "..."
      : placeholderForMedia;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        styles.container,
        {
          borderLeftColor: themeColors.primary,
          backgroundColor: "rgba(26, 31, 58, 0.4)",
        },
      ]}
    >
      <Text
        style={[styles.senderName, { color: themeColors.primary }]}
        numberOfLines={1}
      >
        {replyTo.sender_id === currentUserId
          ? "Vous"
          : (replyTo as any).sender_name || "Contact"}
      </Text>
      <Text
        style={[styles.content, { color: themeColors.text.secondary }]}
        numberOfLines={1}
      >
        {content}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  content: {
    fontSize: 13,
  },
});
