/**
 * useWebSocket Hook - Manage WebSocket connection and channels
 *
 * Uses a singleton SocketConnection so all screens share one WebSocket.
 * The user channel (user:{userId}) is joined once; conversation channels
 * are joined/left per-screen via joinConversationChannel.
 */

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import {
  getSharedSocket,
  ConnectionState,
} from "../services/messaging/websocket";
import { Conversation, Message } from "../types/messaging";
import { usePresenceStore } from "../store/presenceStore";

/** Payload normalisé (snake_case) pour reaction_added / reaction_removed */
export interface ReactionRealtimePayload {
  message_id: string;
  user_id: string;
  reaction: string;
}

interface UseWebSocketOptions {
  userId: string;
  token: string;
  onNewMessage?: (message: Message) => void;
  onMessageUpdated?: (message: Message) => void;
  onMessageDeleted?: (messageId: string, deleteForEveryone: boolean) => void;
  onConversationUpdate?: (conversation: Conversation) => void;
  onConversationSummaries?: (conversations: Conversation[]) => void;
  onTyping?: (userId: string, typing: boolean) => void;
  onDeliveryStatus?: (messageId: string, status: string) => void;
  onContactRequest?: (request: any) => void;
  onPresenceUpdate?: (userId: string, isOnline: boolean) => void;
  onReactionAdded?: (payload: ReactionRealtimePayload) => void;
  onReactionRemoved?: (payload: ReactionRealtimePayload) => void;
}

