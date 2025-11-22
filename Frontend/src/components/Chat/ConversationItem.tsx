/**
 * ConversationItem - Individual conversation list item
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Conversation } from '../../types/messaging';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: (conversationId: string) => void;
  index?: number;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  onPress,
  index = 0,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const translateX = useSharedValue(50);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    const delay = index * 50;
    setTimeout(() => {
      translateX.value = withSpring(0, {
        damping: 15,
        stiffness: 150,
      });
      opacity.value = withTiming(1, { duration: 300 });
    }, delay);
  }, [index, translateX, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const formattedTime = useMemo(() => {
    if (!conversation.last_message) return '';
    return new Date(conversation.last_message.sent_at).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [conversation.last_message?.sent_at]);

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[
          styles.container,
          { backgroundColor: themeColors.background.primary },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress(conversation.id);
        }}
        activeOpacity={0.7}
      >
      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          {/* TODO: Add avatar */}
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[styles.name, { color: themeColors.text.primary }]}
            numberOfLines={1}
          >
            {conversation.type === 'direct' ? 'Contact' : 'Group'}
          </Text>
          {conversation.last_message && (
            <Text
              style={[styles.lastMessage, { color: themeColors.text.secondary }]}
              numberOfLines={1}
            >
              {conversation.last_message.content}
            </Text>
          )}
        </View>
        <View style={styles.metaContainer}>
          {formattedTime && (
            <Text
              style={[styles.timestamp, { color: themeColors.text.tertiary }]}
            >
              {formattedTime}
            </Text>
          )}
          {conversation.unread_count && conversation.unread_count > 0 && (
            <View
              style={[
                styles.unreadBadge,
                { backgroundColor: colors.primary.main },
              ]}
            >
              <Text style={styles.unreadText}>
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: colors.secondary.light,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
  },
  metaContainer: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 12,
    marginBottom: 4,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: '600',
  },
});

// Memoize with custom comparator
export default memo(ConversationItem, (prevProps, nextProps) => {
  return (
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.conversation.updated_at === nextProps.conversation.updated_at &&
    prevProps.conversation.unread_count === nextProps.conversation.unread_count
  );
});

