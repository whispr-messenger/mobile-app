/**
 * ChatScreen - Individual conversation chat interface
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  ImageBackground,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, useNavigation } from "@react-navigation/native";
import { StackScreenProps, StackNavigationProp } from "@react-navigation/stack";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import {
  Message,
  MessageAttachment,
  MessageWithStatus,
  MessageWithRelations,
  MessageReaction,
  Conversation,
  PinnedMessage,
} from "../../types/messaging";
import { messagingAPI } from "../../services/messaging/api";
import { cacheService } from "../../services/messaging/cache";
import { contactsAPI } from "../../services/contacts/api";
import { TokenService } from "../../services/TokenService";
import { E2EEService } from "../../services/E2EEService";
import { useWebSocket } from "../../hooks/useWebSocket";
import { MessageBubble } from "../../components/Chat/MessageBubble";
import { MessageSwipeProvider } from "../../context/MessageSwipeContext";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue, withSpring } from "react-native-reanimated";

const MESSAGE_SWIPE_DISTANCE = 40;
const MESSAGE_SWIPE_SPRING = { damping: 18, stiffness: 180 };
const MESSAGES_PAGE_SIZE = 50;
import { MessageInput } from "../../components/Chat/MessageInput";
import { TypingIndicator } from "../../components/Chat/TypingIndicator";
import { Avatar } from "../../components/Chat/Avatar";
import { MessageActionsMenu } from "../../components/Chat/MessageActionsMenu";
import { ReportMessageSheet } from "../../components/Chat/ReportMessageSheet";
import { ForwardMessageModal } from "../../components/Chat/ForwardMessageModal";
import { useConversationsStore } from "../../store/conversationsStore";
import { useCallsStore } from "../../store/callsStore";
import { systemCallProvider } from "../../services/calls/systemCallProvider";
import {
  useCallsAvailable,
  getCallsUnavailableMessage,
} from "../../hooks/useCallsAvailable";
import Toast, { ToastType } from "../../components/Toast/Toast";
import { ReactionPicker } from "../../components/Chat/ReactionPicker";
import { ReactionReactorsModal } from "../../components/Chat/ReactionReactorsModal";
import { DateSeparator } from "../../components/Chat/DateSeparator";
import { SystemMessage } from "../../components/Chat/SystemMessage";
import { MessageSearch } from "../../components/Chat/MessageSearch";
import { PinnedMessagesBar } from "../../components/Chat/PinnedMessagesBar";
import { EmptyChatState } from "../../components/Chat/EmptyChatState";
import { ChatHeader } from "./ChatHeader";
import { getConversationDisplayName } from "../../utils";
import { generateClientRandom } from "../../utils/crypto";
import { usePresenceStore } from "../../store/presenceStore";
import { AuthStackParamList } from "../../navigation/AuthNavigator";
import { colors, withOpacity } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { logger } from "../../utils/logger";
import { MediaService } from "../../services/MediaService";
import { resolveConversationMemberIds } from "../../utils/resolveMembers";
import { SchedulingService } from "../../services/SchedulingService";
import * as FileSystem from "expo-file-system/legacy";
import {
  gateChatImageBeforeSend,
  gateChatVideoBeforeSend,
} from "../../services/moderation";
import { appealsAPI } from "../../services/moderation/moderationApi";
import { ScheduleDateTimePicker } from "../../components/Chat/ScheduleDateTimePicker";
import { OfflineBanner } from "../../components/Chat/OfflineBanner";
import { BlockedImageAppealModal } from "../../components/Chat/BlockedImageAppealModal";
import { useModerationStore } from "../../store/moderationStore";
import { getSharedSocket } from "../../services/messaging/websocket";
import { offlineQueue, QueuedMessage } from "../../services/offlineQueue";
import {
  validateReactionEmoji,
  checkReactionLimits,
  userHasReaction,
} from "../../utils/reactionEmoji";

/** Cross-platform alert: falls back to window.alert on web where RN Alert is a no-op */
function showAlert(title: string, message: string): void {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// WHISPR-1074: FlatList items are either messages or date separators.
// Centralising the union + guard removes the `(item as any).type === "date"`
// casts sprinkled through the render paths.
type DateSeparatorItem = { type: "date"; date: Date; id: string };
type ChatListItem = MessageWithRelations | DateSeparatorItem;
const isDateSeparator = (item: ChatListItem): item is DateSeparatorItem =>
  (item as DateSeparatorItem).type === "date";

type ChatScreenRouteProp = StackScreenProps<
  AuthStackParamList,
  "Chat"
>["route"];
type ChatScreenNavigationProp = StackNavigationProp<AuthStackParamList, "Chat">;

const DEFAULT_MEDIA_CAPTION: Record<
  "image" | "video" | "audio" | "file",
  string
> = {
  image: "Photo",
  video: "Vidéo",
  audio: "Message vocal",
  file: "Fichier",
};

const DEFAULT_MIME_BY_KIND: Record<
  "image" | "video" | "audio" | "file",
  string
> = {
  image: "image/jpeg",
  video: "video/mp4",
  audio: "audio/mp4",
  file: "application/octet-stream",
};

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  m4a: "audio/mp4",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  caf: "audio/x-caf",
};

const resolveMimeType = (
  extension: string,
  kind: "image" | "video" | "audio" | "file",
): string => EXTENSION_TO_MIME[extension] ?? DEFAULT_MIME_BY_KIND[kind];

const canonicalizeMimeType = (mime: string): string => {
  const normalized = mime.split(";")[0].trim().toLowerCase();
  switch (normalized) {
    case "audio/x-m4a":
    case "audio/m4a":
      return "audio/mp4";
    default:
      return normalized;
  }
};

const forceAudioUploadIdentity = (
  filename: string,
  mimeType: string,
): { filename: string; mimeType: string } => {
  const normalizedMime = canonicalizeMimeType(mimeType);
  if (!normalizedMime.startsWith("audio/")) {
    return { filename, mimeType: normalizedMime };
  }
  const baseName = filename.replace(/\.[^/.]+$/, "");
  return {
    // iOS may still emit audio/x-m4a for `.m4a` filenames on multipart parts.
    // Force a neutral `.mp4` container name so part MIME inference stays audio/mp4.
    filename: `${baseName || "recording"}-${Date.now()}.mp4`,
    mimeType: "audio/mp4",
  };
};

const remapAudioUploadUri = async (
  uri: string,
  filename: string,
  mimeType: string,
): Promise<string> => {
  if (Platform.OS === "web") {
    return uri;
  }
  if (canonicalizeMimeType(mimeType) !== "audio/mp4") {
    return uri;
  }
  if (!uri.startsWith("file://")) {
    return uri;
  }
  if (/\.mp4$/i.test(uri)) {
    return uri;
  }

  const cacheRoot =
    (FileSystem as any).cacheDirectory ||
    (FileSystem as any).documentDirectory ||
    "";
  if (!cacheRoot) {
    return uri;
  }

  const targetUri = `${cacheRoot}${filename}`;
  try {
    await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(
      () => {},
    );
    await FileSystem.copyAsync({ from: uri, to: targetUri });
    return targetUri;
  } catch (error) {
    console.warn("[ChatScreen] Failed to remap audio upload URI:", error);
    return uri;
  }
};

