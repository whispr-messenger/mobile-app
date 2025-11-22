/**
 * ConversationsListScreen - Home Page
 * Displays list of conversations with real-time updates
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Text, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Conversation, Message } from '../../types/messaging';
import { messagingAPI } from '../../services/messaging/api';
import { cacheService } from '../../services/messaging/cache';
import { useWebSocket } from '../../hooks/useWebSocket';
import { SwipeableConversationItem } from '../../components/Chat/SwipeableConversationItem';
import { EmptyState } from '../../components/Chat/EmptyState';
import { ConversationSkeleton } from '../../components/Chat/SkeletonLoader';
import { BottomTabBar } from '../../components/Navigation/BottomTabBar';
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
  const [editMode, setEditMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  // Filter and sort conversations
  const filteredAndSortedConversations = useMemo(() => {
    if (!conversations || conversations.length === 0) {
      return [];
    }
    
    // Filter out archived conversations (for now, can add toggle later)
    let filtered = conversations.filter(conv => !conv.is_archived);
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => {
        const name = conv.display_name || (conv.type === 'direct' 
          ? 'Contact' 
          : (conv.metadata?.name || 'Group'));
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
      if (editMode) {
        setSelectedConversations(prev => {
          const newSet = new Set(prev);
          if (newSet.has(conversationId)) {
            newSet.delete(conversationId);
          } else {
            newSet.add(conversationId);
          }
          return newSet;
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        navigation.navigate('Chat', { conversationId });
      }
    },
    [navigation, editMode]
  );

  const handleSelectAll = useCallback(() => {
    if (selectedConversations.size === filteredAndSortedConversations.length) {
      setSelectedConversations(new Set());
    } else {
      setSelectedConversations(new Set(filteredAndSortedConversations.map(c => c.id)));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [filteredAndSortedConversations, selectedConversations]);

  const handleBulkDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setConversations(prev => prev.filter(conv => !selectedConversations.has(conv.id)));
    setSelectedConversations(new Set());
    setEditMode(false);
  }, [selectedConversations]);

  const handleBulkArchive = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConversations(prev => prev.map(conv => 
      selectedConversations.has(conv.id)
        ? { ...conv, is_archived: true }
        : conv
    ));
    setSelectedConversations(new Set());
    setEditMode(false);
  }, [selectedConversations]);

  const handleDelete = useCallback((conversationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    // TODO: Call API when backend is ready
  }, []);

  const handleMute = useCallback((conversationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, is_muted: !conv.is_muted }
        : conv
    ));
    // TODO: Call API when backend is ready
  }, []);

  const handleUnread = useCallback((conversationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, unread_count: (conv.unread_count || 0) + 1 }
        : conv
    ));
    // TODO: Call API when backend is ready
  }, []);

  const handleArchive = useCallback((conversationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, is_archived: !conv.is_archived }
        : conv
    ));
    // TODO: Call API when backend is ready
  }, []);

  const handlePin = useCallback((conversationId: string) => {
    console.log('📌 Pin conversation:', conversationId);
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, is_pinned: !conv.is_pinned }
        : conv
    ));
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Conversation; index: number }) => (
      <SwipeableConversationItem
        conversation={item}
        onPress={handleConversationPress}
        onDelete={handleDelete}
        onMute={handleMute}
        onUnread={handleUnread}
        onArchive={handleArchive}
        onPin={handlePin}
        index={index}
        editMode={editMode}
        isSelected={selectedConversations.has(item.id)}
      />
    ),
    [handleConversationPress, handleDelete, handleMute, handleUnread, handleArchive, handlePin, editMode, selectedConversations]
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
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: 'rgba(255, 255, 255, 0.1)' }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setEditMode(!editMode);
            if (editMode) {
              setSelectedConversations(new Set());
            }
          }}
          style={styles.headerButton}
        >
          <Text style={[styles.editButton, { color: colors.text.light }]}>
            {editMode ? 'Cancel' : 'Edit'}
          </Text>
        </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text.light }]}>Chats</Text>
          <TouchableOpacity
            onPress={() => {
              // TODO: Navigate to new conversation
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.headerButton}
          >
            <LinearGradient
              colors={[colors.primary.main, colors.secondary.main]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.composeButton}
            >
              <Ionicons name="create-outline" size={20} color={colors.text.light} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
            <Ionicons name="search-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text.light }]}
              placeholder="Search for messages or users"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                // Debounce search if needed for future API calls
                if (searchTimeoutRef.current) {
                  clearTimeout(searchTimeoutRef.current);
                }
                searchTimeoutRef.current = setTimeout(() => {
                  // Future: trigger API search here
                }, 300);
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                  }
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.7)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading && conversations.length === 0 ? (
          <View style={styles.loadingContainer}>
            {[...Array(5)].map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </View>
        ) : filteredAndSortedConversations.length === 0 ? (
          <EmptyState 
            onNewConversation={() => {
              // TODO: Navigate to new conversation
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
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
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyState />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.text.light}
                colors={[colors.primary.main]}
              />
            }
          />
        )}
        {editMode && selectedConversations.size > 0 && (
          <View style={styles.editActionsBar}>
            <TouchableOpacity
              style={[styles.editActionButton, { backgroundColor: colors.ui.error }]}
              onPress={handleBulkDelete}
            >
              <Ionicons name="trash-outline" size={20} color={colors.text.light} />
              <Text style={styles.editActionText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editActionButton, { backgroundColor: colors.secondary.main }]}
              onPress={handleBulkArchive}
            >
              <Ionicons name="archive-outline" size={20} color={colors.text.light} />
              <Text style={styles.editActionText}>Archive</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editActionButton, { backgroundColor: colors.primary.main }]}
              onPress={handleSelectAll}
            >
              <Ionicons name="checkmark-done-outline" size={20} color={colors.text.light} />
              <Text style={styles.editActionText}>
                {selectedConversations.size === filteredAndSortedConversations.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <BottomTabBar />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingVertical: 8,
    flexGrow: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'transparent',
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