export const useWebSocket = (options: UseWebSocketOptions) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    () => {
      // Initialize with the current shared socket state to avoid a brief flash of 'disconnected'
      try {
        return getSharedSocket().connectionState;
      } catch {
        return "connecting";
      }
    },
  );

  // Keep callbacks in a ref so channel listeners always call the latest version
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  });

  // Connect the shared socket and join the user channel (idempotent)
  useEffect(() => {
    if (!options.userId || !options.token) return;

    const socket = getSharedSocket();
    const removeListener =
      socket.addConnectionStateListener(setConnectionState);
    setConnectionState(socket.connectionState);

    // connect() is a no-op if already connected
    socket.connect(options.userId, options.token);

    // channel() is idempotent — returns existing entry if already created.
    // join() adds to pendingTopics if socket isn't open yet; the onopen
    // handler deduplicates by skipping topics already marked as joined.
    const userChannel = socket.channel(`user:${options.userId}`);
    userChannel.join();

    return () => {
      removeListener();
    };
  }, [options.userId, options.token]);

  // Stable handler references for the user channel so that off() reliably
  // removes the exact same function that on() registered, even across
  // re-renders triggered by reconnection state changes.
  const userHandlers = useMemo(
    () => ({
      onMsg: (data: { message: Message }) => {
        callbacksRef.current.onNewMessage?.(data.message);
      },
      onDelivery: (data: { message_id: string; status: string }) => {
        callbacksRef.current.onDeliveryStatus?.(data.message_id, data.status);
      },
      onConvUpdate: (data: { conversation: Conversation }) => {
        callbacksRef.current.onConversationUpdate?.(data.conversation);
      },
      onConvSummaries: (data: any) => {
        // Handle { conversations: [...] }, { summaries: [...] }, and bare array formats.
        // The backend sends "summaries" as the key; after snakecaseKeys it stays "summaries".
        const conversations = Array.isArray(data)
          ? data
          : (data?.conversations ?? data?.summaries);
        if (conversations && Array.isArray(conversations)) {
          callbacksRef.current.onConversationSummaries?.(conversations);
        }
      },
      onContactReq: (data: { request: any }) => {
        callbacksRef.current.onContactRequest?.(data.request);
      },
    }),
    [],
  );

  // Register per-instance callbacks on the user channel.
  // Each screen gets its own set; cleaned up on unmount via off().
  useEffect(() => {
    if (!options.userId || !options.token) return;

    const socket = getSharedSocket();
    const userChannel = socket.channel(`user:${options.userId}`);

    // Remove any prior listeners before registering new ones to prevent
    // duplicate subscriptions when the component re-renders during reconnect.
    userChannel.off("new_message", userHandlers.onMsg);
    userChannel.off("delivery_status", userHandlers.onDelivery);
    userChannel.off("conversation_summaries", userHandlers.onConvSummaries);

    userChannel.on("new_message", userHandlers.onMsg);
    userChannel.on("delivery_status", userHandlers.onDelivery);
    userChannel.on("conversation_summaries", userHandlers.onConvSummaries);

    return () => {
      userChannel.off("new_message", userHandlers.onMsg);
      userChannel.off("delivery_status", userHandlers.onDelivery);
      userChannel.off("conversation_summaries", userHandlers.onConvSummaries);
    };
  }, [options.userId, options.token, userHandlers]);

  const joinConversationChannel = useCallback((conversationId: string) => {
    const socket = getSharedSocket();

    const channel = socket.channel(`conversation:${conversationId}`);
    channel.join();

    const onMsg = (data: { message: Message }) => {
      callbacksRef.current.onNewMessage?.(data.message);
    };
    const onTyping = (data: { user_id: string; typing: boolean }) => {
      callbacksRef.current.onTyping?.(data.user_id, data.typing);
    };
    const onMsgUpdated = (data: { message: Message }) => {
      callbacksRef.current.onMessageUpdated?.(data.message);
    };
    const onMsgDeleted = (data: {
      message_id: string;
      delete_for_everyone: boolean;
    }) => {
      callbacksRef.current.onMessageDeleted?.(
        data.message_id,
        data.delete_for_everyone,
      );
    };
    const onDelivery = (data: { message_id: string; status: string }) => {
      callbacksRef.current.onDeliveryStatus?.(data.message_id, data.status);
    };
    const onPresenceDiff = (data: {
      joins?: Record<string, any>;
      leaves?: Record<string, any>;
    }) => {
      const joins = data.joins ? Object.keys(data.joins) : [];
      const leaves = data.leaves ? Object.keys(data.leaves) : [];
      usePresenceStore.getState().applyPresenceDiff(joins, leaves);
      joins.forEach((uid) => {
        callbacksRef.current.onPresenceUpdate?.(uid, true);
      });
      leaves.forEach((uid) => {
        callbacksRef.current.onPresenceUpdate?.(uid, false);
      });
    };
    const onPresenceState = (data: Record<string, any>) => {
      const userIds = Object.keys(data);
      usePresenceStore.getState().setPresenceState(userIds);
      userIds.forEach((uid) => {
        callbacksRef.current.onPresenceUpdate?.(uid, true);
      });
    };

    const onReactionAdded = (data: Record<string, string>) => {
      const message_id = data.message_id;
      const user_id = data.user_id;
      const reaction = data.reaction;
      if (message_id && user_id && reaction) {
        callbacksRef.current.onReactionAdded?.({
          message_id,
          user_id,
          reaction,
        });
      }
    };

    const onReactionRemoved = (data: Record<string, string>) => {
      const message_id = data.message_id;
      const user_id = data.user_id;
      const reaction = data.reaction;
      if (message_id && user_id && reaction) {
        callbacksRef.current.onReactionRemoved?.({
          message_id,
          user_id,
          reaction,
        });
      }
    };

    channel.on("new_message", onMsg);
    channel.on("user_typing", onTyping);
    channel.on("message_edited", onMsgUpdated);
    channel.on("message_deleted", onMsgDeleted);
    channel.on("delivery_status", onDelivery);
    channel.on("presence_diff", onPresenceDiff);
    channel.on("presence_state", onPresenceState);
    channel.on("reaction_added", onReactionAdded);
    channel.on("reaction_removed", onReactionRemoved);

    const cleanup = () => {
      channel.off("new_message", onMsg);
      channel.off("user_typing", onTyping);
      channel.off("message_edited", onMsgUpdated);
      channel.off("message_deleted", onMsgDeleted);
      channel.off("delivery_status", onDelivery);
      channel.off("presence_diff", onPresenceDiff);
      channel.off("presence_state", onPresenceState);
      channel.off("reaction_added", onReactionAdded);
      channel.off("reaction_removed", onReactionRemoved);
    };

    return { channel, cleanup };
  }, []);

  const sendMessage = useCallback(
    (
      conversationId: string,
      content: string,
      messageType: "text" | "media" | "system" = "text",
      clientRandom?: number,
    ) => {
      const socket = getSharedSocket();
      if (!socket.isConnected()) return;

      const channel = socket.channel(`conversation:${conversationId}`);
      const random = clientRandom || Math.floor(Math.random() * 1000000);

      channel.push("new_message", {
        conversation_id: conversationId,
        content,
        message_type: messageType,
        client_random: random,
      });
    },
    [],
  );

  const sendTyping = useCallback((conversationId: string, typing: boolean) => {
    const socket = getSharedSocket();
    if (!socket.isConnected()) return;

    const channel = socket.channel(`conversation:${conversationId}`);
    channel.push("user_typing", { typing });
  }, []);

  const markAsRead = useCallback(
    (conversationId: string, messageId: string) => {
      const socket = getSharedSocket();
      if (!socket.isConnected()) return;

      const channel = socket.channel(`conversation:${conversationId}`);
      channel.push("message_read", { message_id: messageId });
    },
    [],
  );

  return {
    connectionState,
    joinConversationChannel,
    sendMessage,
    sendTyping,
    markAsRead,
  };
};
