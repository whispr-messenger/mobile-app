/**
 * ConversationsListScreen - Home Page
 * Displays list of conversations with real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Conversation } from '../../types/messaging';
import { messagingAPI } from '../../services/messaging/api';
import { ConversationItem } from '../../components/Chat/ConversationItem';

export const ConversationsListScreen: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await messagingAPI.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConversationPress = useCallback((conversationId: string) => {
    // TODO: Navigate to ChatScreen
    console.log('Navigate to conversation:', conversationId);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationItem
        conversation={item}
        onPress={handleConversationPress}
      />
    ),
    [handleConversationPress]
  );

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
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

