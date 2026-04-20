/**
 * ChatHeader - Header component for ChatScreen
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { Avatar } from "../../components/Chat/Avatar";

interface ChatHeaderProps {
  conversationName: string;
  avatarUrl?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
  conversationType: "direct" | "group";
  onlineMemberCount?: number;
  groupAvatars?: Array<{ uri?: string; name: string }>;
  onSearchPress?: () => void;
  onInfoPress?: () => void;
  onScheduledPress?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversationName,
  avatarUrl,
  isOnline = false,
  lastSeenAt,
  conversationType,
  onlineMemberCount = 0,
  groupAvatars,
  onSearchPress,
  onInfoPress,
  onScheduledPress,
}) => {
  const navigation = useNavigation();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const groupAvatarNodes =
    conversationType === "group" ? (groupAvatars || []).slice(0, 2) : [];

  return (
    <View style={[styles.container, { backgroundColor: "transparent" }]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Ionicons
          name="arrow-back"
          size={24}
          color={themeColors.text.primary}
        />
      </TouchableOpacity>
      {conversationType === "group" && groupAvatarNodes.length > 0 ? (
        <View style={styles.groupAvatarStack}>
          {groupAvatarNodes.map((a, idx) => (
            <View
              key={`${a.uri ?? a.name}-${idx}`}
              style={[
                styles.groupAvatarItem,
                idx === 1 ? styles.groupAvatarItemTop : null,
              ]}
            >
              <Avatar size={22} uri={a.uri} name={a.name} />
            </View>
          ))}
        </View>
      ) : (
        <Avatar
          size={32}
          uri={avatarUrl}
          name={conversationName}
          showOnlineBadge={conversationType === "direct"}
          isOnline={isOnline}
        />
      )}
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: themeColors.text.primary }]}
          numberOfLines={1}
        >
          {conversationName}
        </Text>
        {conversationType === "direct" && (
          <Text
            style={[
              styles.status,
              {
                color: isOnline
                  ? colors.status.online
                  : themeColors.text.secondary,
              },
            ]}
            numberOfLines={1}
          >
            {isOnline
              ? "En ligne"
              : lastSeenAt
                ? `Vu \u00e0 ${new Date(lastSeenAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                : "Hors ligne"}
          </Text>
        )}
        {conversationType === "group" && onlineMemberCount > 0 && (
          <Text
            style={[styles.status, { color: colors.status.online }]}
            numberOfLines={1}
          >
            {onlineMemberCount === 1
              ? "1 membre en ligne"
              : `${onlineMemberCount} membres en ligne`}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        {onScheduledPress && (
          <TouchableOpacity
            onPress={onScheduledPress}
            style={styles.actionButton}
          >
            <Ionicons
              name="timer-outline"
              size={22}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
        )}
        {onSearchPress && (
          <TouchableOpacity onPress={onSearchPress} style={styles.actionButton}>
            <Ionicons
              name="search"
              size={22}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            onInfoPress?.();
          }}
          style={styles.actionButton}
        >
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={themeColors.text.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  backButton: {
    marginRight: 12,
  },
  groupAvatarStack: {
    width: 32,
    height: 32,
    marginRight: 0,
  },
  groupAvatarItem: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  groupAvatarItemTop: {
    left: 12,
    top: 10,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  status: {
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
});
