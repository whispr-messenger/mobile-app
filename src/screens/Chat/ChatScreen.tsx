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
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
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
import { contactsAPI } from "../../services/contacts/api";
import { TokenService } from "../../services/TokenService";
import { useWebSocket } from "../../hooks/useWebSocket";
import { MessageBubble } from "../../components/Chat/MessageBubble";
import { MessageInput } from "../../components/Chat/MessageInput";
import { TypingIndicator } from "../../components/Chat/TypingIndicator";
import { Avatar } from "../../components/Chat/Avatar";
import { MessageActionsMenu } from "../../components/Chat/MessageActionsMenu";
import { ReportMessageSheet } from "../../components/Chat/ReportMessageSheet";
import { ForwardMessageModal } from "../../components/Chat/ForwardMessageModal";
import { useConversationsStore } from "../../store/conversationsStore";
import { ReactionPicker } from "../../components/Chat/ReactionPicker";
import { ReactionReactorsModal } from "../../components/Chat/ReactionReactorsModal";
import { DateSeparator } from "../../components/Chat/DateSeparator";
import { SystemMessage } from "../../components/Chat/SystemMessage";
import { MessageSearch } from "../../components/Chat/MessageSearch";
import { PinnedMessagesBar } from "../../components/Chat/PinnedMessagesBar";
import { EmptyChatState } from "../../components/Chat/EmptyChatState";
import { ChatHeader } from "./ChatHeader";
import { usePresenceStore } from "../../store/presenceStore";
import { AuthStackParamList } from "../../navigation/AuthNavigator";
import { colors, withOpacity } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { logger } from "../../utils/logger";
import { MediaService } from "../../services/MediaService";
import { SchedulingService } from "../../services/SchedulingService";
import { gateChatImageBeforeSend } from "../../services/moderation";
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

type ChatScreenRouteProp = StackScreenProps<
  AuthStackParamList,
  "Chat"
>["route"];
type ChatScreenNavigationProp = StackNavigationProp<AuthStackParamList, "Chat">;

