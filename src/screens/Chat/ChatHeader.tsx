/**
 * ChatHeader - Header component for ChatScreen
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
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
  typingNames?: string[];
  onTitlePress?: () => void;
  onAudioCallPress?: () => void;
  onVideoCallPress?: () => void;
  callsAvailable?: boolean;
}

const formatTypingLabel = (names: string[]): string => {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} est en train d'écrire…`;
  if (names.length === 2)
    return `${names[0]} et ${names[1]} sont en train d'écrire…`;
  return `${names[0]} et ${names.length - 1} autres sont en train d'écrire…`;
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversationName,
  avatarUrl,
  isOnline = false,
  lastSeenAt,
  conversationType,
  onlineMemberCount = 0,
  groupAvatars,
  typingNames,
  onTitlePress,
  onAudioCallPress,
  onVideoCallPress,
  callsAvailable = true,
}) => {
  const navigation = useNavigation();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const groupAvatarNodes =
    conversationType === "group" ? (groupAvatars || []).slice(0, 2) : [];

  const isTyping = (typingNames?.length ?? 0) > 0;
  const [callMenuOpen, setCallMenuOpen] = useState(false);
  const hasCallActions = !!(onAudioCallPress || onVideoCallPress);

  const handleCallButtonPress = () => {
    if (!hasCallActions) return;
    // When calls are unavailable we still want the parent to surface the
    // toast — fire one of the handlers directly instead of opening a menu
    // that would offer two unusable choices.
    if (!callsAvailable) {
      (onVideoCallPress ?? onAudioCallPress)?.();
      return;
    }
    setCallMenuOpen(true);
  };

  const renderAvatar = () =>
    conversationType === "group" ? (
      avatarUrl ? (
        <Avatar size={36} uri={avatarUrl} name={conversationName} />
      ) : groupAvatarNodes.length > 0 ? (
        <View style={styles.groupAvatarStack}>
          {groupAvatarNodes.map((a, idx) => (
            <View
              key={`${a.uri ?? a.name}-${idx}`}
              style={[
                styles.groupAvatarItem,
                idx === 1 ? styles.groupAvatarItemTop : null,
              ]}
            >
              <Avatar size={24} uri={a.uri} name={a.name} />
            </View>
          ))}
        </View>
      ) : (
        <Avatar size={36} name={conversationName} />
      )
    ) : (
      <Avatar
        size={36}
        uri={avatarUrl}
        name={conversationName}
        showOnlineBadge
        isOnline={isOnline}
      />
    );

  return (
    <BlurView
      intensity={Platform.OS === "ios" ? 60 : 80}
      tint="dark"
      style={styles.container}
    >
      <TouchableOpacity
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            (navigation as any).navigate("ConversationsList");
          }
        }}
        style={styles.backButton}
        // hitSlop pour respecter iOS HIG 44pt
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel="Retour"
      >
        <Ionicons
          name="chevron-back"
          size={26}
          color={themeColors.text.primary}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.titleArea}
        onPress={onTitlePress}
        activeOpacity={onTitlePress ? 0.6 : 1}
        disabled={!onTitlePress}
        accessibilityRole="button"
        accessibilityLabel={`Détails de ${conversationName}`}
      >
        {renderAvatar()}
        <View style={styles.info}>
          <Text
            style={[styles.name, { color: themeColors.text.primary }]}
            numberOfLines={1}
          >
            {conversationName}
          </Text>
          {isTyping ? (
            <Text
              style={[styles.status, { color: colors.status.online }]}
              numberOfLines={1}
            >
              {formatTypingLabel(typingNames!)}
            </Text>
          ) : conversationType === "direct" && (isOnline || lastSeenAt) ? (
            // The avatar's coloured dot already conveys online/offline state,
            // so we only render text when it adds information beyond the dot:
            // "En ligne" (qualitative reinforcement) or a "Vu à HH:MM" timestamp.
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
                : `Vu à ${new Date(lastSeenAt!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
            </Text>
          ) : onlineMemberCount > 0 ? (
            <Text
              style={[styles.status, { color: colors.status.online }]}
              numberOfLines={1}
            >
              {onlineMemberCount === 1
                ? "1 membre en ligne"
                : `${onlineMemberCount} membres en ligne`}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
      <View style={styles.actions}>
        {hasCallActions && (
          <TouchableOpacity
            onPress={handleCallButtonPress}
            style={[
              styles.actionButton,
              !callsAvailable && styles.actionButtonDisabled,
            ]}
            // hitSlop pour respecter iOS HIG 44pt
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Lancer un appel"
          >
            <Ionicons
              name="videocam-outline"
              size={22}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
        )}
      </View>
      <Modal
        visible={callMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCallMenuOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCallMenuOpen(false)}>
          <View style={styles.callMenuBackdrop}>
            <TouchableWithoutFeedback>
              <BlurView
                intensity={Platform.OS === "ios" ? 60 : 80}
                tint="dark"
                style={styles.callMenu}
              >
                {onAudioCallPress && (
                  <TouchableOpacity
                    style={styles.callMenuItem}
                    onPress={() => {
                      setCallMenuOpen(false);
                      onAudioCallPress();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Appel audio"
                  >
                    <Ionicons
                      name="call-outline"
                      size={20}
                      color={themeColors.text.primary}
                      style={styles.callMenuIcon}
                    />
                    <Text
                      style={[
                        styles.callMenuLabel,
                        { color: themeColors.text.primary },
                      ]}
                    >
                      Appel audio
                    </Text>
                  </TouchableOpacity>
                )}
                {onVideoCallPress && (
                  <TouchableOpacity
                    style={styles.callMenuItem}
                    onPress={() => {
                      setCallMenuOpen(false);
                      onVideoCallPress();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Appel vidéo"
                  >
                    <Ionicons
                      name="videocam-outline"
                      size={20}
                      color={themeColors.text.primary}
                      style={styles.callMenuIcon}
                    />
                    <Text
                      style={[
                        styles.callMenuLabel,
                        { color: themeColors.text.primary },
                      ]}
                    >
                      Appel vidéo
                    </Text>
                  </TouchableOpacity>
                )}
              </BlurView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </BlurView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor:
      Platform.OS === "ios"
        ? "rgba(20, 25, 50, 0.35)"
        : "rgba(20, 25, 50, 0.7)",
  },
  backButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginRight: 4,
  },
  titleArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: 8,
  },
  groupAvatarStack: {
    width: 36,
    height: 36,
  },
  groupAvatarItem: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  groupAvatarItemTop: {
    left: 12,
    top: 12,
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
  },
  actionButton: {
    padding: 8,
    marginLeft: 2,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  callMenuBackdrop: {
    flex: 1,
    alignItems: "flex-end",
    // Push the menu just below where the topbar typically ends. The
    // topbar height varies with the safe-area inset, so we use a value
    // that works on phones with and without a notch — the user can still
    // tap anywhere outside to dismiss.
    paddingTop: Platform.OS === "ios" ? 96 : 64,
    paddingRight: 8,
  },
  callMenu: {
    minWidth: 180,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor:
      Platform.OS === "ios"
        ? "rgba(20, 25, 50, 0.55)"
        : "rgba(20, 25, 50, 0.85)",
  },
  callMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  callMenuIcon: {
    marginRight: 12,
  },
  callMenuLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
});
