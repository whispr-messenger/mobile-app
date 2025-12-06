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
  editMode?: boolean;
  isSelected?: boolean;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  onPress,
  index = 0,
  editMode = false,
  isSelected = false,
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
    let date: Date;
    
    if (conversation.last_message?.sent_at) {
      date = new Date(conversation.last_message.sent_at);
    } else if (conversation.updated_at) {
      date = new Date(conversation.updated_at);
    } else if (conversation.created_at) {
      date = new Date(conversation.created_at);
    } else {
      return 'Maintenant';
    }
    
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    
    if (diffMinutes < 1) {
      return 'Maintenant';
    }
    
    if (diffMinutes < 60) {
      return `${diffMinutes}min`;
    }
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    
    if (diffDays < 7) {
      const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
      return dayName || '';
    }
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    });
  }, [conversation.last_message?.sent_at, conversation.updated_at, conversation.created_at]);

  const getBadgeColor = useMemo(() => {
    const count = conversation.unread_count || 0;
    if (count === 0) return null;
    if (count < 10) return colors.secondary.main; // Purple/blue
    if (count < 50) return colors.primary.main; // Orange
    return colors.ui.error; // Red for high counts
  }, [conversation.unread_count]);

  // Safety check for last_message content
  const lastMessageContent = conversation.last_message?.content || '';

  const isEditMode = editMode === true;
  const isItemSelected = isSelected === true;

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[
          styles.container,
          { 
            backgroundColor: isItemSelected ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            borderBottomColor: 'rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
          },
        ]}
        activeOpacity={0.7}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress(conversation.id);
        }}
        activeOpacity={0.7}
      >
      <View style={styles.content}>
        {isEditMode && (
          <View style={styles.checkboxContainer}>
            <View style={[
              styles.checkbox,
              isItemSelected && styles.checkboxSelected,
              { borderColor: isItemSelected ? colors.primary.main : 'rgba(255, 255, 255, 0.5)' }
            ]}>
              {isItemSelected && (
                <Ionicons name="checkmark" size={16} color={colors.text.light} />
              )}
            </View>
          </View>
        )}
        <Avatar
          size={48}
          uri={conversation.avatar_url}
          name={conversation.display_name || (conversation.type === 'direct' ? 'Contact' : (conversation.metadata?.name || 'Group'))}
          showOnlineBadge={conversation.type === 'direct'}
          isOnline={false}
        />
        <View style={styles.textContainer}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, { color: '#FFFFFF' }]}
              numberOfLines={1}
            >
              {conversation.display_name || (conversation.type === 'direct'
                ? 'Contact'
                : conversation.metadata?.name || 'Group')}
            </Text>
            {conversation.is_muted && (
              <Ionicons name="notifications-off" size={14} color="rgba(255, 255, 255, 0.6)" style={styles.mutedIcon} />
            )}
          </View>
          {conversation.last_message && lastMessageContent ? (
            <Text
              style={[styles.lastMessage, { color: 'rgba(255, 255, 255, 0.7)' }]}
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
                style={[styles.timestamp, { color: 'rgba(255, 255, 255, 0.6)' }]}
              >
                {formattedTime}
              </Text>
            ) : null}
            {conversation.is_pinned && (
              <Ionicons 
                name="pin" 
                size={14} 
                color="rgba(255, 255, 255, 0.6)" 
                style={styles.pinIcon}
              />
            )}
          </View>
          {conversation.unread_count && conversation.unread_count > 0 && getBadgeColor ? (
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
          ) : null}
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
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary.main,
  },
  avatarContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  mutedIcon: {
    marginLeft: 4,
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
  const prevEditMode = 'editMode' in prevProps ? prevProps.editMode : false;
  const nextEditMode = 'editMode' in nextProps ? nextProps.editMode : false;
  const prevIsSelected = 'isSelected' in prevProps ? prevProps.isSelected : false;
  const nextIsSelected = 'isSelected' in nextProps ? nextProps.isSelected : false;

  return (
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.conversation.updated_at === nextProps.conversation.updated_at &&
    prevProps.conversation.unread_count === nextProps.conversation.unread_count &&
    prevProps.conversation.is_pinned === nextProps.conversation.is_pinned &&
    prevProps.conversation.is_muted === nextProps.conversation.is_muted &&
    prevEditMode === nextEditMode &&
    prevIsSelected === nextIsSelected
  );
});

