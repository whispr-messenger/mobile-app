/**
 * MessageBubble - Individual message display component
 */

import React, { memo, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Animated from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { MessageWithRelations } from "../../types/messaging";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { DeliveryStatus } from "./DeliveryStatus";
import { ReactionBar } from "./ReactionBar";
import { ReplyPreview } from "./ReplyPreview";
import { ReactionPicker } from "./ReactionPicker";
import { MediaMessage } from "./MediaMessage";
import { AudioMessage } from "./AudioMessage";
import { FormattedText } from "../../utils/textFormatter";
import { getApiBaseUrl } from "../../services/apiBase";

/** Resolve a media URL — prepend the API base when it is a relative path */
function resolveMediaUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("file://") || url.startsWith("data:")) {
    return url;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // URLs pointing to the media service blob/thumbnail endpoints are always valid
    if (url.includes("/media/v1/") && (url.includes("/blob") || url.includes("/thumbnail"))) {
      return url;
    }
    // Other absolute URLs (e.g. expired presigned S3/MinIO URLs) are returned as-is;
    // the caller should prefer blob-endpoint URLs when available.
    return url;
  }
  // Relative path from the API — prepend base URL
  return `${getApiBaseUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
}

interface MessageBubbleProps {
  message: MessageWithRelations;
  isSent: boolean;
  currentUserId: string;
  senderName?: string;
  onReactionPress?: (messageId: string, emoji: string) => void;
  /** Appui long sur une pastille de réaction : afficher les réacteurs */
  onReactionDetailsPress?: (messageId: string, emoji: string) => void;
  onReplyPress?: (messageId: string) => void;
  onLongPress?: () => void;
  isHighlighted?: boolean;
  searchQuery?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSent,
  currentUserId,
  senderName,
  onReactionPress,
  onReactionDetailsPress,
  onReplyPress,
  onLongPress,
  isHighlighted = false,
  searchQuery,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Safety check — also allow media messages that carry metadata (no attachments yet)
  const hasMetadataMedia =
    message?.message_type === "media" &&
    message?.metadata &&
    ((message.metadata as any).media_url || (message.metadata as any).media_id);
  if (
    !message ||
    (!message.content &&
      !message.is_deleted &&
      !hasMetadataMedia &&
      (!message.attachments || message.attachments.length === 0))
  ) {
    return null;
  }

  // Check if message has media attachments.
  // When a message arrives via WebSocket it may only carry metadata (no attachments array),
  // so we synthesize a virtual attachment from message.metadata to display the preview.
  const hasExplicitAttachments =
    message.attachments && message.attachments.length > 0;

  const metadataAttachment = (() => {
    if (hasExplicitAttachments || message.message_type !== "media" || !message.metadata) {
      return null;
    }
    const meta = message.metadata as any;
    if (!meta.media_url && !meta.media_id) return null;

    // Prefer media-service blob/thumbnail endpoints when a media_id is available
    const mediaId = meta.media_id;
    const apiBase = getApiBaseUrl();
    const blobUrl = mediaId ? `${apiBase}/media/v1/${mediaId}/blob` : meta.media_url;
    const thumbUrl = mediaId
      ? `${apiBase}/media/v1/${mediaId}/thumbnail`
      : meta.thumbnail_url || meta.media_url;

    return {
      id: `synth-${message.id}`,
      message_id: message.id,
      media_id: mediaId || message.id,
      media_type: meta.media_type || ("image" as "image" | "video" | "file" | "audio"),
      metadata: {
        filename: meta.filename,
        size: meta.size,
        mime_type: meta.mime_type,
        media_url: blobUrl,
        thumbnail_url: thumbUrl,
        duration: meta.duration,
      },
      created_at: message.sent_at,
    };
  })();

  const hasMedia = hasExplicitAttachments || metadataAttachment !== null;
  const firstAttachment = hasExplicitAttachments
    ? message.attachments![0]
    : metadataAttachment;

  // For media messages, only show content if it's not the default placeholder text
  const isDefaultMediaText =
    hasMedia &&
    message.content &&
    ["Photo", "Vidéo", "Fichier", "Message vocal"].includes(message.content);

  const displayContent =
    message.is_deleted && message.delete_for_everyone
      ? "[Message supprimé]"
      : hasMedia && isDefaultMediaText
        ? "" // Don't show default text for media without caption
        : message.content || "";

  const handleLongPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (onLongPress) {
      onLongPress();
    } else {
      setShowReactionPicker(true);
    }
  };

  const handleContextMenu = useCallback(
    (e: any) => {
      if (Platform.OS === "web") {
        e.preventDefault();
        handleLongPress();
      }
    },
    [onLongPress],
  );

  const handleReactionSelect = (emoji: string) => {
    if (onReactionPress) {
      onReactionPress(message.id, emoji);
      setShowReactionPicker(false);
    }
  };

  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Animate on mount
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(1, { duration: 300 });

    if (isSent) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [scale, opacity, isSent]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const isForwarded = message.metadata?.forwarded === true;
  const isFailed = message.status === "failed";

  const renderBubbleContent = () => {
    // Failed message: show error overlay with reason
    if (isFailed && isSent) {
      return (
        <View
          style={[
            styles.sentBubble,
            {
              backgroundColor: "rgba(240, 72, 72, 0.15)",
              borderWidth: 1,
              borderColor: "rgba(240, 72, 72, 0.4)",
            },
          ]}
        >
          {hasMedia && firstAttachment && firstAttachment.metadata ? (
            <MediaMessage
              uri={resolveMediaUrl(
                firstAttachment.metadata.media_url ||
                  firstAttachment.metadata.thumbnail_url,
              )}
              type={firstAttachment.media_type as any}
              filename={firstAttachment.metadata.filename}
              size={firstAttachment.metadata.size}
              thumbnailUri={resolveMediaUrl(
                firstAttachment.metadata.thumbnail_url,
              )}
            />
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 4,
              paddingTop: hasMedia ? 6 : 0,
            }}
          >
            <Text style={{ fontSize: 14, marginRight: 6 }}>⚠️</Text>
            <Text style={{ color: "#F04848", fontSize: 13, flex: 1 }}>
              {message.content || "Échec de l'envoi"}
            </Text>
          </View>
          <View style={styles.footer}>
            <Text style={styles.timestamp}>
              {new Date(message.sent_at).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <DeliveryStatus status="failed" />
          </View>
        </View>
      );
    }

    if (isSent) {
      return (
        <LinearGradient
          colors={["#FFB07B", "#F86F71", "#F04882"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sentBubble}
        >
          {isForwarded ? (
            <Text style={styles.forwardedLabel}>Transféré</Text>
          ) : null}
          {message.reply_to ? (
            <ReplyPreview
              replyTo={message.reply_to}
              currentUserId={currentUserId}
              onPress={() => onReplyPress?.(message.reply_to!.id)}
            />
          ) : null}
          {hasMedia && firstAttachment && firstAttachment.metadata ? (
            <>
              {firstAttachment.media_type === "audio" ? (
                <AudioMessage
                  uri={resolveMediaUrl(firstAttachment.metadata.media_url)}
                  duration={firstAttachment.metadata.duration}
                  isSent={true}
                />
              ) : (
                <MediaMessage
                  uri={resolveMediaUrl(
                    firstAttachment.metadata.media_url ||
                      firstAttachment.metadata.thumbnail_url,
                  )}
                  type={firstAttachment.media_type}
                  filename={firstAttachment.metadata.filename}
                  size={firstAttachment.metadata.size}
                  thumbnailUri={resolveMediaUrl(
                    firstAttachment.metadata.thumbnail_url,
                  )}
                />
              )}
            </>
          ) : null}
          {displayContent ? (
            message.is_deleted && message.delete_for_everyone ? (
              <Text style={[styles.sentText, styles.deletedText]}>
                {displayContent}
              </Text>
            ) : (
              <FormattedText
                text={displayContent}
                style={[styles.sentText, { color: colors.text.light }]}
                boldStyle={{ color: colors.text.light }}
                italicStyle={{ color: colors.text.light }}
                codeStyle={{
                  color: colors.text.light,
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                }}
              />
            )
          ) : null}
          <View style={styles.footer}>
            <Text style={styles.timestamp}>
              {new Date(message.sent_at).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {message.edited_at ? (
              <Text
                style={[
                  styles.editedLabel,
                  { color: themeColors.text.tertiary },
                ]}
              >
                {" "}
                édité
              </Text>
            ) : null}
            {message.status ? <DeliveryStatus status={message.status} /> : null}
          </View>
        </LinearGradient>
      );
    }

    return (
      <View
        style={[
          styles.receivedBubble,
          { backgroundColor: "rgba(26, 31, 58, 0.6)" }, // Dark card with transparency
        ]}
      >
        {senderName ? (
          <Text style={styles.senderNameLabel}>{senderName}</Text>
        ) : null}
        {isForwarded ? (
          <Text
            style={[
              styles.forwardedLabel,
              { color: themeColors.text.tertiary },
            ]}
          >
            Transféré
          </Text>
        ) : null}
        {message.reply_to ? (
          <ReplyPreview
            replyTo={message.reply_to}
            currentUserId={currentUserId}
            onPress={() => onReplyPress?.(message.reply_to!.id)}
          />
        ) : null}
        {hasMedia && firstAttachment && firstAttachment.metadata ? (
          <>
            {firstAttachment.media_type === "audio" ? (
              <AudioMessage
                uri={resolveMediaUrl(firstAttachment.metadata.media_url)}
                duration={firstAttachment.metadata.duration}
                isSent={false}
              />
            ) : (
              <MediaMessage
                uri={resolveMediaUrl(
                  firstAttachment.metadata.media_url ||
                    firstAttachment.metadata.thumbnail_url,
                )}
                type={firstAttachment.media_type as "image" | "video" | "file"}
                filename={firstAttachment.metadata.filename}
                size={firstAttachment.metadata.size}
                thumbnailUri={resolveMediaUrl(
                  firstAttachment.metadata.thumbnail_url,
                )}
              />
            )}
          </>
        ) : null}
        {displayContent ? (
          message.is_deleted && message.delete_for_everyone ? (
            <Text
              style={[
                styles.receivedText,
                { color: themeColors.text.primary },
                styles.deletedText,
              ]}
            >
              {displayContent}
            </Text>
          ) : (
            <FormattedText
              text={displayContent}
              style={[styles.receivedText, { color: themeColors.text.primary }]}
              boldStyle={{ color: themeColors.text.primary }}
              italicStyle={{ color: themeColors.text.primary }}
              codeStyle={{
                color: themeColors.text.primary,
                backgroundColor: "rgba(255, 255, 255, 0.1)",
              }}
              searchQuery={searchQuery}
              highlightStyle={{
                backgroundColor: colors.primary.main,
                color: colors.text.light,
              }}
            />
          )
        ) : null}
        <View style={styles.footer}>
          <Text
            style={[styles.timestamp, { color: themeColors.text.tertiary }]}
          >
            {new Date(message.sent_at).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          {message.edited_at ? (
            <Text
              style={[styles.editedLabel, { color: themeColors.text.tertiary }]}
            >
              {" "}
              édité
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <>
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={300}
        {...(Platform.OS === "web"
          ? ({ onContextMenu: handleContextMenu } as any)
          : {})}
      >
        <Animated.View
          style={[
            isSent ? styles.sentContainer : styles.receivedContainer,
            animatedStyle,
          ]}
        >
          {renderBubbleContent()}
          {message.reactions && message.reactions.length > 0 ? (
            <ReactionBar
              reactions={message.reactions}
              currentUserId={currentUserId}
              onReactionPress={handleReactionSelect}
              onReactionLongPress={
                onReactionDetailsPress
                  ? (emoji) => onReactionDetailsPress(message.id, emoji)
                  : undefined
              }
            />
          ) : null}
        </Animated.View>
      </Pressable>
      <ReactionPicker
        visible={showReactionPicker}
        onClose={() => setShowReactionPicker(false)}
        onReactionSelect={handleReactionSelect}
      />
    </>
  );
};

const styles = StyleSheet.create({
  sentContainer: {
    alignItems: "flex-end",
    marginVertical: 4,
    marginHorizontal: 16,
  },
  sentBubble: {
    maxWidth: "75%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    overflow: "visible", // Allow progress bar to be visible
  },
  sentText: {
    color: colors.text.light,
    fontSize: 15,
    marginBottom: 4,
  },
  receivedContainer: {
    alignItems: "flex-start",
    marginVertical: 4,
    marginHorizontal: 16,
  },
  receivedBubble: {
    maxWidth: "75%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  receivedText: {
    fontSize: 15,
    marginBottom: 4,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginRight: 4,
  },
  editedLabel: {
    fontSize: 11,
    fontStyle: "italic",
    marginRight: 4,
  },
  deletedText: {
    fontStyle: "italic",
    opacity: 0.7,
  },
  forwardedLabel: {
    fontSize: 11,
    fontStyle: "italic",
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 4,
  },
  senderNameLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary.main,
    marginBottom: 4,
  },
  highlighted: {
    backgroundColor: "rgba(254, 122, 92, 0.2)",
    borderRadius: 8,
    padding: 2,
  },
});

export default memo(MessageBubble, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.edited_at === nextProps.message.edited_at &&
    prevProps.message.is_deleted === nextProps.message.is_deleted &&
    prevProps.senderName === nextProps.senderName &&
    prevProps.onReactionDetailsPress === nextProps.onReactionDetailsPress &&
    JSON.stringify(prevProps.message.reactions) ===
      JSON.stringify(nextProps.message.reactions)
  );
});
