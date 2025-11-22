/**
 * SwipeableConversationItem - Conversation item with swipe actions
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Conversation } from '../../types/messaging';
import { colors } from '../../theme/colors';
import ConversationItem from './ConversationItem';

const SCREEN_WIDTH = Dimensions.get('window').width;

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
    const actionCount = [onArchive, onMute, onDelete].filter(Boolean).length;
    const totalWidth = actionCount * 88;
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1],
      extrapolate: 'clamp',
    });
    
    return (
      <View style={[styles.rightActions, { width: Math.max(totalWidth, SCREEN_WIDTH) }]}>
        {onArchive && (
          <Animated.View style={{ transform: [{ scale }] }}>
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
          <Animated.View style={{ transform: [{ scale }] }}>
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
          <Animated.View style={{ transform: [{ scale }] }}>
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
    const actionCount = [onPin, onUnread].filter(Boolean).length;
    const totalWidth = actionCount * 88;
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1],
      extrapolate: 'clamp',
    });
    
    return (
      <View style={[styles.leftActions, { width: Math.max(totalWidth, SCREEN_WIDTH) }]}>
        {onPin && (
          <Animated.View style={{ transform: [{ scale }] }}>
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
          <Animated.View style={{ transform: [{ scale }] }}>
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
    <View style={styles.swipeableContainer}>
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
        <LinearGradient
          colors={colors.background.gradient.app}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.contentWrapper}
        >
          <ConversationItem
            conversation={conversation}
            onPress={onPress}
            index={index}
            editMode={editMode}
            isSelected={isSelected}
          />
        </LinearGradient>
      </Swipeable>
  );
};

const styles = StyleSheet.create({
  contentWrapper: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    height: 88,
    minWidth: SCREEN_WIDTH,
    backgroundColor: 'transparent',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    height: 88,
    minWidth: SCREEN_WIDTH,
    backgroundColor: 'transparent',
  },
  actionButton: {
    width: 88,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  archiveButton: {
    backgroundColor: '#39437C',
  },
  muteButton: {
    backgroundColor: '#39437C',
  },
  deleteButton: {
    backgroundColor: '#FE7A5C',
  },
  pinButton: {
    backgroundColor: '#39437C',
  },
  unreadButton: {
    backgroundColor: '#39437C',
  },
  actionText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

