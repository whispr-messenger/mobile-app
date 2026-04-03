/**
 * useWebSocket Hook - Manage WebSocket connection and channels
 *
 * Uses a singleton SocketConnection so all screens share one WebSocket.
 * The user channel (user:{userId}) is joined once; conversation channels
 * are joined/left per-screen via joinConversationChannel.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { getSharedSocket, ConnectionState } from '../services/messaging/websocket';
import { Conversation, Message } from '../types/messaging';
import { usePresenceStore } from '../store/presenceStore';

interface UseWebSocketOptions {
  userId: string;
  token: string;
  onNewMessage?: (message: Message) => void;
  onMessageUpdated?: (message: Message) => void;
  onMessageDeleted?: (messageId: string, deleteForEveryone: boolean) => void;
  onConversationUpdate?: (conversation: Conversation) => void;
  onTyping?: (userId: string, typing: boolean) => void;
  onDeliveryStatus?: (messageId: string, status: string) => void;
  onContactRequest?: (request: any) => void;
  onPresenceUpdate?: (userId: string, isOnline: boolean) => void;
}

export const useWebSocket = (options: UseWebSocketOptions) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  // Keep callbacks in a ref so channel listeners always call the latest version
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  });

  // Connect the shared socket and join the user channel (idempotent)
  useEffect(() => {
    if (!options.userId || !options.token) return;

    const socket = getSharedSocket();
    const removeListener = socket.addConnectionStateListener(setConnectionState);
    setConnectionState(socket.connectionState);

    // connect() is a no-op if already connected
    socket.connect(options.userId, options.token);

    // channel() is idempotent — returns existing entry if already created.
    // join() adds to pendingTopics if socket isn't open yet; the onopen
    // handler deduplicates by skipping topics already marked as joined.
    const userChannel = socket.channel(`user:${options.userId}`);
    userChannel.join();

    return () => { removeListener(); };
  }, [options.userId, options.token]);

  // Register per-instance callbacks on the user channel.
  // Each screen gets its own set; cleaned up on unmount via off().
  useEffect(() => {
    if (!options.userId || !options.token) return;

    const socket = getSharedSocket();
    const userChannel = socket.channel(`user:${options.userId}`);

    const onMsg = (data: { message: Message }) => {
      callbacksRef.current.onNewMessage?.(data.message);
    };
    const onDelivery = (data: { message_id: string; status: string }) => {
      callbacksRef.current.onDeliveryStatus?.(data.message_id, data.status);
    };
    const onConvUpdate = (data: { conversation: Conversation }) => {
      callbacksRef.current.onConversationUpdate?.(data.conversation);
    };
    const onContactReq = (data: { request: any }) => {
      callbacksRef.current.onContactRequest?.(data.request);
    };

    userChannel.on("new_message", onMsg);
    userChannel.on("delivery_status", onDelivery);
    userChannel.on("conversation_updated", onConvUpdate);
    userChannel.on("contact_request_created", onContactReq);
    userChannel.on("contact_request_updated", onContactReq);

    return () => {
      userChannel.off("new_message", onMsg);
      userChannel.off("delivery_status", onDelivery);
      userChannel.off("conversation_updated", onConvUpdate);
      userChannel.off("contact_request_created", onContactReq);
      userChannel.off("contact_request_updated", onContactReq);
    };
  }, [options.userId, options.token]);

  const joinConversationChannel = useCallback(
    (conversationId: string) => {
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
      const onMsgDeleted = (data: { message_id: string; delete_for_everyone: boolean }) => {
        callbacksRef.current.onMessageDeleted?.(data.message_id, data.delete_for_everyone);
      };
      const onDelivery = (data: { message_id: string; status: string }) => {
        callbacksRef.current.onDeliveryStatus?.(data.message_id, data.status);
      };
      const onPresenceDiff = (data: { joins?: Record<string, any>; leaves?: Record<string, any> }) => {
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

      channel.on("new_message", onMsg);
      channel.on("user_typing", onTyping);
      channel.on("message_updated", onMsgUpdated);
      channel.on("message_deleted", onMsgDeleted);
      channel.on("delivery_status", onDelivery);
      channel.on("presence_diff", onPresenceDiff);
      channel.on("presence_state", onPresenceState);

      return channel;
    },
    [],
  );

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
