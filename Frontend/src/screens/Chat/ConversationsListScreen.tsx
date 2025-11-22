/**
 * ConversationsListScreen - Home Page
 * Displays list of conversations with real-time updates
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Conversation, Message } from '../../types/messaging';
import { messagingAPI } from '../../services/messaging/api';
import { cacheService } from '../../services/messaging/cache';
import { useWebSocket } from '../../hooks/useWebSocket';
import ConversationItem from '../../components/Chat/ConversationItem';
import { EmptyState } from '../../components/Chat/EmptyState';
import { useTheme } from '../../context/ThemeContext';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { colors } from '../../theme/colors';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'Chat'>;

export const ConversationsListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  // Sort conversations by last message timestamp
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aTime = a.last_message?.sent_at || a.updated_at;
      const bTime = b.last_message?.sent_at || b.updated_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [conversations]);

  // Mock user ID - TODO: Get from auth context
  const userId = 'user-1';
  const token = 'mock-token';

  // WebSocket connection
  const { onNewMessage } = useWebSocket({
    userId,
    token,
    onNewMessage: (message: Message) => {
      // Update conversation with new message
      setConversations(prev => {
        const updated = prev.map(conv => {
          if (conv.id === message.conversation_id) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return {
              ...conv,
              last_message: message,
              updated_at: message.sent_at,
              unread_count: (conv.unread_count || 0) + 1,
            };
          }
          return conv;
        });
        return updated;
      });
    },
  });

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

  const handleConversationPress = useCallback(
    (conversationId: string) => {
      navigation.navigate('Chat', { conversationId });
    },
    [navigation]
  );

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

  const listContentStyle = useMemo(
    () => [
      styles.listContent,
      conversations.length === 0 && styles.emptyContent,
    ],
    [conversations.length]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.background.primary, borderBottomColor: colors.ui.divider }]}>
        <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>Messages</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.headerButton}
          >
            <Ionicons name="person-outline" size={24} color={themeColors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.headerButton}
          >
            <Ionicons name="settings-outline" size={24} color={themeColors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading && conversations.length === 0 ? (
        <View style={styles.loadingContainer}>
          {/* TODO: Add loading skeleton */}
        </View>
      ) : sortedConversations.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={sortedConversations}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={listContentStyle}
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
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

