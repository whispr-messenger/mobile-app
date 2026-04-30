/**
 * ConversationItem - Individual conversation list item
 */

import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Animated from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Conversation } from "../../types/messaging";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { Avatar } from "./Avatar";
import { Ionicons } from "@expo/vector-icons";
import { usePresenceStore } from "../../store/presenceStore";
import { useConversationsStore } from "../../store/conversationsStore";
import { useAuth } from "../../context/AuthContext";
import { getConversationDisplayName } from "../../utils";
import { messagingAPI } from "../../services/messaging/api";

const EMPTY_GROUP_AVATARS: Array<{ uri?: string; name: string }> = [];

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
  const { userId: currentUserId } = useAuth();
  const onlineUserIds = usePresenceStore((s) => s.onlineUserIds);

  // For direct conversations, check if the other user is online
  const otherUserId =
    conversation.type === "direct"
      ? conversation.member_user_ids?.find((id: string) => id !== currentUserId)
      : undefined;
  const isOtherOnline = otherUserId ? onlineUserIds.has(otherUserId) : false;

  const groupAvatars = useConversationsStore(
    (s) => s.groupAvatars[conversation.id] ?? EMPTY_GROUP_AVATARS,
  );
  const setGroupAvatars = useConversationsStore((s) => s.setGroupAvatars);
  const hasCachedAvatars = useConversationsStore(
    (s) => conversation.id in s.groupAvatars,
  );
  const applyConversationUpdate = useConversationsStore(
    (s) => s.applyConversationUpdate,
  );

  const groupAvatarUrl = useMemo(() => {
    if (conversation.type !== "group") return undefined;
    const meta = (conversation.metadata ?? {}) as Record<string, any>;
    return (
      conversation.avatar_url ||
      meta.avatar_url ||
      meta.group_avatar_url ||
      meta.group_icon_url ||
      meta.icon_url ||
      meta.photo_url ||
      meta.picture_url ||
      meta.image_url
    );
  }, [conversation]);

  const triedGroupAvatarFetchRef = React.useRef(false);

  React.useEffect(() => {
    if (conversation.type !== "group") return;
    if (groupAvatarUrl) return;
    if (triedGroupAvatarFetchRef.current) return;
    triedGroupAvatarFetchRef.current = true;

    let cancelled = false;
    messagingAPI
      .getConversation(conversation.id)
      .then((detail) => {
        if (cancelled || !detail) return;
        const meta = (detail.metadata ?? {}) as Record<string, any>;
        const resolved =
          detail.avatar_url ||
          meta.avatar_url ||
          meta.group_avatar_url ||
          meta.group_icon_url ||
          meta.icon_url ||
          meta.photo_url ||
          meta.picture_url ||
          meta.image_url;
        if (!resolved) return;
        applyConversationUpdate({ ...detail, avatar_url: resolved });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    applyConversationUpdate,
    conversation.id,
    conversation.type,
    groupAvatarUrl,
  ]);

  React.useEffect(() => {
    if (conversation.type !== "group") return;
    if (hasCachedAvatars) return;
    let cancelled = false;
    messagingAPI
      .getConversationMembers(conversation.id)
      .then((members) => {
        if (cancelled) return;
        const avatars = members
          .filter((m) => m.id && m.id !== currentUserId)
          .slice(0, 2)
          .map((m) => ({
            uri: m.avatar_url,
            name: m.display_name || m.username || "Utilisateur",
          }));
        setGroupAvatars(conversation.id, avatars);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    conversation.id,
    conversation.type,
    currentUserId,
    hasCachedAvatars,
    setGroupAvatars,
  ]);

  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    const delay = index * 50;
    const timeout = setTimeout(() => {
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 150,
      });
      opacity.value = withTiming(1, { duration: 300 });
    }, delay);
    return () => clearTimeout(timeout);
    // Mount-only animation: keep deps empty so re-ordering (e.g. when the
    // search query filters the list) doesn't replay it and create visual
    // artefacts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
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
      return "Maintenant";
    }

    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffMinutes < 1) {
      return "Maintenant";
    }

    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    }

    if (diffDays === 0) {
      return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    if (diffDays < 7) {
      const dayName = date.toLocaleDateString("fr-FR", { weekday: "short" });
      return dayName || "";
    }

    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
  }, [
    conversation.last_message?.sent_at,
    conversation.updated_at,
    conversation.created_at,
  ]);

  const getBadgeColor = useMemo(() => {
    const count = conversation.unread_count || 0;
    if (count === 0) return null;
    if (count < 10) return colors.secondary.main; // Purple/blue
    if (count < 50) return colors.primary.main; // Orange
    return colors.ui.error; // Red for high counts
  }, [conversation.unread_count]);

  // Media-aware last message preview
  const getLastMessagePreview = () => {
    const msg = conversation.last_message;
    if (!msg) return "";
    if (
      msg.content === "Photo" ||
      (msg.message_type === "media" && msg.content?.startsWith("Photo"))
    )
      return "Photo";
    if (
      msg.content === "Vidéo" ||
      (msg.message_type === "media" && msg.content?.startsWith("Vidéo"))
    )
      return "Vidéo";
    if (
      msg.content === "Message vocal" ||
      (msg.message_type === "media" && msg.content?.startsWith("Message vocal"))
    )
      return "Message vocal";
    if (
      msg.content === "Fichier" ||
      (msg.message_type === "media" && msg.content?.startsWith("Fichier"))
    )
      return "Fichier";

    return msg.content || "";
  };

  const lastMessageContent = getLastMessagePreview();
  const displayName = getConversationDisplayName(conversation);

  const isEditMode = editMode === true;
  const isItemSelected = isSelected === true;

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[
          styles.container,
          {
            backgroundColor: isItemSelected
              ? "rgba(255, 255, 255, 0.1)"
              : "transparent",
            borderBottomColor: "rgba(255, 255, 255, 0.1)",
            overflow: "hidden",
          },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress(conversation.id);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.content}>
          {isEditMode && (
            <View style={styles.checkboxContainer}>
              <View
                style={[
                  styles.checkbox,
                  isItemSelected && styles.checkboxSelected,
                  {
                    borderColor: isItemSelected
                      ? colors.primary.main
                      : "rgba(255, 255, 255, 0.5)",
                  },
                ]}
              >
                {isItemSelected && (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={colors.text.light}
                  />
                )}
              </View>
            </View>
          )}
          <View style={styles.avatarContainer}>
            {conversation.type === "group" &&
            !groupAvatarUrl &&
            groupAvatars.length > 0 ? (
              <View style={styles.groupAvatarStack}>
                {groupAvatars.map((a, idx) => (
                  <View
                    key={`${a.uri ?? a.name}-${idx}`}
                    style={[
                      styles.groupAvatarItem,
                      idx === 1 ? styles.groupAvatarItemTop : null,
                    ]}
                  >
                    <Avatar size={30} uri={a.uri} name={a.name} />
                  </View>
                ))}
              </View>
            ) : (
              <Avatar
                size={48}
                uri={
                  conversation.type === "group"
                    ? groupAvatarUrl
                    : conversation.avatar_url
                }
                name={displayName}
                showOnlineBadge={conversation.type === "direct"}
                isOnline={isOtherOnline}
              />
            )}
          </View>
          <View style={styles.textContainer}>
            <View style={styles.nameRow}>
              {conversation.type === "group" && (
                <Ionicons
                  name="people"
                  size={16}
                  color="rgba(255, 255, 255, 0.7)"
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                style={[styles.name, { color: "#FFFFFF" }]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {conversation.is_muted && (
                <Ionicons
                  name="notifications-off"
                  size={14}
                  color="rgba(255, 255, 255, 0.6)"
                  style={styles.mutedIcon}
                />
              )}
              {formattedTime ? (
                <Text
                  style={[
                    styles.timestamp,
                    { color: "rgba(255, 255, 255, 0.6)" },
                  ]}
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
            <View style={styles.lastMessageRow}>
              {lastMessageContent ? (
                <Text
                  style={[
                    styles.lastMessage,
                    { color: "rgba(255, 255, 255, 0.7)" },
                  ]}
                  numberOfLines={1}
                >
                  {lastMessageContent}
                </Text>
              ) : (
                <Text
                  style={[
                    styles.lastMessage,
                    { color: "rgba(255, 255, 255, 0.4)", fontStyle: "italic" },
                  ]}
                  numberOfLines={1}
                >
                  Pas encore de messages
                </Text>
              )}
              {conversation.unread_count ? (
                conversation.unread_count > 0 && getBadgeColor ? (
                  <View
                    style={[
                      styles.unreadBadge,
                      { backgroundColor: getBadgeColor },
                    ]}
                  >
                    <Text style={styles.unreadText}>
                      {conversation.unread_count > 99
                        ? "99+"
                        : String(conversation.unread_count)}
                    </Text>
                  </View>
                ) : null
              ) : null}
            </View>
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
    flexDirection: "row",
    alignItems: "center",
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
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: colors.primary.main,
  },
  avatarContainer: {
    marginRight: 12,
  },
  groupAvatarStack: {
    width: 48,
    height: 48,
  },
  groupAvatarItem: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  groupAvatarItemTop: {
    left: 16,
    top: 16,
  },
  textContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  mutedIcon: {
    marginLeft: 4,
  },
  lastMessageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    marginLeft: "auto",
    paddingLeft: 8,
  },
  pinIcon: {
    marginLeft: 4,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: "600",
  },
});

// Memoize with custom comparator
export default memo(ConversationItem, (prevProps, nextProps) => {
  const prevEditMode = "editMode" in prevProps ? prevProps.editMode : false;
  const nextEditMode = "editMode" in nextProps ? nextProps.editMode : false;
  const prevIsSelected =
    "isSelected" in prevProps ? prevProps.isSelected : false;
  const nextIsSelected =
    "isSelected" in nextProps ? nextProps.isSelected : false;

  return (
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.conversation.updated_at === nextProps.conversation.updated_at &&
    prevProps.conversation.unread_count ===
      nextProps.conversation.unread_count &&
    prevProps.conversation.is_pinned === nextProps.conversation.is_pinned &&
    prevProps.conversation.is_muted === nextProps.conversation.is_muted &&
    prevProps.conversation.display_name ===
      nextProps.conversation.display_name &&
    prevProps.conversation.avatar_url === nextProps.conversation.avatar_url &&
    prevEditMode === nextEditMode &&
    prevIsSelected === nextIsSelected
  );
});
