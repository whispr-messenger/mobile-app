/**
 * useWebSocket Hook - Manage WebSocket connection and channels
 */

import { useEffect, useRef, useCallback } from 'react';
import { createMockSocket, MockSocket } from '../services/messaging/websocket';
import { Conversation, Message } from '../types/messaging';

interface UseWebSocketOptions {
  userId: string;
  token: string;
  onNewMessage?: (message: Message) => void;
  onConversationUpdate?: (conversation: Conversation) => void;
  onTyping?: (userId: string, typing: boolean) => void;
  onDeliveryStatus?: (messageId: string, status: string) => void;
}

export const useWebSocket = (options: UseWebSocketOptions) => {
  const socketRef = useRef<MockSocket | null>(null);
  const userChannelRef = useRef<any>(null);

  useEffect(() => {
    // Initialize socket
    const socket = createMockSocket();
    socket.connect(options.userId, options.token);
    socketRef.current = socket;

    // Join user channel (user:{userId})
    const userChannel = socket.channel(`user:${options.userId}`);
    userChannelRef.current = userChannel;

    userChannel.join().then(() => {
      // Listen for new_message events
      userChannel.on('new_message', (data: { message: Message }) => {
        options.onNewMessage?.(data.message);
      });

      // Listen for delivery_status events
      userChannel.on('delivery_status', (data: { message_id: string; status: string }) => {
        options.onDeliveryStatus?.(data.message_id, data.status);
      });
    });

    return () => {
      userChannel.leave();
      socket.disconnect();
    };
  }, [options.userId, options.token]);

  const joinConversationChannel = useCallback(
    (conversationId: string) => {
      if (!socketRef.current) return null;

      const channel = socketRef.current.channel(`conversation:${conversationId}`);
      channel.join().then(() => {
        // Listen for typing events
        channel.on('user_typing', (data: { user_id: string; typing: boolean }) => {
          options.onTyping?.(data.user_id, data.typing);
        });

        // Listen for new messages in conversation
        channel.on('new_message', (data: { message: Message }) => {
          options.onNewMessage?.(data.message);
        });
      });

      return channel;
    },
    [options]
  );

  const sendMessage = useCallback(
    (conversationId: string, content: string, messageType: 'text' | 'media' | 'system' = 'text', clientRandom?: number) => {
      if (!socketRef.current) return;

      const channel = socketRef.current.channel(`conversation:${conversationId}`);
      const random = clientRandom || Math.floor(Math.random() * 1000000);
      
      channel.push('new_message', {
        conversation_id: conversationId,
        content,
        message_type: messageType,
        client_random: random,
      });

      // Listen for reply to update message status
      const replyKey = `${channel['topic']}:phx_reply`;
      const replyHandler = (data: { status: string; response?: { message: Message } }) => {
        if (data.status === 'ok' && data.response?.message) {
          options.onNewMessage?.(data.response.message);
        }
        // Remove listener after handling
        socketRef.current?.emit(replyKey, null);
      };
      
      socketRef.current.on(replyKey, replyHandler);
    },
    [options]
  );

  const sendTyping = useCallback((conversationId: string, typing: boolean) => {
    if (!socketRef.current) return;

    const channel = socketRef.current.channel(`conversation:${conversationId}`);
    channel.push(typing ? 'typing_start' : 'typing_stop', {});
  }, []);

  const markAsRead = useCallback((conversationId: string, messageId: string) => {
    if (!socketRef.current) return;

    const channel = socketRef.current.channel(`conversation:${conversationId}`);
    channel.push('message_read', { message_id: messageId });
  }, []);

  const joinUserChannel = useCallback(() => {
    // This channel is already joined in the useEffect, but this function can be exposed
    // if there's a need to re-join or ensure it's active from a component.
    if (userChannelRef.current && socketRef.current?.isConnected()) {
      return userChannelRef.current;
    }
    // Re-initialize if somehow disconnected (should be handled by useEffect)
    const socket = createMockSocket();
    socket.connect(options.userId, options.token);
    socketRef.current = socket;
    const userChannel = socket.channel(`user:${options.userId}`);
    userChannelRef.current = userChannel;
    userChannel.join().then(() => {
      userChannel.on('new_message', (data: { message: Message }) => {
        options.onNewMessage?.(data.message);
      });
      userChannel.on('delivery_status', (data: { message_id: string; status: string }) => {
        options.onDeliveryStatus?.(data.message_id, data.status);
      });
    });
    return userChannel;
  }, [options.userId, options.token, options.onNewMessage, options.onDeliveryStatus]);

  return {
    joinUserChannel,
    joinConversationChannel,
    sendMessage,
    sendTyping,
    markAsRead,
  };
};

