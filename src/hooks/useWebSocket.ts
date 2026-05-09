/**
 * useWebSocket Hook - Manage WebSocket connection and channels
 *
 * Uses a singleton SocketConnection so all screens share one WebSocket.
 * The user channel (user:{userId}) is joined once; conversation channels
 * are joined/left per-screen via joinConversationChannel.
 */

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { AppState } from "react-native";
import {
  getSharedSocket,
  ConnectionState,
} from "../services/messaging/websocket";
import { Conversation, Message } from "../types/messaging";
import { usePresenceStore } from "../store/presenceStore";
import { useCallsStore } from "../store/callsStore";
import { navigate, navigationRef } from "../navigation/navigationRef";
import type { CallType } from "../types/calls";
import {
  buildIncomingCallPresentation,
  systemCallProvider,
} from "../services/calls/systemCallProvider";
import { isCallsAvailable } from "./useCallsAvailable";

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
  onConversationArchived?: (conversationId: string, archived: boolean) => void;
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
      // message_created: payload is the Message object directly (no wrapper).
      onMsg: (data: any) => {
        const msg = (data?.message ?? data) as Message;
        if (msg?.id) callbacksRef.current.onNewMessage?.(msg);
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
      // conversation_archived: { conversation_id, archived, timestamp }.
      // Source de vérité multi-device pour l'état d'archivage.
      onConvArchived: (data: {
        conversation_id?: string;
        archived?: boolean;
      }) => {
        if (data?.conversation_id && typeof data.archived === "boolean") {
          callbacksRef.current.onConversationArchived?.(
            data.conversation_id,
            data.archived,
          );
        }
      },
      onContactReq: (data: { request: any }) => {
        callbacksRef.current.onContactRequest?.(data.request);
      },
      // incoming_call: WS broadcast from calls-service when another user
      // initiates a call involving us. Push to the store and route to the
      // modal IncomingCallScreen.
      onIncomingCall: (data: {
        call_id: string;
        initiator_id: string;
        conversation_id: string;
        type: CallType;
        caller_name?: string;
        initiator_name?: string;
      }) => {
        if (!data?.call_id) return;
        if (!isCallsAvailable()) return;
        useCallsStore.getState().setIncoming({
          callId: data.call_id,
          initiatorId: data.initiator_id,
          conversationId: data.conversation_id,
          type: data.type,
          displayName:
            data.caller_name ?? data.initiator_name ?? data.initiator_id,
        });
        const incoming = useCallsStore.getState().incoming;
        if (!incoming) return;

        if (
          AppState.currentState !== "active" &&
          systemCallProvider.isSupported()
        ) {
          void systemCallProvider.showIncomingCall(
            buildIncomingCallPresentation(incoming),
          );
          return;
        }

        navigate("IncomingCall");
      },
      // message_deleted sur user channel : messaging-service fanout vers
      // user:<id> pour les groupes, sinon ConversationsListScreen rate la
      // suppression "for everyone" tant qu'elle n'est pas abonnée au
      // canal de la conversation. Le payload backend est { id, conversation_id }.
      onMsgDeletedUser: (data: {
        id?: string;
        message_id?: string;
        conversation_id?: string;
      }) => {
        const messageId = data.id ?? data.message_id;
        if (messageId) {
          callbacksRef.current.onMessageDeleted?.(messageId, true);
        }
      },
      // call_ended: remote party hung up or server timed out the call.
      // WHISPR-1203 : reset() disconnect la Room LiveKit + clear active +
      // clear incoming. setIncoming(null) seul laissait l'autre côté
      // bloqué sur InCallScreen avec micro/caméra encore actifs. On
      // navigue aussi hors de InCall vers ConversationsList si on y est.
      onCallEnded: () => {
        const callId =
          useCallsStore.getState().active?.callId ??
          useCallsStore.getState().incoming?.callId;
        if (callId) {
          void systemCallProvider.endCall(callId, 2);
        }
        useCallsStore.getState().reset();
        if (
          navigationRef.isReady() &&
          navigationRef.getCurrentRoute()?.name === "InCall"
        ) {
          navigate("ConversationsList");
        }
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
    userChannel.off("message_created", userHandlers.onMsg);
    userChannel.off("message_deleted", userHandlers.onMsgDeletedUser);
    userChannel.off("delivery_status", userHandlers.onDelivery);
    userChannel.off("conversation_summaries", userHandlers.onConvSummaries);
    userChannel.off("conversation_archived", userHandlers.onConvArchived);
    userChannel.off("incoming_call", userHandlers.onIncomingCall);
    userChannel.off("call_ended", userHandlers.onCallEnded);

    userChannel.on("new_message", userHandlers.onMsg);
    userChannel.on("message_created", userHandlers.onMsg);
    userChannel.on("message_deleted", userHandlers.onMsgDeletedUser);
    userChannel.on("delivery_status", userHandlers.onDelivery);
    userChannel.on("conversation_summaries", userHandlers.onConvSummaries);
    userChannel.on("conversation_archived", userHandlers.onConvArchived);
    userChannel.on("incoming_call", userHandlers.onIncomingCall);
    userChannel.on("call_ended", userHandlers.onCallEnded);

    return () => {
      userChannel.off("new_message", userHandlers.onMsg);
      userChannel.off("message_created", userHandlers.onMsg);
      userChannel.off("message_deleted", userHandlers.onMsgDeletedUser);
      userChannel.off("delivery_status", userHandlers.onDelivery);
      userChannel.off("conversation_summaries", userHandlers.onConvSummaries);
      userChannel.off("conversation_archived", userHandlers.onConvArchived);
      userChannel.off("incoming_call", userHandlers.onIncomingCall);
      userChannel.off("call_ended", userHandlers.onCallEnded);
    };
  }, [options.userId, options.token, userHandlers]);

  const joinConversationChannel = useCallback((conversationId: string) => {
    const socket = getSharedSocket();

    const channel = socket.channel(`conversation:${conversationId}`);
    channel.join();

    // message_created: payload is the Message object directly (not wrapped).
    const onMsg = (data: any) => {
      const msg = (data?.message ?? data) as Message;
      if (msg?.id) callbacksRef.current.onNewMessage?.(msg);
    };
    const onTyping = (data: { user_id: string; typing: boolean }) => {
      callbacksRef.current.onTyping?.(data.user_id, data.typing);
    };
    // message_updated: payload is the Message object directly.
    const onMsgUpdated = (data: any) => {
      const msg = (data?.message ?? data) as Message;
      if (msg?.id) callbacksRef.current.onMessageUpdated?.(msg);
    };
    // message_deleted: { id, conversation_id } — always "delete for everyone"
    // since soft-deletes "for me" are not broadcast.
    const onMsgDeleted = (data: {
      id?: string;
      message_id?: string;
      conversation_id?: string;
    }) => {
      const messageId = data.id ?? data.message_id;
      if (messageId) {
        callbacksRef.current.onMessageDeleted?.(messageId, true);
      }
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

    // reaction_added: { message_id, reaction: { id, message_id, user_id, reaction, created_at } }
    // Unwrap the inner reaction object so the callback keeps the flat shape.
    const onReactionAdded = (data: any) => {
      const messageId = data?.message_id;
      const inner = data?.reaction;
      // Back-compat: old shape was { message_id, user_id, reaction } with
      // reaction as a string. Detect and pass through.
      if (typeof inner === "string" && data?.user_id) {
        callbacksRef.current.onReactionAdded?.({
          message_id: messageId,
          user_id: data.user_id,
          reaction: inner,
        });
        return;
      }
      if (messageId && inner?.user_id && inner?.reaction) {
        callbacksRef.current.onReactionAdded?.({
          message_id: messageId,
          user_id: inner.user_id,
          reaction: inner.reaction,
        });
      }
    };

    // reaction_removed: { message_id, reaction_id }
    // The client's callback signature still expects user_id + emoji, so we
    // pass reaction_id in the `reaction` slot and an empty user_id. Consumers
    // using reaction_id as an opaque identifier will still work; those
    // filtering by emoji/user need to refetch. The dual shape below also
    // accepts the legacy { message_id, user_id, reaction } payload.
    const onReactionRemoved = (data: any) => {
      const messageId = data?.message_id;
      if (
        data?.user_id &&
        data?.reaction &&
        typeof data.reaction === "string"
      ) {
        callbacksRef.current.onReactionRemoved?.({
          message_id: messageId,
          user_id: data.user_id,
          reaction: data.reaction,
        });
        return;
      }
      if (messageId && data?.reaction_id) {
        callbacksRef.current.onReactionRemoved?.({
          message_id: messageId,
          user_id: "",
          reaction: data.reaction_id,
        });
      }
    };

    channel.on("new_message", onMsg);
    channel.on("message_created", onMsg);
    channel.on("user_typing", onTyping);
    channel.on("message_updated", onMsgUpdated);
    channel.on("message_deleted", onMsgDeleted);
    channel.on("delivery_status", onDelivery);
    channel.on("presence_diff", onPresenceDiff);
    channel.on("presence_state", onPresenceState);
    channel.on("reaction_added", onReactionAdded);
    channel.on("reaction_removed", onReactionRemoved);

    const cleanup = () => {
      channel.off("new_message", onMsg);
      channel.off("message_created", onMsg);
      channel.off("user_typing", onTyping);
      channel.off("message_updated", onMsgUpdated);
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
