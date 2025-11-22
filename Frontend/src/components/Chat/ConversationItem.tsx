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
import { Avatar } from './Avatar';
import { Ionicons } from '@expo/vector-icons';

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
    const date = new Date(conversation.last_message.sent_at);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Today: show time
    if (diffDays === 0) {
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    
    // This week: show day name
    if (diffDays < 7) {
      const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
      return dayName || '';
    }
    
    // Older: show date
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    });
  }, [conversation.last_message?.sent_at]);

  const getBadgeColor = useMemo(() => {
    const count = conversation.unread_count || 0;
    if (count === 0) return null;
    if (count < 10) return colors.palette.violet; // Violet
    if (count < 50) return colors.primary.main; // Orange
    return colors.ui.error; // Red for high counts
  }, [conversation.unread_count]);

  // Safety check for last_message content
  const lastMessageContent = conversation.last_message?.content || '';

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[
          styles.container,
          { backgroundColor: themeColors.background.secondary },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress(conversation.id);
        }}
        activeOpacity={0.7}
      >
      <View style={styles.content}>
        <Avatar
          size={48}
          name={conversation.type === 'direct' ? 'Contact' : (conversation.metadata?.name || 'Group')}
          showOnlineBadge={conversation.type === 'direct'}
          isOnline={false}
        />
        <View style={styles.textContainer}>
          <Text
            style={[styles.name, { color: themeColors.text.primary }]}
            numberOfLines={1}
          >
            {conversation.type === 'direct'
              ? 'Contact'
              : conversation.metadata?.name || 'Group'}
          </Text>
          {conversation.last_message && lastMessageContent ? (
            <Text
              style={[styles.lastMessage, { color: themeColors.text.secondary }]}
              numberOfLines={1}
            >
              {lastMessageContent}
            </Text>
          ) : null}
        </View>
        <View style={styles.metaContainer}>
          <View style={styles.metaRow}>
            {formattedTime ? (
              <Text
                style={[styles.timestamp, { color: themeColors.text.tertiary }]}
              >
                {formattedTime}
              </Text>
            ) : null}
            {conversation.is_pinned && (
              <Ionicons 
                name="pin" 
                size={14} 
                color={themeColors.text.tertiary} 
                style={styles.pinIcon}
              />
            )}
          </View>
          {conversation.unread_count && conversation.unread_count > 0 && getBadgeColor && (
            <View
              style={[
                styles.unreadBadge,
                { backgroundColor: getBadgeColor },
              ]}
            >
              <Text style={styles.unreadText}>
                {conversation.unread_count > 99 ? '99+' : String(conversation.unread_count)}
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
    marginRight: 12,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
  },
  pinIcon: {
    marginLeft: 4,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
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
    prevProps.conversation.unread_count === nextProps.conversation.unread_count &&
    prevProps.conversation.is_pinned === nextProps.conversation.is_pinned
  );
});