export const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { conversationId } = route.params;
  const [conversation, setConversation] = useState<Conversation | null>(null);
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
  const [conversationMembers, setConversationMembers] = useState<
    Array<{ id: string; display_name: string; username?: string }>
  >([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingMessage, setForwardingMessage] =
    useState<MessageWithRelations | null>(null);
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
  const conversationChannelRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);
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
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

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
    onNewMessage: (message: Message) => {
      if (message.conversation_id === conversationId) {
        setMessages((prev) => {
          // Check if message already exists (avoid duplicates)
          if (prev.some((m) => m.id === message.id)) {
            return prev.map((m) =>
              m.id === message.id
                ? {
                    ...message,
                    // Preserve attachments from the optimistic message when the
                    // WebSocket echo doesn't carry them (server Message has no
                    // attachments array).
                    attachments:
                      (message as any).attachments ||
                      (m as MessageWithRelations).attachments,
                    status: (message as any).status || ("sent" as const),
                  }
                : m,
            );
          }
          // Replace optimistic message if it matches client_random
          const optimisticMessageIndex = prev.findIndex(
            (m) =>
              m.id.startsWith("temp-") &&
              m.client_random === message.client_random,
          );
          if (optimisticMessageIndex !== -1) {
            const existing = prev[
              optimisticMessageIndex
            ] as MessageWithRelations;
            const newMessages = [...prev];
            newMessages[optimisticMessageIndex] = {
              ...message,
              // Preserve attachments from the optimistic message
              attachments: (message as any).attachments || existing.attachments,
              status: (message as any).status || ("sent" as const),
            };
            return newMessages;
          }
          return [
            {
              ...message,
              status: (message as any).status || ("sent" as const),
            },
            ...prev,
          ];
        });
        // Mark as read if chat is open
        markAsRead(conversationId, message.id);
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
      if (message.conversation_id === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === message.id
              ? { ...msg, ...message, edited_at: message.edited_at }
              : msg,
          ),
        );
      }
    },
    onMessageDeleted: (
      messageId: string,
      deleteForEveryone: boolean | string,
    ) => {
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
        setTypingUsers((prev) => {
          if (typing) {
            if (prev.includes(typingUserId)) return prev;
            // Fetch user name when user starts typing
            messagingAPI.getUserInfo(typingUserId).then((userInfo) => {
              if (userInfo) {
                setTypingUsersNames((prevNames) => ({
                  ...prevNames,
                  [typingUserId]: userInfo.display_name,
                }));
              }
            });
            return [...prev, typingUserId];
          } else {
            return prev.filter((id) => id !== typingUserId);
          }
        });

        // Auto-clear typing after 5s if no follow-up event
        if (typing) {
          typingTimeoutsRef.current[typingUserId] = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((id) => id !== typingUserId));
            delete typingTimeoutsRef.current[typingUserId];
          }, 5000);
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
            const sent = await messagingAPI.sendMessage(conversationId, {
              content: queued.content,
              message_type: queued.message_type,
              client_random: queued.client_random,
              metadata: {},
              reply_to_id: queued.reply_to_id,
            });
            // Replace queued message with sent one
            setMessages((prev) =>
              prev.map((m) =>
                m.client_random === queued.client_random
                  ? { ...(sent as any), status: "sent" }
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
  }, [connectionState, conversationId]);

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

      // Resolve display name for direct conversations
      // The detail endpoint returns members array, not member_user_ids
      const memberIds =
        conv.member_user_ids ||
        conv.members?.map((m: { user_id: string }) => m.user_id);
      if (conv.type === "direct" && !conv.display_name && memberIds) {
        conv.member_user_ids = memberIds;
        const otherUserId = memberIds.find((id: string) => id !== userId);
        if (otherUserId) {
          try {
            const userInfo = await messagingAPI.getUserInfo(otherUserId);
            if (userInfo) {
              conv.display_name = userInfo.display_name;
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

  useEffect(() => {
    // Load data
    initialScrollDoneRef.current = false;
    loadConversation();
    loadMessages();
    loadPinnedMessages();

    // Join conversation channel once token is available
    if (token) {
      const { channel, cleanup } = joinConversationChannel(conversationId);
      conversationChannelRef.current = channel;

      return () => {
        cleanup();
        channel?.leave();
        Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
        typingTimeoutsRef.current = {};
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, token]);

  // Listen for admin decisions on blocked-image appeals.
  // On approve: re-submit the original image bypassing the gate.
  // On reject: annotate the bubble so the user sees "Refusée par l'admin".
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

      const current =
        useModerationStore.getState().pendingAppeals[messageTempId];
      handleAppealDecision({ messageTempId, decision });

      if (decision === "approved" && current?.localUri) {
        // Re-submit bypassing the gate, then cleanup.
        handleSendMedia(current.localUri, "image", undefined, undefined, {
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
                  } as any,
                  content: "Refusée par l'admin",
                }
              : m,
          ),
        );
        cleanupAppeal(messageTempId).catch(() => {});
      }
    };
    channel.on("blocked_image_decision", onDecision);
    return () => {
      channel.off("blocked_image_decision", onDecision);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
      showAlert("Demande envoyée", "Votre demande de contact a été envoyée.");
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
          limit: 50,
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
              // Derive delivery status: prefer explicit status, then check delivery_statuses array
              let status: "sending" | "sent" | "delivered" | "read" | "failed" =
                (msg as any)?.status || ("sent" as const);
              if (
                status === "sent" &&
                (msg as any)?.delivery_statuses?.length
              ) {
                const ds = (msg as any).delivery_statuses;
                if (ds.some((d: any) => d.read_at)) {
                  status = "read";
                } else if (ds.some((d: any) => d.delivered_at)) {
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

              // Find reply_to message if exists (search in current batch only)
              let replyTo: Message | undefined;
              if (msg.reply_to_id) {
                // Search in current batch
                replyTo = data.find((m) => m.id === msg.reply_to_id);
              }

              return {
                ...msg,
                status,
                reactions,
                attachments,
                reply_to: replyTo,
              } as MessageWithRelations;
            }),
        );

        if (before) {
          // Loading older messages — merge, deduplicate and re-sort desc
          // so the inverted FlatList always renders newest at bottom.
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const deduped = messagesWithRelations.filter(
              (m) => !existingIds.has(m.id),
            );
            return [...prev, ...deduped].sort(
              (a, b) =>
                new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
            );
          });
          setHasMore(messagesWithRelations.length === 50);
        } else {
          // Initial load — merge with any messages already received via WS
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const msg of messagesWithRelations) {
              if (!existingIds.has(msg.id)) {
                merged.push(msg);
              }
            }
            return merged.sort(
              (a, b) =>
                new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
            );
          });
          setHasMore(messagesWithRelations.length === 50);
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
      // Stop typing indicator
      sendTyping(conversationId, false);

      // If editing, update the message
      if (editingMessage) {
        try {
          const updated = await messagingAPI.editMessage(
            editingMessage.id,
            conversationId,
            content,
          );
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === editingMessage.id
                ? { ...msg, ...updated, edited_at: updated.edited_at }
                : msg,
            ),
          );
          setEditingMessage(null);
        } catch (error) {
          logger.error("ChatScreen", "Error editing message", error);
          Alert.alert("Erreur", "Impossible de modifier le message");
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
        client_random: Math.floor(Math.random() * 1000000),
        sent_at: new Date().toISOString(),
        is_deleted: false,
        delete_for_everyone: false,
        status: "sending",
        reply_to_id: replyToId,
        reply_to: replyingTo || undefined,
      };

      setMessages((prev) => [tempMessage, ...prev]);
      setReplyingTo(null);

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
            m.id === tempMessage.id ? { ...m, status: "queued" as any } : m,
          ),
        );
        return;
      }

      try {
        const sent = await messagingAPI.sendMessage(conversationId, {
          content,
          message_type: "text",
          client_random: tempMessage.client_random as number,

          metadata: {},
          reply_to_id: replyToId,
        });

        setMessages((prev) => {
          const next: MessageWithRelations[] = prev.map((m) => {
            if (
              m.id.startsWith("temp-") &&
              m.client_random === tempMessage.client_random
            ) {
              const updated: MessageWithRelations = {
                ...(sent as any),
                status: "sent",
                reply_to: tempMessage.reply_to,
              };
              return updated;
            }
            return m;
          });
          return next;
        });
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
    },
    [
      conversationId,
      userId,
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
      opts?: { skipGate?: boolean },
    ) => {
      // Stop typing indicator
      sendTyping(conversationId, false);

      // Use caption if provided, otherwise use default text
      const messageContent =
        caption?.trim() ||
        (type === "image"
          ? "Photo"
          : type === "video"
            ? "Vidéo"
            : type === "audio"
              ? "Message vocal"
              : "Fichier");

      // Derive filename and MIME type from the local URI
      const filename = uri.split("/").pop() || "media";
      const extension = filename.split(".").pop()?.toLowerCase() || "";
      const mimeMap: Record<string, string> = {
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
      const mimeType =
        mimeMap[extension] ||
        (type === "image"
          ? "image/jpeg"
          : type === "video"
            ? "video/mp4"
            : type === "audio"
              ? "audio/mp4"
              : "application/octet-stream");

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
          media_url: uri,
          thumbnail_url: uri,
        },
        client_random: Math.floor(Math.random() * 1000000),
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
              media_url: uri,
              thumbnail_url: uri,
            },
            created_at: new Date().toISOString(),
          },
        ],
      };

      setMessages((prev) => [tempMessage, ...prev]);
      setReplyingTo(null);

      // Scroll to bottom so the newly sent media message is visible
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);

      try {
        // Gate check: block inappropriate images before upload
        if (type === "image" && !opts?.skipGate) {
          const gateResult = await gateChatImageBeforeSend(uri);
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
                        localUri: uri,
                      } as any,
                    }
                  : m,
              ),
            );
            // Open the appeal modal so the user can contest immediately.
            setAppealModal({
              visible: true,
              imageUri: uri,
              blockReason: blockedReason,
              scores: gateResult.scores,
              messageTempId: tempMessageId,
            });
            return;
          }
        }

        // 1. Upload file to media-service
        console.log("[ChatScreen] Uploading media to media-service:", filename);
        const uploadResult = await MediaService.uploadMedia(
          { uri, name: filename, type: mimeType },
          (percent) => {
            console.log(`[ChatScreen] Upload progress: ${percent}%`);
          },
        );
        console.log(
          "[ChatScreen] Media uploaded:",
          uploadResult.id,
          uploadResult.url,
        );

        // Build metadata with the remote URLs from the upload result
        const mediaMetadata = {
          media_type: type,
          media_id: uploadResult.id,
          media_url: uploadResult.url,
          thumbnail_url: uploadResult.thumbnail_url || uploadResult.url,
          filename: uploadResult.filename || filename,
          mime_type: uploadResult.mime_type || mimeType,
          size: uploadResult.size,
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
                    },
                  })),
                }
              : msg,
          ),
        );

        // 2. Send message via messaging-service with remote media URLs
        const sentMessage = await messagingAPI.sendMessage(conversationId, {
          content: messageContent,
          message_type: "media",
          client_random: tempMessage.client_random as number,

          metadata: mediaMetadata,
          reply_to_id: replyToId,
        });

        // 3. Attach media record to the message (non-blocking — message already has metadata)
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
            },
          })
          .catch((err) =>
            console.warn(
              "[ChatScreen] addAttachment failed (non-blocking):",
              err,
            ),
          );

        // 4. Update optimistic message with the real server ID
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
    [conversationId, userId, sendTyping, replyingTo],
  );

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
        Alert.alert("Erreur", "Impossible de programmer le message.");
      }
      setScheduleMessageText("");
    },
    [conversationId, scheduleMessageText],
  );

  const handleScheduledPress = useCallback(() => {
    navigation.navigate("ScheduledMessages", { conversationId });
  }, [navigation, conversationId]);

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
    const result: Array<
      MessageWithRelations | { type: "date"; date: Date; id: string }
    > = [];

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
        } as any);
      }
    });

    return result;
  }, [messages]);

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
        (item) =>
          !(item as any).type &&
          (item as MessageWithRelations).id === messageId,
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
    async (targetConversationId: string) => {
      if (!forwardingMessage) return;

      setForwardSending(true);
      try {
        await messagingAPI.sendMessage(targetConversationId, {
          content: forwardingMessage.content,
          message_type: forwardingMessage.message_type,
          client_random: Math.floor(Math.random() * 1000000),
          metadata: {
            forwarded: true,
            original_sender: forwardingMessage.sender_id,
            original_timestamp: forwardingMessage.sent_at,
          },
        });
        setShowForwardModal(false);
        setForwardingMessage(null);
        setForwardSending(false);

        // Navigate to the target conversation so the user sees the forwarded
        // message immediately. Using `push` creates a new stack entry so the
        // back button returns to the original conversation.
        navigation.push("Chat", {
          conversationId: targetConversationId,
        });
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
        await loadPinnedMessages();
      } catch (error) {
        logger.error("ChatScreen", "Error deleting message", error);
        Alert.alert("Erreur", "Impossible de supprimer le message");
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
        await messagingAPI.unpinMessage(conversationId, selectedMessage.id);
      } else {
        await messagingAPI.pinMessage(conversationId, selectedMessage.id);
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
        // Try server-side search first
        const apiResults = await messagingAPI.searchMessages(
          conversationId,
          query.trim(),
          { limit: 50 },
        );

        let results: MessageWithRelations[];

        if (apiResults !== null) {
          // Server returned results — map them to MessageWithRelations
          results = apiResults
            .filter((msg) => msg.message_type !== "system" && !msg.is_deleted)
            .map((msg) => ({
              ...msg,
              status: (msg as any).status || ("sent" as const),
            }));
        } else {
          // Fallback: client-side search on loaded messages
          results = messages.filter((msg) => {
            if (msg.message_type === "system" || msg.is_deleted) return false;
            if (!msg.content) return false;
            return msg.content.toLowerCase().includes(query.toLowerCase());
          });
        }

        setSearchResults(results);
        setCurrentSearchIndex(0);

        // Scroll to first result after a short delay to ensure list is rendered
        if (results.length > 0 && flatListRef.current) {
          setTimeout(() => {
            const firstResultIndex = messagesWithSeparators.findIndex(
              (item) =>
                !(item as any).type &&
                (item as MessageWithRelations).id === results[0].id,
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
          (item) =>
            !(item as any).type &&
            (item as MessageWithRelations).id === result.id,
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
          (item) =>
            !(item as any).type &&
            (item as MessageWithRelations).id === result.id,
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

  const handleInfoPress = useCallback(() => {
    if (conversation?.type === "group") {
      // Ensure modal is closed before navigating
      setShowInfoModal(false);
      const groupId =
        conversation.external_group_id ||
        conversation.metadata?.group_id ||
        conversation.id;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Use setTimeout to ensure modal is closed before navigation
      setTimeout(() => {
        navigation.navigate("GroupDetails", {
          groupId,
          conversationId: conversation.id,
        });
      }, 0);
    } else {
      setShowInfoModal(true);
    }
  }, [conversation, navigation]);

  const renderItem = useCallback(
    ({
      item,
    }: {
      item: MessageWithRelations | { type: "date"; date: Date; id: string };
    }) => {
      // Check if it's a date separator
      if ((item as any).type === "date") {
        return <DateSeparator date={(item as any).date} />;
      }

      const message = item as MessageWithRelations;

      // Handle system messages
      if (message.message_type === "system") {
        return <SystemMessage content={message.content} />;
      }

      const isSent = message.sender_id === userId;
      const isHighlighted = Boolean(
        searchQuery.trim() && searchResults.some((r) => r.id === message.id),
      );

      // Resolve sender name for group conversations
      const senderName =
        !isSent && conversation?.type === "group"
          ? conversationMembers.find((m) => m.id === message.sender_id)
              ?.display_name
          : undefined;

      return (
        <MessageBubble
          message={message}
          isSent={isSent}
          currentUserId={userId}
          senderName={senderName}
          onReactionPress={handleReactionPress}
          onReactionDetailsPress={handleReactionDetailsPress}
          resolveReactorName={resolveReactorDisplayName}
          onReplyPress={handleReplyPress}
          onLongPress={() => handleMessageLongPress(message)}
          isHighlighted={isHighlighted}
          searchQuery={searchQuery}
          pendingAppeal={pendingAppeals[message.id]}
          onContest={(m) => {
            const meta = (m.metadata || {}) as any;
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
    ],
  );

  const keyExtractor = useCallback(
    (item: MessageWithRelations | { type: "date"; date: Date; id: string }) => {
      if ((item as any).type === "date") {
        return (item as any).id;
      }
      return (item as MessageWithRelations).id;
    },
    [],
  );

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <OfflineBanner connectionState={connectionState} />
        <ChatHeader
          conversationName={conversation?.display_name || "Contact"}
          avatarUrl={conversation?.avatar_url}
          conversationType={conversation?.type || "direct"}
          isOnline={isOtherOnline}
          lastSeenAt={otherLastSeenAt}
          onSearchPress={() => setShowSearch(true)}
          onInfoPress={handleInfoPress}
          onScheduledPress={handleScheduledPress}
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
                <ActivityIndicator size="small" color={colors.text.light} />
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
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
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
            ListEmptyComponent={
              !loading ? (
                <View style={{ transform: [{ scaleY: -1 }], flex: 1 }}>
                  <EmptyChatState />
                </View>
              ) : null
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={themeColors.primary} />
                </View>
              ) : null
            }
          />
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
          />
        </KeyboardAvoidingView>
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
          conversationTitle={conversation?.display_name || "Contact"}
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
                      name={conversation?.display_name || "Contact"}
                      showOnlineBadge={conversation?.type === "direct"}
                      isOnline={false}
                    />
                    <Text style={styles.infoName}>
                      {conversation?.display_name || "Contact"}
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
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>MESSAGES</Text>
                    <Text style={styles.infoValue}>
                      {messages.length} message{messages.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                </ScrollView>
              </LinearGradient>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
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
});
