/**
 * MessageBubble - Individual message display component
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
} from "react-native";
import { Avatar } from "./Avatar";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Animated from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type {
  MessageLinkPreview,
  MessageWithRelations,
} from "../../types/messaging";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { ReactionBar } from "./ReactionBar";
import { ReplyPreview } from "./ReplyPreview";
import { ReactionPicker } from "./ReactionPicker";
import { MediaMessage } from "./MediaMessage";
import { AudioMessage } from "./AudioMessage";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { MaskedBubbleSurface } from "./MaskedBubbleSurface";
import { MessageStatusLabel } from "./MessageStatusLabel";
import { useMessageSwipe } from "../../context/MessageSwipeContext";
import { FormattedText } from "../../utils/textFormatter";
import { isReachableUrl, formatHourMinute } from "../../utils";
import { getApiBaseUrl } from "../../services/apiBase";
import {
  extractFirstUrl,
  getLinkPreview,
  normalizeLinkPreview,
} from "../../services/linkPreview";

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
  /** True when this is the last message in a burst from the same sender —
   * iMessage convention: only the bottom-most consecutive bubble carries a
   * tail; the others are plain rounded rectangles. */
  isLastInBurst?: boolean;
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
  /** When true, renders a textual delivery status under the bubble (only the
   * latest message sent by the current user should set this). */
  isLastSentByMe?: boolean;
  /** Group conversation flag — affects "Vu par" wording. */
  isGroupConversation?: boolean;
  /** Number of *other* members in the conversation (excludes sender). */
  otherMembersCount?: number;
  /** Display name resolver for read-receipt user ids. */
  resolveMemberName?: (userId: string) => string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSent,
  currentUserId,
  senderName,
  senderAvatarUrl,
  isConsecutive = false,
  isLastInBurst = true,
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
  isLastSentByMe = false,
  isGroupConversation = false,
  otherMembersCount = 0,
  resolveMemberName,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [linkPreview, setLinkPreview] = useState<MessageLinkPreview | null>(
    null,
  );
  const swipe = useMessageSwipe();

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

  const firstLinkInMessage = useMemo(
    () => extractFirstUrl(message.content),
    [message.content],
  );
  const metadataLinkPreview = useMemo(
    () =>
      normalizeLinkPreview(
        (message.metadata as { link_preview?: Partial<MessageLinkPreview> })
          ?.link_preview,
      ),
    [message.metadata],
  );

  useEffect(() => {
    if (
      isTombstoned ||
      message.message_type !== "text" ||
      (!firstLinkInMessage && !metadataLinkPreview)
    ) {
      setLinkPreview(metadataLinkPreview);
      return;
    }

    if (metadataLinkPreview) {
      setLinkPreview(metadataLinkPreview);
      return;
    }

    let cancelled = false;
    setLinkPreview(null);

    void getLinkPreview(firstLinkInMessage!).then((preview) => {
      if (!cancelled) {
        setLinkPreview(preview);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    firstLinkInMessage,
    isTombstoned,
    message.message_type,
    metadataLinkPreview,
  ]);

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

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipe && isSent ? swipe.translateX.value : 0 }],
  }));

  const swipeTimestampStyle = useAnimatedStyle(() => {
    // Slide the timestamp in from the right edge of the screen as the user
    // swipes left. The timestamp lives in absolute positioning at right: 6,
    // and starts shifted off-screen by +40 px. As the gesture progresses it
    // translates back toward 0 (its resting visible position).
    const offset = swipe ? swipe.translateX.value + 40 : 40;
    return { transform: [{ translateX: Math.max(0, offset) }] };
  });

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
        <View style={styles.sentBubbleWrapper}>
          <MaskedBubbleSurface
            variant="failed"
            side="right"
            showTail={isLastInBurst}
            contentStyle={styles.bubbleContent}
          >
            {hasMedia && firstAttachment && firstAttachment.metadata ? (
              firstAttachment.media_type === "audio" ? (
                <AudioMessage
                  uri={resolveMediaUrl(
                    firstAttachment.metadata.media_url,
                    firstAttachment.media_id,
                    "blob",
                  )}
                  mediaId={firstAttachment.media_id}
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
                  type={firstAttachment.media_type as any}
                  filename={firstAttachment.metadata.filename}
                  size={firstAttachment.metadata.size}
                  thumbnailUri={resolveMediaUrl(
                    firstAttachment.metadata.thumbnail_url,
                    firstAttachment.media_id,
                    "thumbnail",
                  )}
                />
              )
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
            {(message.metadata as any)?.blockedByModeration === true ? (
              <View style={styles.appealRow}>
                {!pendingAppeal &&
                !(message.metadata as any)?.appealRejected ? (
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
                  <View
                    style={[styles.appealBadge, styles.appealBadgeRejected]}
                  >
                    <Text style={styles.appealBadgeText}>
                      Refusée par l'admin
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </MaskedBubbleSurface>
        </View>
      );
    }

    if (isSent) {
      return (
        <View style={styles.sentBubbleWrapper}>
          <MaskedBubbleSurface
            variant="sent"
            side="right"
            showTail={isLastInBurst}
            contentStyle={styles.bubbleContent}
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
                    mediaId={firstAttachment.media_id}
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
            {linkPreview ? (
              <LinkPreviewCard preview={linkPreview} isSent={true} />
            ) : null}
            {message.edited_at ? (
              <View style={styles.footer}>
                <Text
                  style={[
                    styles.editedLabel,
                    { color: "rgba(255, 255, 255, 0.75)" },
                  ]}
                >
                  édité
                </Text>
              </View>
            ) : null}
          </MaskedBubbleSurface>
        </View>
      );
    }

    return (
      <View style={styles.receivedBubbleWrap}>
        <MaskedBubbleSurface
          variant="received"
          side="left"
          showTail={isLastInBurst}
          contentStyle={styles.bubbleContent}
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
                  mediaId={firstAttachment.media_id}
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
                  type={
                    firstAttachment.media_type as "image" | "video" | "file"
                  }
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
                style={[
                  styles.receivedText,
                  { color: themeColors.text.primary },
                ]}
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
          {linkPreview ? (
            <LinkPreviewCard preview={linkPreview} isSent={false} />
          ) : null}
          {message.edited_at ? (
            <View style={styles.footer}>
              <Text
                style={[
                  styles.editedLabel,
                  { color: themeColors.text.tertiary },
                ]}
              >
                édité
              </Text>
            </View>
          ) : null}
        </MaskedBubbleSurface>
      </View>
    );
  };

  return (
    <>
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={styles.pressableStretch}
        {...(Platform.OS === "web"
          ? ({ onContextMenu: handleContextMenu } as any)
          : {})}
      >
        <View style={styles.swipeRow}>
          <Animated.View
            style={[styles.swipeTimestampWrap, swipeTimestampStyle]}
            pointerEvents="none"
          >
            <Text style={styles.swipeTimestamp}>
              {formatHourMinute(message.sent_at)}
            </Text>
          </Animated.View>
          <Animated.View
            style={[
              isSent ? styles.sentContainer : styles.receivedContainer,
              isLastInBurst ? styles.containerWithTail : styles.containerNoTail,
              animatedStyle,
              swipeStyle,
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
        </View>
        {isSent && isLastSentByMe ? (
          <View style={styles.statusLabelRow}>
            <MessageStatusLabel
              message={message}
              isGroup={isGroupConversation}
              otherMembersCount={otherMembersCount}
              resolveMemberName={resolveMemberName}
            />
          </View>
        ) : null}
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
  pressableStretch: {
    alignSelf: "stretch",
  },
  statusLabelRow: {
    alignItems: "flex-end",
    marginHorizontal: 16,
    marginBottom: 4,
  },
  swipeRow: {
    position: "relative",
    alignSelf: "stretch",
  },
  swipeTimestampWrap: {
    position: "absolute",
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  swipeTimestamp: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.85)",
    includeFontPadding: false,
    // Subtle shadow so the timestamp stays legible on light gradient
    // backgrounds (e.g. bottom of the chat where the orange/pink hue lifts).
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sentContainer: {
    alignItems: "flex-end",
    marginTop: 4,
    marginHorizontal: 16,
    position: "relative",
  },
  containerWithTail: {
    // Extra bottom spacing absorbs the tail that extends below the bubble
    // (~11 px), so consecutive bubbles don't touch each other.
    marginBottom: 14,
  },
  containerNoTail: {
    // Tight spacing inside a burst — no tail to clear, bubbles can sit close.
    marginBottom: 2,
  },
  sentBubbleWrapper: {
    maxWidth: "75%",
    position: "relative",
  },
  bubbleContent: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sentText: {
    color: colors.text.light,
    fontSize: 15,
    marginBottom: 4,
  },
  receivedContainer: {
    alignItems: "flex-start",
    marginTop: 4,
    marginHorizontal: 16,
    position: "relative",
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
  receivedBubbleWrap: {
    maxWidth: "75%",
    position: "relative",
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
    prevProps.isLastInBurst === nextProps.isLastInBurst &&
    prevProps.showSenderAvatar === nextProps.showSenderAvatar &&
    prevProps.onReactionDetailsPress === nextProps.onReactionDetailsPress &&
    prevProps.pendingAppeal?.status === nextProps.pendingAppeal?.status &&
    (prevProps.message.metadata as any)?.blockedByModeration ===
      (nextProps.message.metadata as any)?.blockedByModeration &&
    (prevProps.message.metadata as any)?.appealRejected ===
      (nextProps.message.metadata as any)?.appealRejected &&
    (prevProps.message.metadata as any)?.media_url ===
      (nextProps.message.metadata as any)?.media_url &&
    prevProps.isLastSentByMe === nextProps.isLastSentByMe &&
    prevProps.isGroupConversation === nextProps.isGroupConversation &&
    prevProps.otherMembersCount === nextProps.otherMembersCount &&
    // delivery_statuses only feeds MessageStatusLabel, which renders solely
    // for the last-sent bubble — skip the deep compare elsewhere.
    (!nextProps.isLastSentByMe ||
      deliveryStatusesEqual(
        prevProps.message.delivery_statuses,
        nextProps.message.delivery_statuses,
      )) &&
    JSON.stringify(prevProps.message.reactions) ===
      JSON.stringify(nextProps.message.reactions)
  );
});

function deliveryStatusesEqual(
  a: MessageWithRelations["delivery_statuses"],
  b: MessageWithRelations["delivery_statuses"],
): boolean {
  if (a === b) return true;
  const al = a?.length ?? 0;
  const bl = b?.length ?? 0;
  if (al !== bl) return false;
  if (al === 0) return true;
  // Compare only the fields that affect the rendered status label.
  for (let i = 0; i < al; i += 1) {
    const x = a![i];
    const y = b![i];
    if (x.user_id !== y.user_id || x.read_at !== y.read_at) return false;
  }
  return true;
}
