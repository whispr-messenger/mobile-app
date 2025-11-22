/**
 * ChatScreen - Individual conversation chat interface
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { MessageWithStatus } from '../../types/messaging';
import { messagingAPI } from '../../services/messaging/api';

interface ChatScreenProps {
  conversationId: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ conversationId }) => {
  const [messages, setMessages] = useState<MessageWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await messagingAPI.getMessages(conversationId);
      const messagesWithStatus: MessageWithStatus[] = data.map(msg => ({
        ...msg,
        status: 'sent' as const,
      }));
      setMessages(messagesWithStatus);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const renderItem = useCallback(
    ({ item }: { item: MessageWithStatus }) => {
      // TODO: Get current user ID from context
      const isSent = true; // item.sender_id === currentUserId;
      return <MessageBubble message={item} isSent={isSent} />;
    },
    []
  );

  const keyExtractor = useCallback((item: MessageWithStatus) => item.id, []);

  return (
    <View style={styles.container}>
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
      />
    </View>
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
