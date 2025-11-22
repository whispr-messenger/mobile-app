/**
 * ConversationsListScreen - Home Page
 * Displays list of conversations with real-time updates
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Text, TouchableOpacity, TextInput } from 'react-native';
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
  const [searchQuery, setSearchQuery] = useState('');
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  // Filter and sort conversations
  const filteredAndSortedConversations = useMemo(() => {
    if (!conversations || conversations.length === 0) {
      return [];
    }
    
    // Filter by search query
    let filtered = conversations;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = conversations.filter(conv => {
        const name = conv.type === 'direct' 
          ? 'Contact' 
          : (conv.metadata?.name || 'Group');
        const lastMessage = conv.last_message?.content || '';
        return name.toLowerCase().includes(query) || lastMessage.toLowerCase().includes(query);
      });
    }
    
    // Sort: pinned first, then by timestamp
    return [...filtered].sort((a, b) => {
      // Pinned conversations first
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      
      // Then by timestamp
      const aTime = a.last_message?.sent_at || a.updated_at;
      const bTime = b.last_message?.sent_at || b.updated_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [conversations, searchQuery]);

  // Mock user ID - TODO: Get from auth context
  const userId = 'user-1';
  const token = 'mock-token';

  // WebSocket connection
  const { joinUserChannel } = useWebSocket({
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
    const init = async () => {
      joinUserChannel();
      await loadConversations();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load from cache first for instant display
      const cachedData = await cacheService.getConversations();
      if (cachedData && cachedData.length > 0) {
        console.log('📦 Loaded from cache:', cachedData.length, 'conversations');
        setConversations(cachedData);
      }
      
      // Fetch fresh data
      console.log('🌐 Fetching conversations from API...');
      const data = await messagingAPI.getConversations();
      console.log('✅ Fetched conversations:', data.length, 'conversations');
      setConversations(data);
      
      // Save to cache
      await cacheService.saveConversations(data);
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
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


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.background.primary, borderBottomColor: colors.ui.divider }]}>
        <TouchableOpacity
          onPress={() => {
            // TODO: Implement edit mode
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.headerButton}
        >
          <Text style={[styles.editButton, { color: colors.secondary.main }]}>Edit</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>Chats</Text>
        <TouchableOpacity
          onPress={() => {
            // TODO: Navigate to new conversation
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.headerButton}
        >
          <View style={[styles.composeButton, { backgroundColor: colors.secondary.main }]}>
            <Ionicons name="create-outline" size={20} color={colors.text.light} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: themeColors.background.primary }]}>
        <View style={[styles.searchBar, { backgroundColor: themeColors.background.secondary }]}>
          <Ionicons name="search-outline" size={20} color={themeColors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.text.primary }]}
            placeholder="Search for messages or users"
            placeholderTextColor={themeColors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={themeColors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && conversations.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={{ color: themeColors.text.secondary }}>Chargement...</Text>
        </View>
      ) : filteredAndSortedConversations.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={filteredAndSortedConversations}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          style={styles.list}
          removeClippedSubviews={false}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={15}
          windowSize={10}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={true}
          ListEmptyComponent={<EmptyState />}
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
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    padding: 4,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    fontSize: 17,
    fontWeight: '500',
  },
  composeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.divider,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
    flexGrow: 1,
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

