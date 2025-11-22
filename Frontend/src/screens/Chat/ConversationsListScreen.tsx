/**
 * ConversationsListScreen - Home Page
 * Displays list of conversations with real-time updates
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Conversation } from '../../types/messaging';
import { messagingAPI } from '../../services/messaging/api';
import { cacheService } from '../../services/messaging/cache';
import ConversationItem from '../../components/Chat/ConversationItem';
import { useTheme } from '../../context/ThemeContext';

export const ConversationsListScreen: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load from cache first for instant display
      const cachedData = await cacheService.getConversations();
      if (cachedData) {
        setConversations(cachedData);
      }
      
      // Fetch fresh data in parallel
      const data = await messagingAPI.getConversations();
      setConversations(data);
      
      // Save to cache
      await cacheService.saveConversations(data);
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
    ({ item, index }: { item: Conversation; index: number }) => (
      <ConversationItem
        conversation={item}
        onPress={handleConversationPress}
        index={index}
      />
    ),
    [handleConversationPress]
  );

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  const getItemLayout = useCallback(
    (_data: Conversation[] | null | undefined, index: number) => ({
      length: 72, // Fixed height for conversation item
      offset: 72 * index,
      index,
    }),
    []
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, [loadConversations]);

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
        getItemLayout={getItemLayout}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.primary}
            colors={[themeColors.primary]}
          />
        }
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

