/**
 * SwipeableConversationItem - Conversation item with swipe actions
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Conversation } from '../../types/messaging';
import { colors } from '../../theme/colors';
import ConversationItem from './ConversationItem';

interface SwipeableConversationItemProps {
  conversation: Conversation;
  onPress: (conversationId: string) => void;
  onDelete?: (conversationId: string) => void;
  onMute?: (conversationId: string) => void;
  onUnread?: (conversationId: string) => void;
  onArchive?: (conversationId: string) => void;
  onPin?: (conversationId: string) => void;
  index?: number;
}

export const SwipeableConversationItem: React.FC<SwipeableConversationItemProps> = ({
  conversation,
  onPress,
  onDelete,
  onMute,
  onUnread,
  onArchive,
  onPin,
  index = 0,
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightActions}>
        {onUnread && (
          <TouchableOpacity
            style={[styles.actionButton, styles.unreadButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onUnread(conversation.id);
              swipeableRef.current?.close();
            }}
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.text.light} />
            <Text style={styles.actionText}>Unread</Text>
          </TouchableOpacity>
        )}
        {onMute && (
          <TouchableOpacity
            style={[styles.actionButton, styles.muteButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onMute(conversation.id);
              swipeableRef.current?.close();
            }}
          >
            <Ionicons name="notifications-off-outline" size={20} color={colors.text.light} />
            <Text style={styles.actionText}>Mute</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onDelete(conversation.id);
              swipeableRef.current?.close();
            }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.text.light} />
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    return (
      <View style={styles.leftActions}>
        {onPin && (
          <TouchableOpacity
            style={[styles.actionButton, styles.pinButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onPin(conversation.id);
              swipeableRef.current?.close();
            }}
          >
            <Ionicons name="pin-outline" size={20} color={colors.text.light} />
            <Text style={styles.actionText}>Pin</Text>
          </TouchableOpacity>
        )}
        {onArchive && (
          <TouchableOpacity
            style={[styles.actionButton, styles.archiveButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onArchive(conversation.id);
              swipeableRef.current?.close();
            }}
          >
            <Ionicons name="archive-outline" size={20} color={colors.text.light} />
            <Text style={styles.actionText}>Archive</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      rightThreshold={40}
      leftThreshold={40}
      friction={2}
    >
      <ConversationItem
        conversation={conversation}
        onPress={onPress}
        index={index}
      />
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 16,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 16,
  },
  actionButton: {
    width: 80,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  muteButton: {
    backgroundColor: colors.palette.violet,
  },
  deleteButton: {
    backgroundColor: colors.primary.main,
  },
  unreadButton: {
    backgroundColor: colors.palette.violet,
  },
  archiveButton: {
    backgroundColor: colors.palette.violet,
  },
  pinButton: {
    backgroundColor: colors.primary.main,
  },
  actionText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

