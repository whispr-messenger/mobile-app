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
  editMode?: boolean;
  isSelected?: boolean;
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
  editMode = false,
  isSelected = false,
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const trans = dragX.interpolate({
      inputRange: [0, 50, 100, 101],
      outputRange: [-20, 0, 0, 1],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightActions}>
        {onArchive && (
          <Animated.View style={{ transform: [{ translateX: trans }] }}>
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
          </Animated.View>
        )}
        {onMute && (
          <Animated.View style={{ transform: [{ translateX: trans }] }}>
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
          </Animated.View>
        )}
        {onDelete && (
          <Animated.View style={{ transform: [{ translateX: trans }] }}>
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
          </Animated.View>
        )}
      </View>
    );
  };

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const trans = dragX.interpolate({
      inputRange: [-101, -100, -50, 0],
      outputRange: [-1, 0, 0, 20],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.leftActions}>
        {onPin && (
          <Animated.View style={{ transform: [{ translateX: trans }] }}>
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
          </Animated.View>
        )}
        {onUnread && (
          <Animated.View style={{ transform: [{ translateX: trans }] }}>
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
          </Animated.View>
        )}
      </View>
    );
  };

  if (editMode) {
    return (
      <ConversationItem
        conversation={conversation}
        onPress={onPress}
        index={index}
        editMode={editMode}
        isSelected={isSelected}
      />
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      rightThreshold={40}
      leftThreshold={40}
      friction={2}
      overshootRight={false}
      overshootLeft={false}
    >
      <ConversationItem
        conversation={conversation}
        onPress={onPress}
        index={index}
        editMode={editMode}
        isSelected={isSelected}
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
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  archiveButton: {
    backgroundColor: '#5E5CE6',
  },
  muteButton: {
    backgroundColor: '#5E5CE6',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  pinButton: {
    backgroundColor: '#F04882',
  },
  unreadButton: {
    backgroundColor: '#4A90E2',
  },
  actionText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

