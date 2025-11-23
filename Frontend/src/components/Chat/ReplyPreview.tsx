/**
 * ReplyPreview - Preview of the message being replied to
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { Message } from '../../types/messaging';

interface ReplyPreviewProps {
  replyTo: Message;
  onPress?: () => void;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({ replyTo, onPress }) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const content = replyTo.is_deleted
    ? '[Message supprimé]'
    : replyTo.content.length > 50
    ? replyTo.content.substring(0, 50) + '...'
    : replyTo.content;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        styles.container,
        {
          borderLeftColor: themeColors.primary,
          backgroundColor: 'rgba(26, 31, 58, 0.4)',
        },
      ]}
    >
      <Text
        style={[styles.senderName, { color: themeColors.primary }]}
        numberOfLines={1}
      >
        {replyTo.sender_id === 'user-1' ? 'Vous' : 'Contact'}
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
    fontWeight: '600',
    marginBottom: 2,
  },
  content: {
    fontSize: 13,
  },
});

