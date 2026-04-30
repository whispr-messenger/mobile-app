/**
 * SwipeableConversationItem - Conversation item with swipe actions
 */

import React, { useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Conversation } from "../../types/messaging";
import { colors } from "../../theme/colors";
import { useConversationsStore } from "../../store/conversationsStore";
import ConversationItem from "./ConversationItem";

const BUTTON_SIZE = 52;
const BUTTON_GAP = 12;

interface SwipeableConversationItemProps {
  conversation: Conversation;
  onPress: (conversationId: string) => void;
  onDelete?: (conversationId: string) => void;
  onMute?: (conversationId: string) => void;
  onToggleRead?: (conversationId: string, isCurrentlyUnread: boolean) => void;
  onArchive?: (conversationId: string) => void;
  onPin?: (conversationId: string) => void;
  index?: number;
  editMode?: boolean;
  isSelected?: boolean;
}

export const SwipeableConversationItem: React.FC<
  SwipeableConversationItemProps
> = ({
  conversation,
  onPress,
  onDelete,
  onMute,
  onToggleRead,
  onArchive,
  onPin,
  index = 0,
  editMode = false,
  isSelected = false,
}) => {
  const swipeableRef = useRef<Swipeable>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const isManuallyUnread = useConversationsStore((s) =>
    s.manuallyUnreadIds.has(conversation.id),
  );
  const isUnread = (conversation.unread_count ?? 0) > 0 || isManuallyUnread;

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    if (!isSwiping) return <View />;
    const actionCount = [onArchive, onMute, onDelete].filter(Boolean).length;
    const totalWidth = actionCount * (BUTTON_SIZE + BUTTON_GAP) + BUTTON_GAP;
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1],
      extrapolate: "clamp",
    });

    return (
      <View style={[styles.rightActions, { width: totalWidth }]}>
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
              <Ionicons
                name="archive-outline"
                size={24}
                color={colors.text.light}
              />
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
              <Ionicons
                name="notifications-off-outline"
                size={24}
                color={colors.text.light}
              />
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
              <Ionicons
                name="trash-outline"
                size={24}
                color={colors.text.light}
              />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    );
  };

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    if (!isSwiping) return <View />;
    const actionCount = [onPin, onToggleRead].filter(Boolean).length;
    const totalWidth = actionCount * (BUTTON_SIZE + BUTTON_GAP) + BUTTON_GAP;
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1],
      extrapolate: "clamp",
    });

    return (
      <View style={[styles.leftActions, { width: totalWidth }]}>
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
              <Ionicons
                name="pin-outline"
                size={24}
                color={colors.text.light}
              />
            </TouchableOpacity>
          </Animated.View>
        )}
        {onToggleRead && (
          <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity
              style={[styles.actionButton, styles.unreadButton]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onToggleRead(conversation.id, isUnread);
                swipeableRef.current?.close();
              }}
            >
              <Ionicons
                name={isUnread ? "mail-open-outline" : "mail-unread-outline"}
                size={24}
                color={colors.text.light}
              />
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
        onBegan={() => setIsSwiping(true)}
        onSwipeableWillOpen={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onSwipeableClose={() => setIsSwiping(false)}
      >
        <View
          style={[
            styles.contentWrapper,
            isSwiping && styles.contentWrapperSwiping,
          ]}
        >
          <ConversationItem
            conversation={conversation}
            onPress={onPress}
            index={index}
            editMode={editMode}
            isSelected={isSelected}
          />
        </View>
      </Swipeable>
    </View>
  );
};

const styles = StyleSheet.create({
  swipeableContainer: {},
  contentWrapper: {
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  contentWrapperSwiping: {
    backgroundColor: "#1A1F3A",
    borderRadius: 16,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: BUTTON_GAP,
    gap: BUTTON_GAP,
    backgroundColor: "transparent",
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: BUTTON_GAP,
    gap: BUTTON_GAP,
    backgroundColor: "transparent",
  },
  actionButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  archiveButton: {
    backgroundColor: "#5B66B8",
  },
  muteButton: {
    backgroundColor: "#5B66B8",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
  },
  pinButton: {
    backgroundColor: "#5B66B8",
  },
  unreadButton: {
    backgroundColor: "#5B66B8",
  },
});
