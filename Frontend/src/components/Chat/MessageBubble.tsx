/**
 * MessageBubble - Individual message display component
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageWithStatus } from '../../types/messaging';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface MessageBubbleProps {
  message: MessageWithStatus;
  isSent: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSent,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  if (isSent) {
    return (
      <View style={styles.sentContainer}>
        <LinearGradient
          colors={[colors.primary.main, colors.primary.light]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sentBubble}
        >
          <Text style={styles.sentText}>{message.content}</Text>
          <Text style={styles.timestamp}>
            {new Date(message.sent_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.receivedContainer}>
      <View
        style={[
          styles.receivedBubble,
          { backgroundColor: themeColors.background.secondary },
        ]}
      >
        <Text style={[styles.receivedText, { color: themeColors.text.primary }]}>
          {message.content}
        </Text>
        <Text style={[styles.timestamp, { color: colors.text.tertiary }]}>
          {new Date(message.sent_at).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sentContainer: {
    alignItems: 'flex-end',
    marginVertical: 4,
    marginHorizontal: 16,
  },
  sentBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  sentText: {
    color: colors.text.light,
    fontSize: 15,
    marginBottom: 4,
  },
  receivedContainer: {
    alignItems: 'flex-start',
    marginVertical: 4,
    marginHorizontal: 16,
  },
  receivedBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  receivedText: {
    fontSize: 15,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: colors.text.tertiary,
    alignSelf: 'flex-end',
  },
});

export default memo(MessageBubble, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.status === nextProps.message.status
  );
});

