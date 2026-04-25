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
import { Avatar } from "./Avatar";
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
import { isReachableUrl } from "../../utils";
import { getApiBaseUrl } from "../../services/apiBase";

/**
 * True when a URL hostname points to the internal cluster (unreachable from
 * the public network) — e.g. MinIO's in-cluster DNS `minio.minio.svc…` or
 * other `.svc.cluster.local` entries. These hosts can leak into stored
 * media_url values when the backend forgets to rewrite presigned URLs.
 */
function isInternalClusterUrl(url: string): boolean {
  return (
    url.includes(".svc.cluster.local") ||
    url.includes("minio.minio") ||
    /https?:\/\/[^/]*\.internal[:/]/.test(url) ||
    /https?:\/\/[^/]*\.local(:\d+)?\//.test(url)
  );
}

/**
 * Resolve a media URL — prepend the API base for relative paths and rewrite
 * internal cluster URLs (preprod/prod MinIO k8s DNS) to the public media
 * proxy when a mediaId is available.
 */
function resolveMediaUrl(
  url: string | null | undefined,
  mediaId?: string,
  kind: "blob" | "thumbnail" = "blob",
): string {
  if (!url && mediaId) {
    return `${getApiBaseUrl()}/media/v1/${encodeURIComponent(mediaId)}/${kind}`;
  }
  if (!url) return "";
  if (url.startsWith("file://") || url.startsWith("data:")) {
    return url;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // URLs pointing to the media service blob/thumbnail endpoints are always valid
    if (
      url.includes("/media/v1/") &&
      (url.includes("/blob") || url.includes("/thumbnail"))
    ) {
      return url;
    }
    // Any other absolute URL: prefer the media-service proxy when we have a
    // mediaId. Stored presigned MinIO URLs go stale when credentials rotate
    // (SignatureDoesNotMatch), so always funnel through /media/v1/<id>/<kind>
    // which re-signs on every request.
    if (mediaId) {
      return `${getApiBaseUrl()}/media/v1/${encodeURIComponent(mediaId)}/${kind}`;
    }
    // No mediaId: drop unreachable internal URLs, pass presigned URLs through
    // as last-resort fallback.
    if (isInternalClusterUrl(url)) {
      return "";
    }
    return url;
  }
  // Relative path from the API — prepend base URL
  return `${getApiBaseUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Return false for messages that have nothing to display (no text, no media,
 * not a tombstone). Keeps the main component free of a deeply-nested guard.
 */
function shouldRenderMessage(message: MessageWithRelations): boolean {
  if (message.content) return true;
  if (message.is_deleted) return true;
  if (message.attachments && message.attachments.length > 0) return true;

  const meta = message.metadata as
    | { media_url?: string; media_id?: string }
    | undefined;
  const hasMetadataMedia =
    message.message_type === "media" &&
    !!meta &&
    Boolean(meta.media_url || meta.media_id);
  return hasMetadataMedia;
}

/**
 * WebSocket-delivered media messages may arrive without an explicit
 * attachments array — only a `metadata` blob. Synthesise a virtual
 * attachment so the UI can render a preview immediately.
 */
function buildMetadataAttachment(message: MessageWithRelations) {
  if (message.message_type !== "media" || !message.metadata) return null;
  const meta = message.metadata as {
    media_url?: string;
    media_id?: string;
    thumbnail_url?: string;
    media_type?: "image" | "video" | "file" | "audio";
    filename?: string;
    size?: number;
    mime_type?: string;
    duration?: number;
  };
  if (!meta.media_url && !meta.media_id) return null;

  const mediaId = meta.media_id;
  const apiBase = getApiBaseUrl();
  const blobFallback = mediaId ? `${apiBase}/media/v1/${mediaId}/blob` : null;
  const thumbFallback = mediaId
    ? `${apiBase}/media/v1/${mediaId}/thumbnail`
    : null;
  const blobUrl =
    blobFallback || (isReachableUrl(meta.media_url) ? meta.media_url : null);
  const thumbUrl =
    thumbFallback ||
    (isReachableUrl(meta.thumbnail_url) ? meta.thumbnail_url : blobUrl);

  return {
    id: `synth-${message.id}`,
    message_id: message.id,
    media_id: mediaId || message.id,
    media_type: (meta.media_type || "image") as
      | "image"
      | "video"
      | "file"
      | "audio",
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
}

interface MessageBubbleProps {
  message: MessageWithRelations;
  isSent: boolean;
  currentUserId: string;
  senderName?: string;
  /** Avatar URL of the sender — displayed only for received group messages */
  senderAvatarUrl?: string | null;
  /** True when this message is from the same sender as the previous one (avatar is hidden but space is kept) */
  isConsecutive?: boolean;
  /** When true, the conversation is a group and avatars should be shown for received messages */
  showSenderAvatar?: boolean;
  onReactionPress?: (messageId: string, emoji: string) => void;
  /** Appui long sur une pastille de réaction : afficher les réacteurs */
  onReactionDetailsPress?: (messageId: string, emoji: string) => void;
  /** Resolve a user_id to a display name (for reaction hover tooltips) */
  resolveReactorName?: (userId: string) => string;
  onReplyPress?: (messageId: string) => void;
  onLongPress?: () => void;
  isHighlighted?: boolean;
  searchQuery?: string;
  /** Blocked-image appeal state for this message (keyed by temp id) */
  pendingAppeal?: {
    appealId: string;
    status: "pending" | "approved" | "rejected";
    localUri: string;
  };
  /** Called when the user taps "Contester" on a locally blocked image */
  onContest?: (message: MessageWithRelations) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSent,
  currentUserId,
  senderName,
  senderAvatarUrl,
  isConsecutive = false,
  showSenderAvatar = false,
  onReactionPress,
  onReactionDetailsPress,
  resolveReactorName,
  onReplyPress,
  onLongPress,
  isHighlighted = false,
  searchQuery,
  pendingAppeal,
  onContest,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  if (!message || !shouldRenderMessage(message)) {
    return null;
  }

  // Tombstoned messages must never expose their media (audio/video/image).
  // Attachments and metadata may still be present in the payload after a
  // delete, but the bubble must show only "[Message supprimé]" — no
  // playable / viewable surface. Without this guard, a deleted voice
  // message keeps its play button and remains audible via the resolved
  // presigned URL — a P0 data-integrity bug.
  const isTombstoned = !!message.is_deleted;

  const hasExplicitAttachments =
    !isTombstoned && !!message.attachments && message.attachments.length > 0;
  const metadataAttachment =
    isTombstoned || hasExplicitAttachments
      ? null
      : buildMetadataAttachment(message);

  const hasMedia = hasExplicitAttachments || metadataAttachment !== null;
  const firstAttachment = hasExplicitAttachments
    ? message.attachments![0]
    : metadataAttachment;

  // For media messages, only show content if it's not the default placeholder text
  const isDefaultMediaText =
    hasMedia &&
    message.content &&
    ["Photo", "Vidéo", "Fichier", "Message vocal"].includes(message.content);

  const displayContent = isTombstoned
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

  const isForwarded =
    !!message.forwarded_from_id || message.metadata?.forwarded === true;
  const isFailed = message.status === "failed";

  // Only display the sender avatar for received messages in a group conversation.
  const shouldRenderAvatarSlot = !isSent && showSenderAvatar;
  const safeAvatarUri = isReachableUrl(senderAvatarUrl)
    ? senderAvatarUrl!
    : undefined;

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
                firstAttachment.media_id,
                "blob",
              )}
              type={firstAttachment.media_type as any}
              filename={firstAttachment.metadata.filename}
              size={firstAttachment.metadata.size}
              thumbnailUri={resolveMediaUrl(
                firstAttachment.metadata.thumbnail_url,
                firstAttachment.media_id,
                "thumbnail",
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
          {(message.metadata as any)?.blockedByModeration === true ? (
            <View style={styles.appealRow}>
              {!pendingAppeal && !(message.metadata as any)?.appealRejected ? (
                <TouchableOpacity
                  style={styles.contestBtn}
                  onPress={() => onContest?.(message)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.contestBtnText}>Contester</Text>
                </TouchableOpacity>
              ) : null}
              {pendingAppeal?.status === "pending" ? (
                <View style={[styles.appealBadge, styles.appealBadgePending]}>
                  <Text style={styles.appealBadgeText}>
                    Contestation envoyée
                  </Text>
                </View>
              ) : null}
              {pendingAppeal?.status === "rejected" ||
              (message.metadata as any)?.appealRejected ? (
                <View style={[styles.appealBadge, styles.appealBadgeRejected]}>
                  <Text style={styles.appealBadgeText}>
                    Refusée par l'admin
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
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
                  uri={resolveMediaUrl(
                    firstAttachment.metadata.media_url,
                    firstAttachment.media_id,
                    "blob",
                  )}
                  duration={firstAttachment.metadata.duration}
                  isSent={true}
                />
              ) : (
                <MediaMessage
                  uri={resolveMediaUrl(
                    firstAttachment.metadata.media_url ||
                      firstAttachment.metadata.thumbnail_url,
                    firstAttachment.media_id,
                    "blob",
                  )}
                  type={firstAttachment.media_type}
                  filename={firstAttachment.metadata.filename}
                  size={firstAttachment.metadata.size}
                  thumbnailUri={resolveMediaUrl(
                    firstAttachment.metadata.thumbnail_url,
                    firstAttachment.media_id,
                    "thumbnail",
                  )}
                />
              )}
            </>
          ) : null}
          {displayContent ? (
            isTombstoned ? (
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
                uri={resolveMediaUrl(
                  firstAttachment.metadata.media_url,
                  firstAttachment.media_id,
                  "blob",
                )}
                duration={firstAttachment.metadata.duration}
                isSent={false}
              />
            ) : (
              <MediaMessage
                uri={resolveMediaUrl(
                  firstAttachment.metadata.media_url ||
                    firstAttachment.metadata.thumbnail_url,
                  firstAttachment.media_id,
                  "blob",
                )}
                type={firstAttachment.media_type as "image" | "video" | "file"}
                filename={firstAttachment.metadata.filename}
                size={firstAttachment.metadata.size}
                thumbnailUri={resolveMediaUrl(
                  firstAttachment.metadata.thumbnail_url,
                  firstAttachment.media_id,
                  "thumbnail",
                )}
              />
            )}
          </>
        ) : null}
        {displayContent ? (
          isTombstoned ? (
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
          {shouldRenderAvatarSlot ? (
            <View style={styles.receivedRow}>
              <View style={styles.avatarSlot}>
                {!isConsecutive ? (
                  <Avatar uri={safeAvatarUri} name={senderName} size={32} />
                ) : null}
              </View>
              <View style={styles.receivedBubbleWrapper}>
                {renderBubbleContent()}
              </View>
            </View>
          ) : (
            renderBubbleContent()
          )}
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
              resolveReactorName={resolveReactorName}
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
  receivedRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  avatarSlot: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  receivedBubbleWrapper: {
    flexShrink: 1,
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
  appealRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  contestBtn: {
    backgroundColor: "rgba(240, 72, 72, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(240, 72, 72, 0.5)",
  },
  contestBtnText: {
    color: "#F04848",
    fontSize: 12,
    fontWeight: "700",
  },
  appealBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  appealBadgePending: {
    backgroundColor: "rgba(255, 176, 123, 0.2)",
  },
  appealBadgeRejected: {
    backgroundColor: "rgba(120, 120, 120, 0.3)",
  },
  appealBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
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
    prevProps.senderAvatarUrl === nextProps.senderAvatarUrl &&
    prevProps.isConsecutive === nextProps.isConsecutive &&
    prevProps.showSenderAvatar === nextProps.showSenderAvatar &&
    prevProps.onReactionDetailsPress === nextProps.onReactionDetailsPress &&
    prevProps.pendingAppeal?.status === nextProps.pendingAppeal?.status &&
    (prevProps.message.metadata as any)?.blockedByModeration ===
      (nextProps.message.metadata as any)?.blockedByModeration &&
    (prevProps.message.metadata as any)?.appealRejected ===
      (nextProps.message.metadata as any)?.appealRejected &&
    (prevProps.message.metadata as any)?.media_url ===
      (nextProps.message.metadata as any)?.media_url &&
    JSON.stringify(prevProps.message.reactions) ===
      JSON.stringify(nextProps.message.reactions)
  );
});