export const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { conversationId } = route.params;
  // Hydrate from the conversations store so the header (name + avatar)
  // shows immediately while getConversation() is still in flight. The
  // store entry has already been enriched with display_name and avatar_url
  // by enrichSingleConversation() for direct chats.
  const [conversation, setConversation] = useState<Conversation | null>(() => {
    const cached = useConversationsStore
      .getState()
      .conversations.find((c) => c.id === conversationId);
    return cached ?? null;
  });
  const e2eeEnabled = useMemo(() => {
    const meta = conversation?.metadata ?? {};
    const e2ee = (meta as any).e2ee;
    return !!e2ee && typeof e2ee === "object" && (e2ee as any).enabled === true;
  }, [conversation]);
  const e2eeEnabledRef = useRef<boolean>(false);
  useEffect(() => {
    e2eeEnabledRef.current = e2eeEnabled;
  }, [e2eeEnabled]);
  const [messages, setMessages] = useState<MessageWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [typingUsersNames, setTypingUsersNames] = useState<
    Record<string, string>
  >({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] =
    useState<MessageWithRelations | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] =
    useState<MessageWithRelations | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<
    string | null
  >(null);
  const [reactionReactorsModal, setReactionReactorsModal] = useState<{
    messageId: string;
    emoji: string;
  } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageWithRelations[]>(
    [],
  );
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [showPinnedBar, setShowPinnedBar] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [e2eeToggleBusy, setE2eeToggleBusy] = useState(false);
  const [conversationMembers, setConversationMembers] = useState<
    Array<{
      id: string;
      display_name: string;
      username?: string;
      avatar_url?: string;
    }>
  >([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingMessage, setForwardingMessage] =
    useState<MessageWithRelations | null>(null);
  const callsAvailability = useCallsAvailable();
  const [callsToast, setCallsToast] = useState<{
    visible: boolean;
    message: string;
    type: ToastType;
  }>({ visible: false, message: "", type: "info" });
  const [forwardSending, setForwardSending] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [reportSheetMessage, setReportSheetMessage] =
    useState<MessageWithRelations | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleMessageText, setScheduleMessageText] = useState("");
  const [isOtherUserContact, setIsOtherUserContact] = useState<boolean | null>(
    null,
  );
  const [addingContact, setAddingContact] = useState(false);
  const [appealModal, setAppealModal] = useState<{
    visible: boolean;
    imageUri: string;
    blockReason?: string;
    scores?: Record<string, number>;
    messageTempId: string;
  } | null>(null);
  const pendingAppeals = useModerationStore((s) => s.pendingAppeals);
  const handleAppealDecision = useModerationStore(
    (s) => s.handleAppealDecision,
  );
  const cleanupAppeal = useModerationStore((s) => s.cleanupAppeal);
  const allConversations = useConversationsStore((s) => s.conversations);
  const onlineUserIds = usePresenceStore((s) => s.onlineUserIds);
  const lastSeenAt = usePresenceStore((s) => s.lastSeenAt);
  const handleSendMediaRef = useRef<typeof handleSendMedia>(null!);
  const conversationChannelRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const cacheWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eviter le double-tap envoyant 2 messages distincts sur connexion lente :
  // chaque tap a son propre client_random donc le serveur ne peut pas dedup.
  const sendingRef = useRef(false);
  // Horizontal swipe to reveal per-message timestamps. The shared value is
  // consumed by every MessageBubble through MessageSwipeProvider, so all rows
  // translate together without re-rendering.
  const swipeTranslateX = useSharedValue(0);
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(-10)
        .failOffsetY([-10, 10])
        .onUpdate((e) => {
          // Only allow leftward swipes, capped at MESSAGE_SWIPE_DISTANCE.
          const next = Math.max(
            -MESSAGE_SWIPE_DISTANCE,
            Math.min(0, e.translationX),
          );
          swipeTranslateX.value = next;
        })
        // onFinalize fires for both completed and cancelled gestures, so a
        // separate onEnd is redundant.
        .onFinalize(() => {
          swipeTranslateX.value = withSpring(0, MESSAGE_SWIPE_SPRING);
        }),
    [swipeTranslateX],
  );
  const initialScrollDoneRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  // `viewabilityConfig` and `onViewableItemsChanged` must be stable references —
  // FlatList throws if they change between renders. Using refs keeps the
  // underlying function identity constant while letting us read/write the
  // latest `isNearBottomRef` value from inside the handler.
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;
  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      // Inverted list: index 0 is the newest message (rendered at the bottom).
      // If it is visible, the user is reading the latest section and we can
      // safely auto-scroll when a new message arrives.
      isNearBottomRef.current = viewableItems.some((v) => v.index === 0);
    },
  ).current;
  const {
    getThemeColors,
    getLocalizedText,
    settings: themeSettings,
  } = useTheme();
  const themeColors = getThemeColors();
  const hasCustomBackground =
    themeSettings?.backgroundPreset === "custom" &&
    !!themeSettings?.customBackgroundUri;
  const customBackgroundUri = themeSettings?.customBackgroundUri ?? null;
  const customBackgroundVersion = themeSettings?.customBackgroundVersion ?? 0;

  const { userId: rawUserId } = useAuth();
  const userId = rawUserId ?? "";
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    if (!userId) {
      setToken("");
      return;
    }
    TokenService.getAccessToken().then((t) => setToken(t ?? ""));
  }, [userId]);

  // WebSocket connection
  const {
    connectionState,
    joinConversationChannel,
    sendMessage: wsSendMessage,
    markAsRead,
    sendTyping,
  } = useWebSocket({
    userId,
    token,
    onPresenceUpdate: (presenceUserId: string, isOnline: boolean) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) {
          next.add(presenceUserId);
        } else {
          next.delete(presenceUserId);
        }
        return next;
      });
    },
    onNewMessage: (incoming: Message) => {
      // WHISPR-1074: the socket may ship the enriched form (attachments,
      // status, delivery_statuses). The hook types the payload as the base
      // Message so we widen once here and drop the per-field `as any`
      // casts below. Missing fields stay undefined and the `||` fallbacks
      // still kick in, so behaviour is unchanged.
      const message = incoming as MessageWithRelations;
      const isEncryptedIncoming =
        message.message_type === "text" &&
        typeof message.content === "string" &&
        E2EEService.isEncryptedPayload(message.content);
      const displayMessage: MessageWithRelations = isEncryptedIncoming
        ? { ...message, content: "Message chiffré" }
        : message;
      if (message.conversation_id === conversationId) {
        setMessages((prev) => {
          // Check if message already exists (avoid duplicates)
          if (prev.some((m) => m.id === message.id)) {
            return prev.map((m) =>
              m.id === message.id
                ? {
                    ...displayMessage,
                    content:
                      message.message_type === "text" &&
                      typeof message.content === "string" &&
                      E2EEService.isEncryptedPayload(message.content)
                        ? m.content
                        : displayMessage.content,
                    // Preserve attachments from the optimistic message when the
                    // WebSocket echo doesn't carry them (server Message has no
                    // attachments array).
                    attachments: displayMessage.attachments || m.attachments,
                    // Preserve the populated reply_to (full Message object) we
                    // built optimistically — the WS echo only ships reply_to_id
                    // so spreading it would erase the reply preview until the
                    // next full reload.
                    reply_to: displayMessage.reply_to || m.reply_to,
                    status: displayMessage.status || ("sent" as const),
                  }
                : m,
            );
          }
          const optimisticByClientRandom = prev.findIndex(
            (m) =>
              m.id.startsWith("temp-") &&
              String(m.client_random ?? "") ===
                String(message.client_random ?? ""),
          );
          const optimisticByHeuristic =
            optimisticByClientRandom === -1 && message.sender_id === userId
              ? prev.findIndex((m) => {
                  if (!m.id.startsWith("temp-")) return false;
                  if (m.status !== "sending") return false;
                  if (m.message_type !== message.message_type) return false;
                  if (m.content !== message.content) return false;
                  const a = new Date(m.sent_at).getTime();
                  const b = new Date(message.sent_at).getTime();
                  return (
                    Number.isFinite(a) &&
                    Number.isFinite(b) &&
                    Math.abs(a - b) < 15000
                  );
                })
              : -1;
          const optimisticMessageIndex =
            optimisticByClientRandom !== -1
              ? optimisticByClientRandom
              : optimisticByHeuristic;

          if (optimisticMessageIndex !== -1) {
            const existing = prev[optimisticMessageIndex];
            const newMessages = [...prev];
            newMessages[optimisticMessageIndex] = {
              ...displayMessage,
              content:
                message.message_type === "text" &&
                typeof message.content === "string" &&
                E2EEService.isEncryptedPayload(message.content)
                  ? existing.content
                  : displayMessage.content,
              // Preserve attachments from the optimistic message
              attachments: displayMessage.attachments || existing.attachments,
              // Same as the duplicate-id branch above: keep the populated
              // reply_to object so the reply preview doesn't disappear when
              // the server echo arrives.
              reply_to: displayMessage.reply_to || existing.reply_to,
              status: displayMessage.status || ("sent" as const),
            };
            return newMessages;
          }
          return [
            {
              ...displayMessage,
              status: displayMessage.status || ("sent" as const),
            },
            ...prev,
          ];
        });
        useConversationsStore
          .getState()
          .applyNewMessage(displayMessage as any, userId)
          .catch(() => {});
        useConversationsStore.getState().resetUnreadCount(conversationId);
        // Mark as read if chat is open
        markAsRead(conversationId, message.id);
        if (isEncryptedIncoming) {
          void (async () => {
            const decrypted = await E2EEService.decryptTextMessage({
              conversationId,
              content: message.content as string,
            });
            if (decrypted === null) return;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === message.id ? { ...m, content: decrypted } : m,
              ),
            );
            useConversationsStore
              .getState()
              .applyMessageUpdated({
                ...(message as any),
                content: decrypted,
              } as any);
          })();
        }
        // Auto-scroll to the new message only when the user was already
        // reading the bottom of the list — don't yank them down if they
        // were scrolled up browsing older messages.
        if (isNearBottomRef.current) {
          setTimeout(() => {
            try {
              flatListRef.current?.scrollToIndex({
                index: 0,
                animated: true,
              });
            } catch {
              flatListRef.current?.scrollToOffset({
                offset: 0,
                animated: true,
              });
            }
          }, 50);
        }
      }
    },
    onDeliveryStatus: (messageId: string, status: string) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, status: status as "sent" | "delivered" | "read" }
            : msg,
        ),
      );
    },
    onMessageUpdated: (message: Message) => {
      const isEncryptedUpdate =
        message.message_type === "text" &&
        typeof message.content === "string" &&
        E2EEService.isEncryptedPayload(message.content);
      if (message.conversation_id === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === message.id
              ? {
                  ...msg,
                  ...message,
                  content: isEncryptedUpdate ? msg.content : message.content,
                  edited_at: message.edited_at,
                  // Edit echoes ship reply_to_id only — keep the populated
                  // reply_to from the existing message so the preview survives.
                  reply_to: message.reply_to || msg.reply_to,
                }
              : msg,
          ),
        );
      }
      useConversationsStore
        .getState()
        .applyMessageUpdated(
          isEncryptedUpdate
            ? { ...message, content: "Message chiffré" }
            : message,
        );
      if (isEncryptedUpdate) {
        void (async () => {
          const decrypted = await E2EEService.decryptTextMessage({
            conversationId: message.conversation_id,
            content: message.content as string,
          });
          if (decrypted === null) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === message.id ? { ...m, content: decrypted } : m,
            ),
          );
          useConversationsStore
            .getState()
            .applyMessageUpdated({
              ...(message as any),
              content: decrypted,
            } as any);
        })();
      }
    },
    onMessageDeleted: (
      messageId: string,
      deleteForEveryone: boolean | string,
    ) => {
      useConversationsStore
        .getState()
        .applyMessageDeleted(
          messageId,
          deleteForEveryone === true || deleteForEveryone === "true",
        );
      if (deleteForEveryone === true || deleteForEveryone === "true") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  is_deleted: true,
                  delete_for_everyone: true,
                  content: "[Message supprimé]",
                }
              : msg,
          ),
        );
      } else {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      }
      loadPinnedMessages();
    },
    onTyping: (typingUserId: string, typing: boolean) => {
      if (typingUserId !== userId) {
        if (typing) {
          // Résoudre le nom depuis conversationMembers en priorité (synchrone,
          // zéro latence). Fallback sur getUserInfo seulement si absent du
          // cache local — évite le "Quelqu'un" affiché pendant le round-trip.
          const memberName = conversationMembers.find(
            (m) => m.id === typingUserId,
          )?.display_name;
          if (memberName) {
            setTypingUsersNames((prev) => ({
              ...prev,
              [typingUserId]: memberName,
            }));
          } else {
            messagingAPI.getUserInfo(typingUserId).then((userInfo) => {
              if (userInfo) {
                setTypingUsersNames((prevNames) => ({
                  ...prevNames,
                  [typingUserId]: userInfo.display_name,
                }));
              }
            });
          }
          setTypingUsers((prev) =>
            prev.includes(typingUserId) ? prev : [...prev, typingUserId],
          );
          // Annuler le timer précédent avant d'en créer un nouveau — sans ça,
          // des typing_started répétés empilent des timers et le user disparaît
          // prématurément (le premier timer expire avant les suivants).
          if (typingTimeoutsRef.current[typingUserId]) {
            clearTimeout(typingTimeoutsRef.current[typingUserId]);
          }
          typingTimeoutsRef.current[typingUserId] = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((id) => id !== typingUserId));
            delete typingTimeoutsRef.current[typingUserId];
          }, 5000);
        } else {
          setTypingUsers((prev) => prev.filter((id) => id !== typingUserId));
          if (typingTimeoutsRef.current[typingUserId]) {
            clearTimeout(typingTimeoutsRef.current[typingUserId]);
            delete typingTimeoutsRef.current[typingUserId];
          }
        }
      }
    },
    onConversationUpdate: (updatedConversation: Conversation) => {
      if (updatedConversation.id === conversationId) {
        setConversation((prev) => {
          if (!prev) return updatedConversation;
          return { ...prev, ...updatedConversation };
        });
      }
    },
    onReactionAdded: ({ message_id, user_id, reaction: reactionEmoji }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== message_id) return msg;
          const list = msg.reactions ?? [];
          if (
            list.some(
              (r) => r.user_id === user_id && r.reaction === reactionEmoji,
            )
          ) {
            return msg;
          }
          const row: MessageReaction = {
            id: `rt-${message_id}-${user_id}-${reactionEmoji}`,
            message_id,
            user_id,
            reaction: reactionEmoji,
            created_at: new Date().toISOString(),
          };
          return { ...msg, reactions: [...list, row] };
        }),
      );
    },
    onReactionRemoved: ({ message_id, user_id, reaction: reactionEmoji }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== message_id) return msg;
          const list = (msg.reactions ?? []).filter(
            (r) => !(r.user_id === user_id && r.reaction === reactionEmoji),
          );
          return { ...msg, reactions: list };
        }),
      );
    },
  });

  // Drain offline queue when connection is restored
  const prevConnectionStateRef = useRef<string>("disconnected");
  useEffect(() => {
    const wasOffline =
      prevConnectionStateRef.current === "disconnected" ||
      prevConnectionStateRef.current === "reconnecting";
    const isNowConnected = connectionState === "connected";

    if (wasOffline && isNowConnected) {
      // Reload messages to pick up any sent while we were disconnected
      loadMessages();

      offlineQueue.getForConversation(conversationId).then(async (pending) => {
        for (const queued of pending) {
          try {
            let outgoingContent = queued.content;
            let signature: string | undefined;
            let sender_public_key: string | undefined;
            if (
              e2eeEnabledRef.current &&
              queued.message_type === "text" &&
              conversation?.type === "direct"
            ) {
              const memberIds =
                conversation.member_user_ids ||
                conversation.members?.map(
                  (m: { user_id: string }) => m.user_id,
                );
              const otherUserId = memberIds?.find(
                (id: string) => id !== userId,
              );
              if (otherUserId) {
                const enc = await E2EEService.encryptDirectTextMessage({
                  conversationId,
                  plaintext: queued.content,
                  clientRandom: queued.client_random,
                  recipientUserId: otherUserId,
                });
                outgoingContent = enc.content;
                signature = enc.signature;
                sender_public_key = enc.sender_public_key;
              }
            }
            const sent = await messagingAPI.sendMessage(conversationId, {
              content: outgoingContent,
              message_type: queued.message_type,
              client_random: queued.client_random,
              metadata: {},
              reply_to_id: queued.reply_to_id,
              signature,
              sender_public_key,
            });
            // Replace queued message with sent one
            setMessages((prev) =>
              prev.map((m) =>
                m.client_random === queued.client_random
                  ? {
                      ...(sent as MessageWithRelations),
                      content:
                        queued.message_type === "text"
                          ? queued.content
                          : (sent as any).content,
                      status: "sent" as const,
                    }
                  : m,
              ),
            );
            await offlineQueue.remove(queued.client_random);
          } catch (err) {
            logger.error("ChatScreen", "Failed to drain queued message", err);
          }
        }
      });
    }

    prevConnectionStateRef.current = connectionState;
  }, [connectionState, conversationId, conversation, userId]);

  const loadPinnedMessages = useCallback(async () => {
    try {
      const pinned = await messagingAPI.getPinnedMessages(conversationId);
      setPinnedMessages(pinned);
    } catch (error) {
      logger.error("ChatScreen", "Error loading pinned messages", error);
      setPinnedMessages([]);
    }
  }, [conversationId]);

  const loadConversation = useCallback(async () => {
    try {
      const conv = await messagingAPI.getConversation(conversationId);

      // Resolve display name and avatar for direct conversations.
      // The detail endpoint returns members array, not member_user_ids,
      // and does not populate avatar_url for direct chats — we enrich it
      // from the other user's profile to feed the header avatar.
      const memberIds =
        conv.member_user_ids ||
        conv.members?.map((m: { user_id: string }) => m.user_id);
      if (
        conv.type === "direct" &&
        (!conv.display_name || !conv.avatar_url) &&
        memberIds
      ) {
        conv.member_user_ids = memberIds;
        const otherUserId = memberIds.find((id: string) => id !== userId);
        if (otherUserId) {
          try {
            const userInfo = await messagingAPI.getUserInfo(otherUserId);
            if (userInfo) {
              conv.display_name = conv.display_name || userInfo.display_name;
              conv.avatar_url = conv.avatar_url || userInfo.avatar_url;
            }
          } catch {}
        }
      }

      setConversation(conv);

      // Load members if it's a group
      if (conv.type === "group") {
        try {
          const members =
            await messagingAPI.getConversationMembers(conversationId);
          setConversationMembers(members);
        } catch (error) {
          logger.error("ChatScreen", "Error loading members", error);
        }
      }
    } catch (error) {
      logger.error("ChatScreen", "Error loading conversation", error);
    }
  }, [conversationId, userId]);

  const handleToggleE2EE = useCallback(
    (enabled: boolean) => {
      if (!conversation || conversation.type !== "direct") return;
      if (e2eeToggleBusy) return;
      setE2eeToggleBusy(true);
      void (async () => {
        try {
          const updated = await messagingAPI.updateConversation(
            conversationId,
            {
              metadata: { e2ee: { enabled, v: 1 } },
            },
          );
          setConversation(updated);
        } catch (error: any) {
          Alert.alert(
            getLocalizedText("notif.error"),
            error?.message || "Impossible de mettre à jour le chiffrement",
          );
        } finally {
          setE2eeToggleBusy(false);
        }
      })();
    },
    [conversationId, conversation, e2eeToggleBusy, getLocalizedText],
  );

  // Mark messages as read when opening conversation and when new messages arrive
  useEffect(() => {
    if (!conversationId || !messages.length) return;
    const lastMsg = messages[0]; // messages are sorted newest first
    // Always reset the unread badge when the conversation is open
    useConversationsStore.getState().resetUnreadCount(conversationId);
    // Send read receipt to backend only if the last message is from someone else
    if (lastMsg?.id && lastMsg?.sender_id !== userId) {
      markAsRead(conversationId, lastMsg.id);
    }
  }, [conversationId, messages.length, userId, markAsRead]);

  // Consume the openSearch route param (set by GroupDetails or other screens
  // that want to drop the user directly into the search UI). Clear it after
  // use so it doesn't re-trigger on subsequent re-renders or focus events.
  useEffect(() => {
    if (route.params?.openSearch) {
      setShowSearch(true);
      navigation.setParams({ openSearch: undefined });
    }
  }, [route.params?.openSearch, navigation]);

  useEffect(() => {
    // Load data
    initialScrollDoneRef.current = false;
    loadConversation();
    let cancelled = false;
    cacheService
      .getMessages(conversationId)
      .then((cached) => {
        if (cancelled) return;
        if (!cached || cached.length === 0) return;
        setMessages((prev) => {
          if (prev.length === 0) return cached;
          const existingIds = new Set(prev.map((m) => m.id));
          const merged = [
            ...prev,
            ...cached.filter((m) => !existingIds.has(m.id)),
          ];
          return merged.sort(
            (a, b) =>
              new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
          );
        });
        setHasMore(cached.length >= MESSAGES_PAGE_SIZE);
        setLoading(false);
      })
      .catch(() => {});
    loadMessages();
    loadPinnedMessages();

    // Join conversation channel once token is available
    if (token) {
      const { channel, cleanup } = joinConversationChannel(conversationId);
      conversationChannelRef.current = channel;

      return () => {
        cancelled = true;
        cleanup();
        channel?.leave();
        Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
        typingTimeoutsRef.current = {};
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, token]);

  useEffect(() => {
    if (!conversationId) return;
    if (messages.length === 0) return;
    if (cacheWriteTimerRef.current) {
      clearTimeout(cacheWriteTimerRef.current);
    }
    const stable = messages
      .filter((m) => m && typeof m.id === "string" && !m.id.startsWith("temp-"))
      .slice(0, 75);
    cacheWriteTimerRef.current = setTimeout(() => {
      cacheService.saveMessages(conversationId, stable).catch(() => {});
    }, 400);
    return () => {
      if (cacheWriteTimerRef.current) {
        clearTimeout(cacheWriteTimerRef.current);
        cacheWriteTimerRef.current = null;
      }
    };
  }, [conversationId, messages]);

  // Applies an admin decision on a blocked-image appeal.
  // On approve: re-submit the original image bypassing the gate.
  // On reject: annotate the bubble so the user sees "Refusée par l'admin".
  const applyBlockedImageDecision = useCallback(
    (messageTempId: string, decision: "approved" | "rejected") => {
      const current =
        useModerationStore.getState().pendingAppeals[messageTempId];
      if (!current || current.status !== "pending") return;

      handleAppealDecision({ messageTempId, decision });

      // Prefer the base64 data URI when available (survives web logout) and
      // fall back to the native file URI.
      const replayUri = current?.localDataUri || current?.localUri;

      if (decision === "approved" && replayUri) {
        handleSendMediaRef
          .current(replayUri, "image", undefined, undefined, {
            skipGate: true,
          })
          .catch((err) =>
            logger.warn("ChatScreen", "re-submit after appeal failed", err),
          )
          .finally(() => {
            cleanupAppeal(messageTempId).catch(() => {});
          });
      } else if (decision === "rejected") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageTempId
              ? {
                  ...m,
                  metadata: {
                    ...(m.metadata || {}),
                    appealRejected: true,
                  },
                  content: "Refusée par l'admin",
                }
              : m,
          ),
        );
        cleanupAppeal(messageTempId).catch(() => {});
      }
    },
    [cleanupAppeal, handleAppealDecision],
  );

  // WebSocket listener for admin decisions on blocked-image appeals.
  useEffect(() => {
    if (!userId) return;
    let socket: ReturnType<typeof getSharedSocket>;
    try {
      socket = getSharedSocket();
    } catch {
      return;
    }
    const channel = socket.channel(`user:${userId}`);
    const onDecision = (data: any) => {
      const messageTempId: string | undefined =
        data?.messageTempId || data?.message_temp_id;
      const decision: "approved" | "rejected" | undefined = data?.decision;
      if (!messageTempId || !decision) return;

      applyBlockedImageDecision(messageTempId, decision);
    };
    channel.on("blocked_image_decision", onDecision);
    // Phoenix only routes broadcasts to channels that have actually joined
    // their topic. Without this, the backend `Endpoint.broadcast("user:<id>",
    // "blocked_image_decision", ...)` never reaches the callback — which is
    // exactly the WHISPR-1142 symptom.
    channel.join().catch((err) => {
      logger.warn("ChatScreen", "user channel join failed", err);
    });
    return () => {
      channel.off("blocked_image_decision", onDecision);
    };
  }, [userId, applyBlockedImageDecision]);

  // Polling fallback: if the WebSocket event is ever missed (connection loss,
  // backend hiccup, app relaunch before the broadcast lands), poll the user-
  // service for the status of every pending appeal and apply the decision as
  // if it had come over the socket. Runs once on mount and then every 10s
  // while there is at least one pending appeal on this screen.
  useEffect(() => {
    if (!userId) return;

    const statusToDecision = (
      status: string,
    ): "approved" | "rejected" | null =>
      status === "accepted"
        ? "approved"
        : status === "rejected"
          ? "rejected"
          : null;

    const pollOnce = async () => {
      const pending = useModerationStore.getState().pendingAppeals;
      const entries = Object.entries(pending).filter(
        ([, v]) => v.status === "pending",
      );
      if (entries.length === 0) return;

      await Promise.all(
        entries.map(async ([messageTempId, entry]) => {
          try {
            const appeal = await appealsAPI.getAppeal(entry.appealId);
            const decision = statusToDecision(appeal.status);
            if (decision) {
              applyBlockedImageDecision(messageTempId, decision);
            }
          } catch (err) {
            logger.warn("ChatScreen", "appeal poll failed", {
              appealId: entry.appealId,
              err,
            });
          }
        }),
      );
    };

    // Kick off an immediate check so a decision that landed while the app was
    // closed is picked up as soon as the chat opens.
    pollOnce().catch(() => {});
    const id = setInterval(() => {
      pollOnce().catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, [userId, applyBlockedImageDecision]);

  // Check if the other user in a direct conversation is in our contacts
  useEffect(() => {
    if (!conversation || conversation.type !== "direct" || !userId) {
      setIsOtherUserContact(null);
      return;
    }
    const memberIds =
      conversation.member_user_ids ||
      conversation.members?.map((m: { user_id: string }) => m.user_id);
    const otherUserId = memberIds?.find((id: string) => id !== userId);
    if (!otherUserId) {
      setIsOtherUserContact(null);
      return;
    }
    contactsAPI
      .getContacts(undefined, userId)
      .then(({ contacts }) => {
        const isContact = contacts.some((c) => c.contact_id === otherUserId);
        setIsOtherUserContact(isContact);
      })
      .catch(() => {
        setIsOtherUserContact(null);
      });
  }, [conversation, userId]);

  const handleAddContactFromChat = useCallback(async () => {
    if (!conversation || conversation.type !== "direct" || !userId) return;
    const memberIds =
      conversation.member_user_ids ||
      conversation.members?.map((m: { user_id: string }) => m.user_id);
    const otherUserId = memberIds?.find((id: string) => id !== userId);
    if (!otherUserId) return;
    try {
      setAddingContact(true);
      await contactsAPI.sendContactRequest(otherUserId);
      showAlert(
        getLocalizedText("chat.requestSentTitle"),
        getLocalizedText("chat.requestSentMessage"),
      );
      setIsOtherUserContact(null); // Hide banner after sending
    } catch (error: any) {
      showAlert(
        "Erreur",
        error.message || "Impossible d'envoyer la demande de contact",
      );
    } finally {
      setAddingContact(false);
    }
  }, [conversation, userId]);

  const loadMessages = useCallback(
    async (before?: string) => {
      try {
        if (before) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const data = await messagingAPI.getMessages(conversationId, {
          limit: MESSAGES_PAGE_SIZE,
          before,
        });

        // Load reactions and enrich messages
        const messagesWithRelations: MessageWithRelations[] = await Promise.all(
          data
            .filter(
              (msg) =>
                msg &&
                (msg.content ||
                  msg.is_deleted ||
                  msg.message_type === "media" ||
                  msg.message_type === "system"),
            ) // Include all message types
            .map(async (msg) => {
              let displayContent = msg.content;
              if (
                msg.message_type === "text" &&
                typeof msg.content === "string" &&
                E2EEService.isEncryptedPayload(msg.content)
              ) {
                const decrypted = await E2EEService.decryptTextMessage({
                  conversationId,
                  content: msg.content,
                });
                displayContent =
                  decrypted === null ? "Message chiffré" : decrypted;
              }
              // WHISPR-1074: the backend may ship the enriched shape
              // (delivery_statuses + status). Widen once instead of
              // per-field casts below.
              const enriched = msg as MessageWithRelations;
              // Derive delivery status: prefer explicit status, then check delivery_statuses array
              let status: NonNullable<MessageWithRelations["status"]> =
                enriched.status || ("sent" as const);
              if (status === "sent" && enriched.delivery_statuses?.length) {
                const ds = enriched.delivery_statuses;
                if (ds.some((d) => d.read_at)) {
                  status = "read";
                } else if (ds.some((d) => d.delivered_at)) {
                  status = "delivered";
                }
              }

              // Load reactions for this message
              let reactions: MessageReaction[] = [];
              try {
                const reactionData = await messagingAPI.getMessageReactions(
                  msg.id,
                );
                reactions = Array.isArray(reactionData)
                  ? reactionData
                  : reactionData?.reactions || [];
              } catch (error) {
                // Ignore errors for reactions
              }

              // Load attachments for this message
              let attachments: MessageAttachment[] = [];
              try {
                attachments = await messagingAPI.getAttachments(msg.id);
              } catch (error) {
                // Ignore errors for attachments
              }

              // reply_to is resolved against the full merged list below so
              // replies whose parent lives in a different page or is already
              // in state still render their preview. Only the parent id is
              // kept here.
              return {
                ...msg,
                content: displayContent,
                status,
                reactions,
                attachments,
                reply_to: undefined,
              } as MessageWithRelations;
            }),
        );

        // Resolve reply_to against both the freshly fetched batch and the
        // already-loaded messages so paginated history (older batch arrives
        // later) doesn't drop the reply preview.
        const resolveReplies = (
          batch: MessageWithRelations[],
          pool: MessageWithRelations[],
        ): MessageWithRelations[] => {
          if (batch.length === 0) return batch;
          const lookup = new Map<string, Message>();
          for (const m of pool) lookup.set(m.id, m);
          for (const m of batch) lookup.set(m.id, m);
          return batch.map((m) =>
            m.reply_to_id && !m.reply_to
              ? { ...m, reply_to: lookup.get(m.reply_to_id) }
              : m,
          );
        };

        if (before) {
          // Loading older messages — merge, deduplicate and re-sort desc
          // so the inverted FlatList always renders newest at bottom.
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const deduped = messagesWithRelations.filter(
              (m) => !existingIds.has(m.id),
            );
            const withReplies = resolveReplies(deduped, prev);
            // Some already-loaded newer messages may reply to a message that
            // just arrived in this older batch — resolve those too so the
            // preview appears on scroll up.
            const newIds = new Set(withReplies.map((m) => m.id));
            const updatedPrev = prev.map((m) =>
              m.reply_to_id && !m.reply_to && newIds.has(m.reply_to_id)
                ? {
                    ...m,
                    reply_to: withReplies.find((n) => n.id === m.reply_to_id),
                  }
                : m,
            );
            return [...updatedPrev, ...withReplies].sort(
              (a, b) =>
                new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
            );
          });
          setHasMore(messagesWithRelations.length === MESSAGES_PAGE_SIZE);
        } else {
          // Initial load — merge with any messages already received via WS
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newcomers = messagesWithRelations.filter(
              (m) => !existingIds.has(m.id),
            );
            const withReplies = resolveReplies(newcomers, prev);
            const merged = [...prev, ...withReplies];
            return merged.sort(
              (a, b) =>
                new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
            );
          });
          setHasMore(messagesWithRelations.length === MESSAGES_PAGE_SIZE);
          // Mark the newest message as read so the sender gets a read receipt
          if (messagesWithRelations.length > 0) {
            markAsRead(conversationId, messagesWithRelations[0].id);
          }
        }
      } catch (error) {
        logger.error("ChatScreen", "Error loading messages", error);
        if (!before) {
          setMessages([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [conversationId],
  );

  const loadMoreMessages = useCallback(() => {
    if (loadingMore || !hasMore || messages.length === 0) {
      return;
    }

    const oldestMessage = messages[messages.length - 1];
    loadMessages(oldestMessage.sent_at);
  }, [messages, loadingMore, hasMore, loadMessages]);

  const handleSendMessage = useCallback(
    async (content: string, replyToId?: string, mentions?: string[]) => {
      // ref-lock : sur connexion lente, un double-tap genererait 2 messages
      // avec des client_random differents (donc pas dedup serveur). On ignore
      // les calls concurrents sans desactiver le bouton (UX intacte).
      if (sendingRef.current) return;
      sendingRef.current = true;
      try {
        // Stop typing indicator
        sendTyping(conversationId, false);

        // If editing, update the message
        if (editingMessage) {
          try {
            let outgoingEditContent = content;
            if (e2eeEnabledRef.current) {
              const memberIds =
                conversation?.member_user_ids ||
                conversation?.members?.map(
                  (m: { user_id: string }) => m.user_id,
                );
              const otherUserId = memberIds?.find(
                (id: string) => id !== userId,
              );
              if (conversation?.type === "direct" && otherUserId) {
                const enc = await E2EEService.encryptDirectTextMessage({
                  conversationId,
                  plaintext: content,
                  clientRandom:
                    typeof editingMessage.client_random === "number"
                      ? editingMessage.client_random
                      : generateClientRandom(),
                  recipientUserId: otherUserId,
                });
                outgoingEditContent = enc.content;
              }
            }
            const updated = await messagingAPI.editMessage(
              editingMessage.id,
              conversationId,
              outgoingEditContent,
            );
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === editingMessage.id
                  ? {
                      ...msg,
                      ...updated,
                      content,
                      edited_at: updated.edited_at,
                    }
                  : msg,
              ),
            );
            setEditingMessage(null);
            useConversationsStore
              .getState()
              .applyMessageUpdated({ ...(updated as any), content } as any);
          } catch (error) {
            logger.error("ChatScreen", "Error editing message", error);
            Alert.alert(
              getLocalizedText("notif.error"),
              getLocalizedText("chat.errorEditMessage"),
            );
            setEditingMessage(null);
          }
          return;
        }

        const tempMessage: MessageWithRelations = {
          id: `temp-${Date.now()}`,
          conversation_id: conversationId,
          sender_id: userId,
          message_type: "text",
          content,
          metadata: {},
          // crypto random Uint32 pour eviter birthday collision sur dedup serveur
          client_random: generateClientRandom(),
          sent_at: new Date().toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
          status: "sending",
          reply_to_id: replyToId,
          reply_to: replyingTo || undefined,
        };

        setMessages((prev) => [tempMessage, ...prev]);
        setReplyingTo(null);
        useConversationsStore
          .getState()
          .applyNewMessage(tempMessage as any, userId)
          .catch(() => {});
        useConversationsStore.getState().resetUnreadCount(conversationId);

        // Scroll to bottom so the newly sent text message is visible
        // (FlatList is inverted, so offset 0 is the bottom)
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);

        // If offline, queue the message for later delivery
        if (connectionState !== "connected") {
          const queued: QueuedMessage = {
            id: tempMessage.id,
            conversation_id: conversationId,
            content,
            message_type: "text",
            client_random: tempMessage.client_random as number,
            reply_to_id: replyToId,
            queued_at: new Date().toISOString(),
          };
          await offlineQueue.enqueue(queued);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempMessage.id ? { ...m, status: "queued" as const } : m,
            ),
          );
          useConversationsStore
            .getState()
            .applyNewMessage(
              { ...tempMessage, status: "queued" } as any,
              userId,
            )
            .catch(() => {});
          useConversationsStore.getState().resetUnreadCount(conversationId);
          return;
        }

        try {
          let outgoingContent = content;
          let signature: string | undefined;
          let sender_public_key: string | undefined;
          if (e2eeEnabledRef.current) {
            const memberIds =
              conversation?.member_user_ids ||
              conversation?.members?.map((m: { user_id: string }) => m.user_id);
            const otherUserId = memberIds?.find((id: string) => id !== userId);
            if (conversation?.type !== "direct" || !otherUserId) {
              throw new Error("E2EE_UNSUPPORTED_CONVERSATION");
            }
            const enc = await E2EEService.encryptDirectTextMessage({
              conversationId,
              plaintext: content,
              clientRandom: tempMessage.client_random as number,
              recipientUserId: otherUserId,
            });
            outgoingContent = enc.content;
            signature = enc.signature;
            sender_public_key = enc.sender_public_key;
          }

          const sent = await messagingAPI.sendMessage(conversationId, {
            content: outgoingContent,
            message_type: "text",
            client_random: tempMessage.client_random as number,

            metadata: {},
            reply_to_id: replyToId,
            signature,
            sender_public_key,
          });

          setMessages((prev) => {
            const next: MessageWithRelations[] = prev.map((m) => {
              if (
                m.id.startsWith("temp-") &&
                m.client_random === tempMessage.client_random
              ) {
                const updated: MessageWithRelations = {
                  ...(sent as MessageWithRelations),
                  content,
                  status: "sent" as const,
                  reply_to: tempMessage.reply_to,
                };
                return updated;
              }
              return m;
            });
            return next;
          });
          useConversationsStore
            .getState()
            .applyNewMessage({ ...(sent as any), content } as any, userId)
            .catch(() => {});
          useConversationsStore.getState().resetUnreadCount(conversationId);
        } catch (error) {
          logger.error("ChatScreen", "Error sending message", error);
          setMessages((prev) => {
            return prev.map((m) => {
              if (m.id === tempMessage.id) {
                return { ...m, status: "failed" };
              }
              return m;
            });
          });
        }
      } finally {
        sendingRef.current = false;
      }
    },
    [
      conversationId,
      userId,
      conversation,
      sendTyping,
      editingMessage,
      replyingTo,
      connectionState,
    ],
  );

  const handleSendMedia = useCallback(
    async (
      uri: string,
      type: "image" | "video" | "file" | "audio",
      replyToId?: string,
      caption?: string,
      opts?: {
        skipGate?: boolean;
        duration?: number;
        mimeType?: string;
        filename?: string;
      },
    ) => {
      // Stop typing indicator
      sendTyping(conversationId, false);

      // Use caption if provided, otherwise use default text
      const messageContent = caption?.trim() || DEFAULT_MEDIA_CAPTION[type];

      // Derive filename and MIME type from the local URI
      const rawFilename = opts?.filename || uri.split("/").pop() || "media";
      const extension = rawFilename.split(".").pop()?.toLowerCase() || "";
      const rawMimeType = canonicalizeMimeType(
        opts?.mimeType || resolveMimeType(extension, type),
      );
      const { filename, mimeType } =
        type === "audio"
          ? forceAudioUploadIdentity(rawFilename, rawMimeType)
          : { filename: rawFilename, mimeType: rawMimeType };
      const uploadUri =
        type === "audio"
          ? await remapAudioUploadUri(uri, filename, mimeType)
          : uri;
      const audioDuration =
        type === "audio" && typeof opts?.duration === "number"
          ? Math.max(1, Math.round(opts.duration))
          : undefined;

      // Create optimistic message with local URI for instant preview
      const tempMessageId = `temp-${Date.now()}`;
      const tempMessage: MessageWithRelations = {
        id: tempMessageId,
        conversation_id: conversationId,
        sender_id: userId,
        message_type: "media",
        content: messageContent,
        metadata: {
          media_type: type,
          media_url: uploadUri,
          thumbnail_url: uploadUri,
          duration: audioDuration,
        },
        // crypto random Uint32 pour eviter birthday collision sur dedup serveur
        client_random: generateClientRandom(),
        sent_at: new Date().toISOString(),
        is_deleted: false,
        delete_for_everyone: false,
        status: "sending",
        reply_to_id: replyToId,
        reply_to: replyingTo || undefined,
        attachments: [
          {
            id: `att-temp-${Date.now()}`,
            message_id: tempMessageId,
            media_id: `media-temp-${Date.now()}`,
            media_type: type,
            metadata: {
              filename,
              media_url: uploadUri,
              thumbnail_url: uploadUri,
              mime_type: mimeType,
              duration: audioDuration,
            },
            created_at: new Date().toISOString(),
          },
        ],
      };

      setMessages((prev) => [tempMessage, ...prev]);
      setReplyingTo(null);
      useConversationsStore
        .getState()
        .applyNewMessage(tempMessage as any, userId)
        .catch(() => {});
      useConversationsStore.getState().resetUnreadCount(conversationId);

      // Scroll to bottom so the newly sent media message is visible
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);

      // Kick off the authoritative member fetch in parallel with the upload.
      // RLS on media-service requires the recipient to be in shared_with, so
      // we MUST have the right IDs before calling shareMedia. Starting this
      // fetch now hides the network round-trip behind upload latency.
      // Wrap into a settled-result promise so a rejection is never an
      // unhandled rejection if we exit early (gate block, upload error).
      const membersFetchSettled: Promise<{
        ok: boolean;
        value?: Array<{ id: string }>;
      }> = messagingAPI
        .getConversationMembers(conversationId)
        .then((value) => ({ ok: true, value }))
        .catch((err) => {
          logger.warn(
            "ChatScreen.handleSendMedia",
            "getConversationMembers failed; will fall back to in-memory IDs",
            err,
          );
          return { ok: false };
        });

      try {
        // Gate check: block inappropriate images / videos before upload.
        // gateChatVideoBeforeSend is a no-op when the selected moderation
        // model is v2 (which has no video training signal).
        if ((type === "image" || type === "video") && !opts?.skipGate) {
          const gateResult =
            type === "image"
              ? await gateChatImageBeforeSend(uploadUri)
              : await gateChatVideoBeforeSend(uploadUri);
          if (!gateResult.ok) {
            const blockedReason =
              gateResult.reason || "Contenu bloqué par la modération";
            // Keep message in chat but mark as blocked, and annotate
            // metadata so the bubble can offer a "Contester" action.
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempMessageId
                  ? {
                      ...m,
                      status: "failed" as const,
                      content: blockedReason,
                      metadata: {
                        ...(m.metadata || {}),
                        blockedByModeration: true,
                        blockReason: blockedReason,
                        scores: gateResult.scores,
                        localUri: uploadUri,
                      },
                    }
                  : m,
              ),
            );
            // Open the appeal modal so the user can contest immediately.
            setAppealModal({
              visible: true,
              imageUri: uploadUri,
              blockReason: blockedReason,
              scores: gateResult.scores,
              messageTempId: tempMessageId,
            });
            return;
          }
        }

        // 1. Upload file to media-service
        const uploadResult = await MediaService.uploadMedia({
          uri: uploadUri,
          name: filename,
          type: mimeType,
        });

        // Build metadata with the remote URLs from the upload result
        let resolvedDuration = audioDuration;
        if (type === "audio" && resolvedDuration == null) {
          resolvedDuration =
            (uploadResult as typeof uploadResult & { duration?: number })
              .duration ?? undefined;
          if (resolvedDuration == null) {
            try {
              const uploadedMetadata = await MediaService.getMediaMetadata(
                uploadResult.id,
              );
              if (typeof uploadedMetadata.duration === "number") {
                resolvedDuration = Math.max(
                  1,
                  Math.round(uploadedMetadata.duration),
                );
              }
            } catch (durationError) {
              console.warn(
                "[ChatScreen] Unable to fetch uploaded audio duration:",
                durationError,
              );
            }
          }
        }

        const mediaMetadata = {
          media_type: type,
          media_id: uploadResult.id,
          media_url: uploadResult.url,
          thumbnail_url: uploadResult.thumbnail_url || uploadResult.url,
          filename: uploadResult.filename || filename,
          mime_type: uploadResult.mime_type || mimeType,
          size: uploadResult.size,
          duration: resolvedDuration,
        };

        // Update optimistic message with remote URLs so preview uses the hosted image
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessageId
              ? {
                  ...msg,
                  metadata: mediaMetadata,
                  attachments: msg.attachments?.map((att) => ({
                    ...att,
                    media_id: uploadResult.id,
                    metadata: {
                      ...att.metadata,
                      media_url: uploadResult.url,
                      thumbnail_url:
                        uploadResult.thumbnail_url || uploadResult.url,
                      mime_type: uploadResult.mime_type || mimeType,
                      duration: resolvedDuration,
                    },
                  })),
                }
              : msg,
          ),
        );

        // 2. Share media with all conversation participants so they can access it.
        // The fetch was started before upload (see membersFetchSettled above)
        // so it has either already resolved or is about to.
        const fetchPromise: Promise<Array<{ id: string }>> =
          membersFetchSettled.then((r) => {
            if (!r.ok || !r.value) {
              throw new Error("getConversationMembers failed");
            }
            return r.value;
          });
        const { memberIds } = await resolveConversationMemberIds(
          {
            conversation,
            allConversations,
            conversationMembers,
            conversationId,
          },
          fetchPromise,
          {
            selfId: userId,
            fetchMembers: (id) => messagingAPI.getConversationMembers(id),
          },
        );

        if (memberIds.length === 0) {
          // No recipients found anywhere — surface this to the user, the
          // recipient will not be able to open the media without a share.
          logger.error(
            "ChatScreen.handleSendMedia",
            "No recipients resolved for conversation, media will be inaccessible",
            { conversationId, mediaId: uploadResult.id },
          );
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempMessageId
                ? {
                    ...msg,
                    metadata: {
                      ...(msg.metadata || {}),
                      shareWarning: true,
                    },
                  }
                : msg,
            ),
          );
          showAlert(
            "Partage du média",
            "Impossible de partager le média avec les destinataires. Ils ne pourront peut-être pas l'ouvrir.",
          );
        } else {
          try {
            await MediaService.shareMediaWithRetry(uploadResult.id, memberIds);
          } catch (err) {
            logger.error(
              "ChatScreen.handleSendMedia",
              "shareMedia failed after retries",
              err,
            );
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempMessageId
                  ? {
                      ...msg,
                      metadata: {
                        ...(msg.metadata || {}),
                        shareWarning: true,
                      },
                    }
                  : msg,
              ),
            );
            showAlert(
              "Partage du média",
              "Le média a été envoyé mais le partage a échoué. Le destinataire pourrait ne pas pouvoir l'ouvrir.",
            );
          }
        }

        // 3. Send message via messaging-service with remote media URLs
        const sentMessage = await messagingAPI.sendMessage(conversationId, {
          content: messageContent,
          message_type: "media",
          client_random: tempMessage.client_random as number,

          metadata: mediaMetadata,
          reply_to_id: replyToId,
        });

        // 4. Attach media record to the message (non-blocking — message already has metadata)
        messagingAPI
          .addAttachment(sentMessage.id, {
            media_id: uploadResult.id,
            media_type: type,
            metadata: {
              filename: uploadResult.filename || filename,
              size: uploadResult.size,
              mime_type: uploadResult.mime_type || mimeType,
              media_url: uploadResult.url,
              thumbnail_url: uploadResult.thumbnail_url || uploadResult.url,
              duration: resolvedDuration,
            },
          })
          .catch((err) =>
            console.warn(
              "[ChatScreen] addAttachment failed (non-blocking):",
              err,
            ),
          );

        // 5. Update optimistic message with the real server ID
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessageId
              ? {
                  ...msg,
                  id: sentMessage.id,
                  status: "sent" as const,
                }
              : msg,
          ),
        );
        useConversationsStore
          .getState()
          .applyNewMessage(sentMessage as any, userId)
          .catch(() => {});
        useConversationsStore.getState().resetUnreadCount(conversationId);
      } catch (error) {
        console.error("[ChatScreen] Error sending media:", error);
        // Keep message in chat with failed status and error indication
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessageId
              ? {
                  ...msg,
                  status: "failed" as const,
                  content: "Échec de l'envoi — appuyez pour réessayer",
                }
              : msg,
          ),
        );
      }
    },
    [
      conversationId,
      userId,
      sendTyping,
      replyingTo,
      conversation,
      allConversations,
      conversationMembers,
    ],
  );

  // Keep ref in sync so the WebSocket listener always calls the latest version
  useEffect(() => {
    handleSendMediaRef.current = handleSendMedia;
  });

  const handleScheduleSend = useCallback((messageText: string) => {
    setScheduleMessageText(messageText);
    setShowSchedulePicker(true);
  }, []);

  const handleScheduleConfirm = useCallback(
    async (date: Date) => {
      setShowSchedulePicker(false);
      if (!scheduleMessageText.trim()) return;

      try {
        await SchedulingService.createScheduledMessage({
          conversation_id: conversationId,
          content: scheduleMessageText.trim(),
          message_type: "text",
          scheduled_at: date.toISOString(),
        });
        logger.info(
          "ChatScreen",
          `Message scheduled for ${date.toISOString()}`,
        );
        Alert.alert(
          "Message programmé",
          "Votre message sera envoyé à l'heure prévue.",
        );
      } catch (error) {
        logger.error("ChatScreen", "Error scheduling message", error);
        Alert.alert(
          getLocalizedText("notif.error"),
          getLocalizedText("chat.errorScheduleMessage"),
        );
      }
      setScheduleMessageText("");
    },
    [conversationId, scheduleMessageText],
  );

  const handleScheduledPress = useCallback(() => {
    navigation.navigate("ScheduledMessages", { conversationId });
  }, [navigation, conversationId]);

  const handleInitiateCall = useCallback(
    async (type: "audio" | "video") => {
      if (!conversation) return;
      if (!callsAvailability.available) {
        setCallsToast({
          visible: true,
          message: getCallsUnavailableMessage(callsAvailability.reason),
          type: "warning",
        });
        return;
      }
      const displayName = getConversationDisplayName(conversation);
      const avatarUrl =
        conversation.type === "direct"
          ? conversationMembers.find((m) => m.id && m.id !== userId)
              ?.avatar_url || conversation.avatar_url
          : conversation.avatar_url ||
            (conversation.metadata ?? {}).avatar_url ||
            (conversation.metadata ?? {}).group_avatar_url ||
            (conversation.metadata ?? {}).group_icon_url ||
            (conversation.metadata ?? {}).icon_url ||
            (conversation.metadata ?? {}).photo_url ||
            (conversation.metadata ?? {}).picture_url ||
            (conversation.metadata ?? {}).image_url;
      const memberIds: string[] =
        conversation.member_user_ids ?? conversationMembers.map((m) => m.id);
      const participantIds = memberIds.filter((id) => id && id !== userId);
      try {
        await useCallsStore
          .getState()
          .initiate(
            conversationId,
            type,
            participantIds,
            displayName,
            avatarUrl,
          );
        const activeCall = useCallsStore.getState().active;
        if (activeCall) {
          await systemCallProvider.startOutgoingCall({
            callId: activeCall.callId,
            handle: conversationId,
            displayName,
            hasVideo: type === "video",
          });
        }
        navigation.navigate("InCall");
      } catch (err) {
        console.error("Failed to initiate call", err);
      }
    },
    [
      conversation,
      conversationMembers,
      conversationId,
      userId,
      navigation,
      callsAvailability,
    ],
  );

  const resolveReactorDisplayName = useCallback(
    (uid: string) => {
      if (uid === userId) return "Vous";
      const m = conversationMembers.find((x) => x.id === uid);
      if (m?.display_name) return m.display_name;
      return "Utilisateur";
    },
    [userId, conversationMembers],
  );

  const reactionModalList = useMemo(() => {
    if (!reactionReactorsModal) return [];
    const msg = messages.find((m) => m.id === reactionReactorsModal.messageId);
    return (msg?.reactions ?? []).filter(
      (r) => r.reaction === reactionReactorsModal.emoji,
    );
  }, [reactionReactorsModal, messages]);

  const handleReactionPress = useCallback(
    async (messageId: string, emoji: string) => {
      const validated = validateReactionEmoji(emoji);
      if (!validated.ok) {
        showAlert("Emoji non supporté", validated.reason);
        return;
      }

      const msg = messages.find((m) => m.id === messageId);
      const reactions = msg?.reactions ?? [];
      const already = userHasReaction(reactions, userId, emoji);

      try {
        if (already) {
          await messagingAPI.removeReaction(messageId, userId, emoji);
        } else {
          const limits = checkReactionLimits(reactions, userId, emoji);
          if (!limits.ok) {
            showAlert("Réaction impossible", limits.reason);
            return;
          }
          await messagingAPI.addReaction(messageId, userId, emoji);
        }

        const reactionData = await messagingAPI.getMessageReactions(messageId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  reactions: Array.isArray(reactionData)
                    ? reactionData
                    : reactionData?.reactions || [],
                }
              : m,
          ),
        );
      } catch (error: unknown) {
        const e = error as { message?: string };
        showAlert(
          "Réaction",
          e.message || "Impossible de mettre à jour la réaction.",
        );
        logger.error("ChatScreen", "Error toggling reaction", error);
      }
    },
    [userId, messages],
  );

  const handleReactionDetailsPress = useCallback(
    (messageId: string, emoji: string) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setReactionReactorsModal({ messageId, emoji });
    },
    [],
  );

  // Group messages by date and add date separators
  const messagesWithSeparators = useMemo(() => {
    if (messages.length === 0) return [];

    // messages is sorted newest-first (desc) for the inverted FlatList.
    // In an inverted list, index 0 renders at the bottom, so we need
    // date separators to appear AFTER (higher index = visually above)
    // the last message of each date group.
    const result: Array<ChatListItem> = [];

    messages.forEach((message, index) => {
      const messageDate = new Date(message.sent_at);
      const dateKey = messageDate.toDateString();

      result.push(message);

      // Look ahead: insert separator AFTER this message if the next
      // message belongs to a different date (or this is the last message).
      const nextMessage = messages[index + 1];
      const nextDateKey = nextMessage
        ? new Date(nextMessage.sent_at).toDateString()
        : null;

      if (nextDateKey !== dateKey) {
        result.push({
          type: "date",
          date: messageDate,
          id: `date-${dateKey}`,
        });
      }
    });

    return result;
  }, [messages]);

  // Id of the most recent message I sent — used to render a textual delivery
  // status only under that bubble. messages[] is sorted newest-first, so the
  // first entry whose sender_id matches mine is the latest one.
  const lastSentByMeId = useMemo(() => {
    if (!userId) return null;
    for (const m of messages) {
      if (m.sender_id === userId && m.message_type !== "system") {
        return m.id;
      }
    }
    return null;
  }, [messages, userId]);

  // Initial scroll to the newest message once the list has rendered content.
  // Using `scrollToIndex({ index: 0 })` (rather than `scrollToOffset`) is
  // important on react-native-web: the inverted list is implemented via a
  // CSS scaleY(-1) transform, so offset 0 is the *visual top* (oldest data),
  // not the bottom. Index-based scrolling stays consistent across platforms.
  useEffect(() => {
    if (initialScrollDoneRef.current || messagesWithSeparators.length === 0) {
      return;
    }
    initialScrollDoneRef.current = true;
    // Defer one frame so FlatList has finished laying out items.
    const id = setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({ index: 0, animated: false });
      } catch {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      }
    }, 0);
    return () => clearTimeout(id);
  }, [messagesWithSeparators.length]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const index = messagesWithSeparators.findIndex(
        (item) => !isDateSeparator(item) && item.id === messageId,
      );

      if (index !== -1 && flatListRef.current) {
        try {
          flatListRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5,
          });
        } catch (error) {
          logger.error(
            "ChatScreen",
            `Error scrolling to message ${messageId}`,
            error,
          );
        }
      } else {
        logger.warn(
          "ChatScreen",
          `Cannot scroll to message ${messageId} (index: ${index})`,
        );
      }
    },
    [messagesWithSeparators],
  );

  const handleReplyPress = useCallback(
    (messageId: string) => {
      scrollToMessage(messageId);
    },
    [scrollToMessage],
  );

  const handleMessageLongPress = useCallback(
    (message: MessageWithRelations) => {
      setSelectedMessage(message);
      setShowActionsMenu(true);
    },
    [],
  );

  const handleOpenReportSheet = useCallback(() => {
    if (selectedMessage) {
      setReportSheetMessage(selectedMessage);
      setShowReportSheet(true);
    }
  }, [selectedMessage]);

  const handleForwardMessage = useCallback(() => {
    if (selectedMessage) {
      setForwardingMessage(selectedMessage);
      setShowActionsMenu(false);
      setSelectedMessage(null);
      setShowForwardModal(true);
    }
  }, [selectedMessage]);

  const handleForwardSelect = useCallback(
    async (targetConversationIds: string[]) => {
      if (!forwardingMessage || targetConversationIds.length === 0) return;

      setForwardSending(true);
      try {
        await messagingAPI.forwardMessage(
          forwardingMessage.id,
          targetConversationIds,
        );
        setShowForwardModal(false);
        setForwardingMessage(null);
        setForwardSending(false);

        // If forwarded to a single target, navigate there so the user sees
        // the forwarded message. For multi-select stay in place.
        if (targetConversationIds.length === 1) {
          navigation.push("Chat", {
            conversationId: targetConversationIds[0],
          });
        }
      } catch (error) {
        logger.error("ChatScreen", "Error forwarding message", error);
        setForwardSending(false);
      }
    },
    [forwardingMessage, navigation],
  );

  const handleEditMessage = useCallback(() => {
    if (selectedMessage) {
      setEditingMessage(selectedMessage);
      setShowActionsMenu(false);
    }
  }, [selectedMessage]);

  const handleDeleteMessage = useCallback(
    async (deleteForEveryone: boolean) => {
      if (!selectedMessage) return;

      try {
        await messagingAPI.deleteMessage(
          selectedMessage.id,
          conversationId,
          deleteForEveryone,
        );

        if (deleteForEveryone) {
          // Update message to show "[Message supprimé]"
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === selectedMessage.id
                ? {
                    ...msg,
                    is_deleted: true,
                    delete_for_everyone: true,
                    content: "[Message supprimé]",
                  }
                : msg,
            ),
          );
        } else {
          // Remove from view
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== selectedMessage.id),
          );
        }
        useConversationsStore
          .getState()
          .applyMessageDeleted(selectedMessage.id, deleteForEveryone);
        await loadPinnedMessages();
      } catch (error) {
        logger.error("ChatScreen", "Error deleting message", error);
        Alert.alert(
          getLocalizedText("notif.error"),
          getLocalizedText("chat.errorDeleteMessage"),
        );
      }
    },
    [selectedMessage, conversationId, loadPinnedMessages],
  );

  const handleStartReply = useCallback(() => {
    if (selectedMessage) {
      setReplyingTo(selectedMessage);
      setShowActionsMenu(false);
    }
  }, [selectedMessage]);

  const handleStartReaction = useCallback(() => {
    if (selectedMessage) {
      setReactionPickerMessageId(selectedMessage.id);
      setShowReactionPicker(true);
      setShowActionsMenu(false);
    }
  }, [selectedMessage]);

  const handlePinMessage = useCallback(async () => {
    if (!selectedMessage) return;

    try {
      const isCurrentlyPinned = pinnedMessages.some(
        (m) => (m.messageId ?? m.message?.id) === selectedMessage.id,
      );
      const action = isCurrentlyPinned ? "unpin" : "pin";

      if (isCurrentlyPinned) {
        // Optimistically remove from the pinned bar so the banner disappears
        // immediately, even if the refresh below races the server.
        setPinnedMessages((prev) =>
          prev.filter(
            (m) => (m.messageId ?? m.message?.id) !== selectedMessage.id,
          ),
        );
        await messagingAPI.unpinMessage(conversationId, selectedMessage.id);
      } else {
        await messagingAPI.pinMessage(conversationId, selectedMessage.id);
        // Re-open the bar when the user just pinned a new message after
        // having manually closed it.
        setShowPinnedBar(true);
      }

      await loadPinnedMessages();

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === selectedMessage.id
            ? { ...msg, is_pinned: !isCurrentlyPinned }
            : msg,
        ),
      );
    } catch (error) {
      const isCurrentlyPinned = pinnedMessages.some(
        (m) => (m.messageId ?? m.message?.id) === selectedMessage.id,
      );
      logger.error(
        "ChatScreen",
        `Error ${isCurrentlyPinned ? "unpinning" : "pinning"} message`,
        error,
      );
    }
  }, [selectedMessage, conversationId, pinnedMessages, loadPinnedMessages]);

  const handlePinnedMessagePress = useCallback(
    (messageId: string) => {
      if (!messages.some((m) => m.id === messageId)) {
        logger.warn("ChatScreen", `Pinned message not found: ${messageId}`);
        return;
      }
      scrollToMessage(messageId);
    },
    [scrollToMessage, messages],
  );

  const handleReactionSelectFromPicker = useCallback(
    async (emoji: string) => {
      if (reactionPickerMessageId) {
        await handleReactionPress(reactionPickerMessageId, emoji);
        setShowReactionPicker(false);
        setReactionPickerMessageId(null);
      }
    },
    [reactionPickerMessageId, handleReactionPress],
  );

  // Handle search — try server-side first, fall back to client-side filtering
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);

      if (!query.trim()) {
        setSearchResults([]);
        setCurrentSearchIndex(0);
        return;
      }

      try {
        const trimmed = query.trim();
        const apiResults = e2eeEnabledRef.current
          ? null
          : await messagingAPI.searchMessages(conversationId, trimmed, {
              limit: 50,
            });

        let results: MessageWithRelations[];

        if (apiResults !== null) {
          // Server returned results — map them to MessageWithRelations
          results = apiResults
            .filter((msg) => msg.message_type !== "system" && !msg.is_deleted)
            .map((msg) => {
              const enriched = msg as MessageWithRelations;
              return {
                ...enriched,
                status: enriched.status || ("sent" as const),
              };
            });
        } else {
          // Fallback: client-side search on loaded messages
          results = messages.filter((msg) => {
            if (msg.message_type === "system" || msg.is_deleted) return false;
            if (!msg.content) return false;
            return msg.content.toLowerCase().includes(trimmed.toLowerCase());
          });
        }

        setSearchResults(results);
        setCurrentSearchIndex(0);

        // Scroll to first result after a short delay to ensure list is rendered
        if (results.length > 0 && flatListRef.current) {
          setTimeout(() => {
            const firstResultIndex = messagesWithSeparators.findIndex(
              (item) => !isDateSeparator(item) && item.id === results[0].id,
            );

            if (firstResultIndex !== -1 && flatListRef.current) {
              try {
                flatListRef.current.scrollToIndex({
                  index: firstResultIndex,
                  animated: true,
                  viewPosition: 0.5,
                });
              } catch (error) {
                logger.warn(
                  "ChatScreen",
                  "Error scrolling to search result",
                  error,
                );
              }
            }
          }, 100);
        }
      } catch (error) {
        logger.error("ChatScreen", "Error in search", error);
        setSearchResults([]);
        setCurrentSearchIndex(0);
      }
    },
    [conversationId, messages, messagesWithSeparators],
  );

  const handleSearchNext = useCallback(() => {
    if (
      currentSearchIndex < searchResults.length - 1 &&
      searchResults.length > 0
    ) {
      try {
        const newIndex = currentSearchIndex + 1;
        setCurrentSearchIndex(newIndex);
        const result = searchResults[newIndex];
        if (!result) {
          logger.warn(
            "ChatScreen",
            `Search result not found at index: ${newIndex}`,
          );
          return;
        }
        const resultIndex = messagesWithSeparators.findIndex(
          (item) => !isDateSeparator(item) && item.id === result.id,
        );
        if (resultIndex !== -1 && flatListRef.current) {
          try {
            flatListRef.current.scrollToIndex({
              index: resultIndex,
              animated: true,
              viewPosition: 0.5,
            });
          } catch (error) {
            logger.warn(
              "ChatScreen",
              "Error scrolling to next search result",
              error,
            );
          }
        } else {
          logger.warn(
            "ChatScreen",
            `Search result not found in messages list: ${result.id}`,
          );
        }
      } catch (error) {
        logger.error("ChatScreen", "Error in handleSearchNext", error);
      }
    }
  }, [currentSearchIndex, searchResults, messagesWithSeparators]);

  const handleSearchPrevious = useCallback(() => {
    if (currentSearchIndex > 0 && searchResults.length > 0) {
      try {
        const newIndex = currentSearchIndex - 1;
        setCurrentSearchIndex(newIndex);
        const result = searchResults[newIndex];
        if (!result) {
          logger.warn(
            "ChatScreen",
            `Search result not found at index: ${newIndex}`,
          );
          return;
        }
        const resultIndex = messagesWithSeparators.findIndex(
          (item) => !isDateSeparator(item) && item.id === result.id,
        );
        if (resultIndex !== -1 && flatListRef.current) {
          try {
            flatListRef.current.scrollToIndex({
              index: resultIndex,
              animated: true,
              viewPosition: 0.5,
            });
          } catch (error) {
            logger.warn(
              "ChatScreen",
              "Error scrolling to previous search result",
              error,
            );
          }
        } else {
          logger.warn(
            "ChatScreen",
            `Search result not found in messages list: ${result.id}`,
          );
        }
      } catch (error) {
        logger.error("ChatScreen", "Error in handleSearchPrevious", error);
      }
    }
  }, [currentSearchIndex, searchResults, messagesWithSeparators]);

  // Derive the other user's presence for direct conversations
  const otherUserId = useMemo(() => {
    if (conversation?.type !== "direct") return undefined;
    return conversation.member_user_ids?.find((id: string) => id !== userId);
  }, [conversation, userId]);
  const isOtherOnline = otherUserId ? onlineUserIds.has(otherUserId) : false;
  const otherLastSeenAt = otherUserId ? lastSeenAt[otherUserId] : undefined;

  // Count online members for group conversations
  const onlineMemberCount = useMemo(() => {
    if (conversation?.type !== "group") return 0;
    const memberIds: string[] =
      conversation.member_user_ids ?? conversationMembers.map((m) => m.id);
    return memberIds.filter((id) => id !== userId && onlineUserIds.has(id))
      .length;
  }, [conversation, conversationMembers, onlineUserIds, userId]);

  const handleInfoPress = useCallback(() => {
    if (conversation?.type === "group") {
      // Ensure modal is closed before navigating
      setShowInfoModal(false);
      const groupId = conversation.id;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Use setTimeout to ensure modal is closed before navigation
      setTimeout(() => {
        navigation.navigate("GroupDetails", {
          groupId,
          conversationId: conversation.id,
          conversationName: getConversationDisplayName(conversation),
        });
      }, 0);
    } else {
      setShowInfoModal(true);
    }
  }, [conversation, navigation]);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatListItem; index: number }) => {
      // Check if it's a date separator
      if (isDateSeparator(item)) {
        return <DateSeparator date={item.date} />;
      }

      const message = item;

      // Handle system messages
      if (message.message_type === "system") {
        return <SystemMessage content={message.content} />;
      }

      const isSent = message.sender_id === userId;
      const isLastSentByMe = isSent && message.id === lastSentByMeId;
      const isHighlighted = Boolean(
        searchQuery.trim() && searchResults.some((r) => r.id === message.id),
      );

      const isGroup = conversation?.type === "group";
      // Resolve sender info for group conversations.
      const sender =
        !isSent && isGroup
          ? conversationMembers.find((m) => m.id === message.sender_id)
          : undefined;
      const senderName = sender?.display_name || sender?.username;
      const senderAvatarUrl = sender?.avatar_url;

      // Inverted FlatList: newer messages have lower indices. The item that
      // visually appears above the current one is messagesWithSeparators[index + 1].
      // Consider the message "consecutive" when the previous (older, visually
      // above) item is from the same sender — in that case we hide the avatar
      // to keep bursts compact.
      let isConsecutive = false;
      if (!isSent && isGroup) {
        const prev = messagesWithSeparators[index + 1];
        if (
          prev &&
          !isDateSeparator(prev) &&
          prev.sender_id === message.sender_id &&
          prev.message_type !== "system"
        ) {
          isConsecutive = true;
        }
      }

      // iMessage convention: only the last bubble in a same-sender burst
      // carries a tail. The message that comes chronologically AFTER this
      // one (visually BELOW it in the inverted list, so index - 1) is the
      // one we compare against. If it's from the same sender, we are not
      // the last in the burst and the tail is suppressed.
      let isLastInBurst = true;
      const next = messagesWithSeparators[index - 1];
      if (
        next &&
        !isDateSeparator(next) &&
        next.sender_id === message.sender_id &&
        next.message_type !== "system"
      ) {
        isLastInBurst = false;
      }

      return (
        <MessageBubble
          message={message}
          isSent={isSent}
          currentUserId={userId}
          senderName={senderName}
          senderAvatarUrl={senderAvatarUrl}
          showSenderAvatar={!isSent && isGroup}
          isConsecutive={isConsecutive}
          isLastInBurst={isLastInBurst}
          onReactionPress={handleReactionPress}
          onReactionDetailsPress={handleReactionDetailsPress}
          resolveReactorName={resolveReactorDisplayName}
          onReplyPress={handleReplyPress}
          onLongPress={() => handleMessageLongPress(message)}
          isHighlighted={isHighlighted}
          searchQuery={searchQuery}
          pendingAppeal={pendingAppeals[message.id]}
          isLastSentByMe={isLastSentByMe}
          isGroupConversation={isGroup}
          otherMembersCount={Math.max(0, conversationMembers.length - 1)}
          resolveMemberName={resolveReactorDisplayName}
          onContest={(m) => {
            // metadata is already Record<string, any>; no cast needed
            const meta = m.metadata || {};
            setAppealModal({
              visible: true,
              imageUri: meta.localUri || "",
              blockReason: meta.blockReason,
              scores: meta.scores,
              messageTempId: m.id,
            });
          }}
        />
      );
    },
    [
      userId,
      conversation,
      conversationMembers,
      handleReactionPress,
      handleReactionDetailsPress,
      resolveReactorDisplayName,
      handleReplyPress,
      handleMessageLongPress,
      searchQuery,
      searchResults,
      pendingAppeals,
      messagesWithSeparators,
      lastSentByMeId,
    ],
  );

  const keyExtractor = useCallback(
    (item: ChatListItem) => (isDateSeparator(item) ? item.id : item.id),
    [],
  );

  const headerAvatarUrl = useMemo(() => {
    if (!conversation) return undefined;

    if (conversation.type === "direct") {
      const other = conversationMembers.find((m) => m.id && m.id !== userId);
      return other?.avatar_url || conversation.avatar_url;
    }

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
  }, [conversation, conversationMembers, userId]);

  return (
    <View
      style={[
        styles.screenRoot,
        hasCustomBackground && styles.screenRootWithCustomBackground,
        Platform.OS === "web" && { minHeight: 0, height: "100%" },
      ]}
    >
      {hasCustomBackground && customBackgroundUri ? (
        <ImageBackground
          key={`${customBackgroundUri}:${customBackgroundVersion}`}
          source={{ uri: customBackgroundUri }}
          resizeMode="cover"
          style={styles.customBackground}
        />
      ) : null}
      {!hasCustomBackground ? (
        <LinearGradient
          colors={colors.background.gradient.app}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          styles.backgroundScrim,
          hasCustomBackground
            ? styles.backgroundScrimWithCustomImage
            : styles.backgroundScrimDefault,
        ]}
      />
      <SafeAreaView
        style={[
          styles.container,
          Platform.OS === "web" && { minHeight: 0, height: "100%" },
        ]}
        // bottom inset is consumed by MessageInput itself (applySafeAreaBottom)
        // so the BlurView/overlay extends fully to the screen edge instead of
        // leaving an empty band between the composer and the home indicator.
        edges={["top"]}
      >
        <OfflineBanner connectionState={connectionState} />
        <ChatHeader
          conversationName={
            conversation
              ? getConversationDisplayName(conversation)
              : "Conversation"
          }
          avatarUrl={headerAvatarUrl}
          conversationType={conversation?.type || "direct"}
          groupAvatars={
            conversation?.type === "group"
              ? conversationMembers
                  .filter((m) => m.id && m.id !== userId)
                  .slice(0, 2)
                  .map((m) => ({
                    uri: m.avatar_url,
                    name: m.display_name || m.username || "Utilisateur",
                  }))
              : undefined
          }
          isOnline={isOtherOnline}
          lastSeenAt={otherLastSeenAt}
          onlineMemberCount={onlineMemberCount}
          typingNames={typingUsers
            .map((id) => typingUsersNames[id])
            .filter(Boolean)}
          onTitlePress={handleInfoPress}
          onAudioCallPress={() => handleInitiateCall("audio")}
          onVideoCallPress={() => handleInitiateCall("video")}
          callsAvailable={callsAvailability.available}
        />
        {isOtherUserContact === false && (
          <View style={styles.notContactBanner}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={colors.text.light}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.notContactBannerText} numberOfLines={1}>
              Cette personne n'est pas dans vos contacts
            </Text>
            <TouchableOpacity
              onPress={handleAddContactFromChat}
              disabled={addingContact}
              style={styles.notContactBannerButton}
            >
              {addingContact ? (
                // wrapper pour annoncer l'etat busy au screen reader
                <View
                  accessibilityState={{ busy: true }}
                  accessibilityLiveRegion="polite"
                >
                  <ActivityIndicator size="small" color={colors.text.light} />
                </View>
              ) : (
                <Text style={styles.notContactBannerButtonText}>Ajouter</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        {showPinnedBar && pinnedMessages.length > 0 && (
          <PinnedMessagesBar
            pinnedMessages={pinnedMessages}
            onMessagePress={handlePinnedMessagePress}
            onClose={() => setShowPinnedBar(false)}
          />
        )}
        {(() => {
          // Contenu partagé web / natif — extrait pour que le wrapper soit
          // branché conditionnellement sans dupliquer le JSX.
          const messageList = (
            <FlatList
              ref={flatListRef}
              data={messagesWithSeparators}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              inverted
              contentContainerStyle={styles.listContent}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={15}
              windowSize={10}
              onEndReached={loadMoreMessages}
              onEndReachedThreshold={0.3}
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
              }}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={handleViewableItemsChanged}
              keyboardShouldPersistTaps="handled"
              // Dismiss the keyboard as the user drags the message list. iOS
              // gets the interactive variant (clavier qui descend avec le doigt) ;
              // Android n'a pas d'équivalent natif, on reste sur "on-drag".
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              // Web : on absolute-positionne la FlatList à l'intérieur du
              // wrapper `webListViewport` (qui est `position: relative`). Ça
              // donne à la VirtualizedList une boîte de taille définie sans
              // dépendre du flex layout, indispensable pour que Chrome accepte
              // de scroller sur la molette quand `inverted` est actif.
              style={
                Platform.OS === "web" ? styles.webFlatListAbsolute : undefined
              }
              ListEmptyComponent={
                !loading ? (
                  <View style={{ transform: [{ scaleY: -1 }], flex: 1 }}>
                    <EmptyChatState />
                  </View>
                ) : null
              }
              ListFooterComponent={
                loadingMore ? (
                  <View
                    style={styles.loadingMore}
                    accessibilityState={{ busy: true }}
                    accessibilityLiveRegion="polite"
                  >
                    <ActivityIndicator
                      size="small"
                      color={themeColors.primary}
                    />
                  </View>
                ) : null
              }
            />
          );
          // Sur web, on emballe la FlatList dans un viewport à overflow borné :
          // ainsi Chrome garde le wheel sur la ScrollView interne (scrollable)
          // sans qu'un overflow:hidden sur un ancêtre bloque l'event en amont.
          // Tap on an empty area of the message list dismisses the keyboard.
          // onStartShouldSetResponder only fires when no child grabs the touch
          // first (message bubbles, action handlers, etc.), so this won't
          // hijack interactions on actual content.
          const dismissKeyboardResponderProps = {
            onStartShouldSetResponder: () => true,
            onResponderRelease: () => Keyboard.dismiss(),
          };
          const wrappedList =
            Platform.OS === "web" ? (
              <View
                style={styles.webListViewport}
                {...dismissKeyboardResponderProps}
              >
                {messageList}
              </View>
            ) : (
              <GestureDetector gesture={swipeGesture}>
                <View style={{ flex: 1 }} {...dismissKeyboardResponderProps}>
                  {messageList}
                </View>
              </GestureDetector>
            );
          const chatBody = (
            <>
              <MessageSwipeProvider translateX={swipeTranslateX}>
                {wrappedList}
              </MessageSwipeProvider>

              {typingUsers.length > 0 && (
                <View style={styles.typingContainer}>
                  <TypingIndicator
                    userNames={typingUsers.map(
                      (id) => typingUsersNames[id] || "Quelqu'un",
                    )}
                  />
                </View>
              )}
              <MessageInput
                onSend={handleSendMessage}
                onSendMedia={handleSendMedia}
                onScheduleSend={handleScheduleSend}
                onTyping={(typing) => sendTyping(conversationId, typing)}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                editingMessage={editingMessage}
                onCancelEdit={() => setEditingMessage(null)}
                conversationType={conversation?.type || "direct"}
                members={conversationMembers}
                applySafeAreaBottom
              />
            </>
          );

          // Web : KeyboardAvoidingView (behavior="height") recalcule la hauteur
          // en fonction du clavier virtuel inexistant en navigateur, ce qui
          // finit par réduire le container à 0 px → MessageInput invisible et
          // chat non scrollable. On remplace par un simple View flex:1.
          // Natif (iOS/Android) : comportement inchangé, KeyboardAvoidingView
          // reste nécessaire pour le clavier physique.
          if (Platform.OS === "web") {
            // Web layout : on garde `overflow:hidden` sur un wrapper dédié
            // autour de la FlatList (et plus sur le conteneur externe), pour
            // borner le viewport de scroll sans capturer l'event wheel en
            // amont. Mettre overflow:hidden sur le wrapper extérieur faisait
            // que Chrome routait la molette vers cet élément non-scrollable,
            // bloquant totalement le scroll sur l'inverted FlatList.
            return (
              <View
                style={[
                  styles.keyboardView,
                  {
                    minHeight: 0,
                    flexDirection: "column",
                  },
                ]}
              >
                {chatBody}
              </View>
            );
          }
          return (
            <KeyboardAvoidingView
              style={styles.keyboardView}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
            >
              {chatBody}
            </KeyboardAvoidingView>
          );
        })()}
        <MessageActionsMenu
          visible={showActionsMenu}
          message={selectedMessage}
          isSent={selectedMessage?.sender_id === userId}
          isPinned={pinnedMessages.some(
            (m) => (m.messageId ?? m.message?.id) === selectedMessage?.id,
          )}
          onClose={() => {
            setShowActionsMenu(false);
            setSelectedMessage(null);
          }}
          onReply={handleStartReply}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
          onReact={handleStartReaction}
          onPin={handlePinMessage}
          onForward={handleForwardMessage}
          onReport={handleOpenReportSheet}
        />
        <ReportMessageSheet
          visible={showReportSheet}
          message={reportSheetMessage}
          conversationId={conversationId}
          conversationTitle={
            conversation
              ? getConversationDisplayName(conversation)
              : "Conversation"
          }
          onClose={() => {
            setShowReportSheet(false);
            setReportSheetMessage(null);
          }}
        />
        <ForwardMessageModal
          visible={showForwardModal}
          conversations={allConversations}
          currentConversationId={conversationId}
          sending={forwardSending}
          onClose={() => {
            setShowForwardModal(false);
            setForwardingMessage(null);
          }}
          onSelect={handleForwardSelect}
        />
        {showReactionPicker && (
          <ReactionPicker
            visible={showReactionPicker}
            onClose={() => {
              setShowReactionPicker(false);
              setReactionPickerMessageId(null);
            }}
            onReactionSelect={handleReactionSelectFromPicker}
          />
        )}
        <ReactionReactorsModal
          visible={reactionReactorsModal !== null}
          emoji={reactionReactorsModal?.emoji ?? ""}
          reactors={reactionModalList}
          resolveName={resolveReactorDisplayName}
          onClose={() => setReactionReactorsModal(null)}
        />
        {appealModal ? (
          <BlockedImageAppealModal
            visible={appealModal.visible}
            onClose={() =>
              setAppealModal((prev) =>
                prev ? { ...prev, visible: false } : prev,
              )
            }
            imageUri={appealModal.imageUri}
            blockReason={appealModal.blockReason}
            scores={appealModal.scores}
            messageTempId={appealModal.messageTempId}
            conversationId={conversationId}
            recipientId={
              conversation?.type === "direct"
                ? (
                    conversation.member_user_ids ||
                    conversation.members?.map(
                      (m: { user_id: string }) => m.user_id,
                    )
                  )?.find((id: string) => id !== userId)
                : undefined
            }
          />
        ) : null}
        <MessageSearch
          visible={showSearch}
          onClose={() => {
            setShowSearch(false);
            setSearchQuery("");
            setSearchResults([]);
          }}
          onSearch={handleSearch}
          resultsCount={searchResults.length}
          currentIndex={currentSearchIndex}
          onNext={handleSearchNext}
          onPrevious={handleSearchPrevious}
        />
        <ScheduleDateTimePicker
          visible={showSchedulePicker}
          onClose={() => {
            setShowSchedulePicker(false);
            setScheduleMessageText("");
          }}
          onConfirm={handleScheduleConfirm}
        />
        <Modal
          visible={showInfoModal && conversation?.type !== "group"}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => {
            setShowInfoModal(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <LinearGradient
                colors={colors.background.gradient.app}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalGradient}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Informations de la conversation
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowInfoModal(false);
                    }}
                    style={styles.closeButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={colors.text.light}
                    />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.modalBody}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.infoSectionMain}>
                    <Avatar
                      size={80}
                      uri={conversation?.avatar_url}
                      name={
                        conversation
                          ? getConversationDisplayName(conversation)
                          : "Contact"
                      }
                      showOnlineBadge={conversation?.type === "direct"}
                      isOnline={false}
                    />
                    <Text style={styles.infoName}>
                      {conversation
                        ? getConversationDisplayName(conversation)
                        : "Contact"}
                    </Text>
                    {conversation?.type === "direct" && (
                      <Text style={styles.infoStatus}>Hors ligne</Text>
                    )}
                  </View>
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>TYPE</Text>
                    <Text style={styles.infoValue}>
                      {conversation?.type === "group"
                        ? "Groupe"
                        : "Conversation directe"}
                    </Text>
                  </View>
                  {conversation?.type === "direct" ? (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>CONFIDENTIALITÉ</Text>
                      <View style={styles.infoToggleRow}>
                        <Text style={styles.infoValue}>Chiffrement E2E</Text>
                        <Switch
                          value={e2eeEnabled}
                          onValueChange={handleToggleE2EE}
                          disabled={e2eeToggleBusy}
                          trackColor={{
                            false: "rgba(255, 255, 255, 0.15)",
                            true: colors.primary.main,
                          }}
                          thumbColor={colors.text.light}
                        />
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>MESSAGES</Text>
                    <Text style={styles.infoValue}>
                      {messages.length} message{messages.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View style={styles.infoSectionActions}>
                    <Text style={styles.infoLabel}>ACTIONS</Text>
                    <TouchableOpacity
                      style={styles.infoActionRow}
                      onPress={() => {
                        setShowInfoModal(false);
                        setShowSearch(true);
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Rechercher dans la conversation"
                    >
                      <Ionicons
                        name="search"
                        size={20}
                        color={colors.text.light}
                        style={styles.infoActionIcon}
                      />
                      <Text style={styles.infoActionLabel}>
                        Rechercher des messages
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={withOpacity(colors.text.light, 0.4)}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.infoActionRow}
                      onPress={() => {
                        setShowInfoModal(false);
                        handleScheduledPress();
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Messages programmés"
                    >
                      <Ionicons
                        name="timer-outline"
                        size={20}
                        color={colors.text.light}
                        style={styles.infoActionIcon}
                      />
                      <Text style={styles.infoActionLabel}>
                        Messages programmés
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={withOpacity(colors.text.light, 0.4)}
                      />
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </LinearGradient>
            </View>
          </View>
        </Modal>
        <Toast
          visible={callsToast.visible}
          message={callsToast.message}
          type={callsToast.type}
          duration={4000}
          onHide={() => setCallsToast((t) => ({ ...t, visible: false }))}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  screenRootWithCustomBackground: {
    backgroundColor: "transparent",
  },
  customBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.dark,
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundScrimDefault: {
    backgroundColor: "rgba(3, 8, 27, 0.18)",
  },
  backgroundScrimWithCustomImage: {
    backgroundColor: "rgba(5, 8, 22, 0.62)",
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  keyboardView: {
    flex: 1,
  },
  notContactBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 8,
  },
  notContactBannerText: {
    flex: 1,
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
  },
  notContactBannerButton: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 8,
  },
  notContactBannerButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    paddingVertical: 16,
  },
  webListViewport: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    // `position: relative` permet à la FlatList interne d'utiliser
    // `position: absolute, inset: 0` pour s'imposer une hauteur définie : sans
    // ça, `flex: 1, minHeight: 0` seul ne suffit pas à react-native-web pour
    // donner une bordure de scroll à un VirtualizedList inversé. Conséquence :
    // la ScrollView interne grandit avec le contenu et la molette n'a rien à
    // scroller.
    position: "relative",
  },
  webFlatListAbsolute: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 0,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: "center",
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    overflow: "hidden",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopColor: withOpacity(colors.primary.main, 0.2),
    borderLeftColor: withOpacity(colors.primary.main, 0.1),
    borderRightColor: withOpacity(colors.primary.main, 0.1),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  modalGradient: {
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.2),
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.text.light,
    flex: 1,
  },
  closeButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: withOpacity(colors.background.dark, 0.4),
    borderWidth: 1,
    borderColor: withOpacity(colors.ui.divider, 0.2),
  },
  modalBody: {
    padding: 24,
  },
  infoSectionMain: {
    alignItems: "center",
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.15),
  },
  infoName: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.light,
    marginTop: 16,
    letterSpacing: -0.5,
  },
  infoStatus: {
    fontSize: 14,
    color: withOpacity(colors.text.light, 0.6),
    marginTop: 6,
    fontWeight: "500",
  },
  infoSection: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.1),
  },
  infoLabel: {
    fontSize: 11,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: withOpacity(colors.text.light, 0.5),
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text.light,
    letterSpacing: 0.2,
  },
  infoToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  infoSectionActions: {
    marginBottom: 24,
  },
  infoActionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: withOpacity(colors.text.light, 0.06),
    borderRadius: 12,
    marginBottom: 8,
  },
  infoActionIcon: {
    marginRight: 14,
  },
  infoActionLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.text.light,
    fontWeight: "500",
  },
});
