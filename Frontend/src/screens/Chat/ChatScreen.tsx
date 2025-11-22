/**
 * ChatScreen - Individual conversation chat interface
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { Message, MessageWithStatus } from '../../types/messaging';
import { messagingAPI } from '../../services/messaging/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { MessageBubble } from '../../components/Chat/MessageBubble';
import { MessageInput } from '../../components/Chat/MessageInput';
import { TypingIndicator } from '../../components/Chat/TypingIndicator';
import { ChatHeader } from './ChatHeader';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type ChatScreenRouteProp = StackScreenProps<AuthStackParamList, 'Chat'>['route'];

export const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const { conversationId } = route.params;
  const [messages, setMessages] = useState<MessageWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const conversationChannelRef = useRef<any>(null);

  // Mock user ID - TODO: Get from auth context
  const userId = 'user-1';
  const token = 'mock-token';

  // WebSocket connection
  const { joinConversationChannel, sendMessage: wsSendMessage, markAsRead, sendTyping } = useWebSocket({
    userId,
    token,
    onNewMessage: (message: Message) => {
      if (message.conversation_id === conversationId) {
        setMessages(prev => {
          // Check if message already exists (avoid duplicates)
          if (prev.some(m => m.id === message.id)) {
            return prev.map(m => (m.id === message.id ? { ...message, status: 'sent' as const } : m));
          }
          // Replace optimistic message if it matches client_random
          const optimisticMessageIndex = prev.findIndex(
            m => m.id.startsWith('temp-') && m.client_random === message.client_random
          );
          if (optimisticMessageIndex !== -1) {
            const newMessages = [...prev];
            newMessages[optimisticMessageIndex] = { ...message, status: 'sent' as const };
            return newMessages;
          }
          return [
            {
              ...message,
              status: 'sent' as const,
            },
            ...prev,
          ];
        });
        // Mark as read if chat is open
        markAsRead(conversationId, message.id);
      }
    },
    onTyping: (typingUserId: string, typing: boolean) => {
      if (typingUserId !== userId) {
        setTypingUsers(prev => {
          if (typing) {
            return prev.includes(typingUserId) ? prev : [...prev, typingUserId];
          } else {
            return prev.filter(id => id !== typingUserId);
          }
        });
      }
    },
  });

  useEffect(() => {
    loadMessages();
    // Join conversation channel
    const channel = joinConversationChannel(conversationId);
    conversationChannelRef.current = channel;

    return () => {
      channel?.leave();
    };
  }, [conversationId, joinConversationChannel]);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await messagingAPI.getMessages(conversationId);
      const messagesWithStatus: MessageWithStatus[] = data
        .filter(msg => msg && msg.content) // Filter out invalid messages
        .map(msg => ({
          ...msg,
          status: (msg as any).status || 'sent' as const,
        }));
      setMessages(messagesWithStatus);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const handleSendMessage = useCallback(
    (content: string) => {
      // Stop typing indicator
      sendTyping(conversationId, false);

      // Optimistic UI - add message immediately
      const tempMessage: MessageWithStatus = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: userId,
        message_type: 'text',
        content,
        metadata: {},
        client_random: Math.floor(Math.random() * 1000000),
        sent_at: new Date().toISOString(),
        is_deleted: false,
        delete_for_everyone: false,
        status: 'sending',
      };

      setMessages(prev => [tempMessage, ...prev]);

      // Send via WebSocket
      wsSendMessage(conversationId, content, 'text', tempMessage.client_random);
    },
    [conversationId, userId, wsSendMessage, sendTyping]
  );

  const renderItem = useCallback(
    ({ item }: { item: MessageWithStatus }) => {
      const isSent = item.sender_id === userId;
      return <MessageBubble message={item} isSent={isSent} />;
    },
    [userId]
  );

  const keyExtractor = useCallback((item: MessageWithStatus) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ChatHeader
        conversationName="Contact"
        conversationType="direct"
        isOnline={false}
      />
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        inverted
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        windowSize={10}
        ListFooterComponent={
          typingUsers.length > 0 ? <TypingIndicator /> : null
        }
      />
      <MessageInput
        onSend={handleSendMessage}
        onTyping={(typing) => sendTyping(conversationId, typing)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
});
