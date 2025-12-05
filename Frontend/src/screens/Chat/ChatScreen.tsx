/**
 * ChatScreen - Individual conversation chat interface
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '../../context/ThemeContext';
import { Message, MessageWithStatus, MessageWithRelations, Conversation } from '../../types/messaging';
import { messagingAPI } from '../../services/messaging/api';
import { mockStore } from '../../services/messaging/mockStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { MessageBubble } from '../../components/Chat/MessageBubble';
import { MessageInput } from '../../components/Chat/MessageInput';
import { TypingIndicator } from '../../components/Chat/TypingIndicator';
import { Avatar } from '../../components/Chat/Avatar';
import { MessageActionsMenu } from '../../components/Chat/MessageActionsMenu';
import { ReactionPicker } from '../../components/Chat/ReactionPicker';
import { DateSeparator } from '../../components/Chat/DateSeparator';
import { SystemMessage } from '../../components/Chat/SystemMessage';
import { MessageSearch } from '../../components/Chat/MessageSearch';
import { PinnedMessagesBar } from '../../components/Chat/PinnedMessagesBar';
import { EmptyChatState } from '../../components/Chat/EmptyChatState';
import { ChatHeader } from './ChatHeader';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';

type ChatScreenRouteProp = StackScreenProps<AuthStackParamList, 'Chat'>['route'];

export const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const { conversationId } = route.params;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageWithRelations | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageWithRelations | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MessageWithRelations[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinnedBar, setShowPinnedBar] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const conversationChannelRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

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
            return prev.map(m => (m.id === message.id ? { ...message, status: (message as any).status || 'sent' as const } : m));
          }
          // Replace optimistic message if it matches client_random
          const optimisticMessageIndex = prev.findIndex(
            m => m.id.startsWith('temp-') && m.client_random === message.client_random
          );
          if (optimisticMessageIndex !== -1) {
            const newMessages = [...prev];
            newMessages[optimisticMessageIndex] = { ...message, status: (message as any).status || 'sent' as const };
            return newMessages;
          }
          return [
            {
              ...message,
              status: (message as any).status || 'sent' as const,
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

  const loadPinnedMessages = useCallback(async () => {
    try {
      const pinned = await messagingAPI.getPinnedMessages(conversationId);
      console.log(`[ChatScreen] Pinned messages loaded: ${pinned.length}`);
      setPinnedMessages(pinned);
    } catch (error) {
      console.error('[ChatScreen] Error loading pinned messages:', error);
      setPinnedMessages([]);
    }
  }, [conversationId]);

  const loadConversation = useCallback(async () => {
    console.log('[ChatScreen] Loading conversation:', conversationId);
    try {
      const conv = await messagingAPI.getConversation(conversationId);
      console.log('[ChatScreen] Conversation loaded:', {
        id: conv.id,
        name: conv.display_name,
        type: conv.type,
      });
      setConversation(conv);
    } catch (error) {
      console.error('[ChatScreen] Error loading conversation:', error);
    }
  }, [conversationId]);

  useEffect(() => {
    console.log('[ChatScreen] Component mounted/updated, conversationId:', conversationId);
    
    // Load data
    loadConversation();
    loadMessages();
    loadPinnedMessages();
    
    // Join conversation channel
    const channel = joinConversationChannel(conversationId);
    conversationChannelRef.current = channel;
    console.log('[ChatScreen] Joined conversation channel:', conversationId);

    return () => {
      console.log('[ChatScreen] Component unmounting, leaving channel:', conversationId);
      channel?.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, joinConversationChannel]);

  const loadMessages = useCallback(async (before?: string) => {
    console.log('[ChatScreen] Loading messages:', {
      conversationId,
      before: before || 'initial load',
      limit: 50,
    });
    try {
      if (before) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const data = await messagingAPI.getMessages(conversationId, {
        limit: 50,
        before,
      });
      console.log('[ChatScreen] Messages loaded:', {
        count: data.length,
        before: before || 'initial',
      });

      // Load reactions and enrich messages
      const messagesWithRelations: MessageWithRelations[] = await Promise.all(
        data
          .filter(msg => msg && (msg.content || msg.is_deleted || msg.message_type === 'media' || msg.message_type === 'system')) // Include all message types
          .map(async (msg) => {
            const status = (msg as any)?.status || 'sent' as const;
            
            // Load reactions for this message
            let reactions = [];
            try {
              const reactionData = await messagingAPI.getMessageReactions(msg.id);
              reactions = reactionData.reactions || [];
            } catch (error) {
              // Ignore errors for reactions
            }

            // Load attachments for this message
            let attachments = [];
            try {
              attachments = await messagingAPI.getAttachments(msg.id);
            } catch (error) {
              // Ignore errors for attachments
            }

            // Find reply_to message if exists (search in current batch only)
            let replyTo: Message | undefined;
            if (msg.reply_to_id) {
              // Search in current batch
              replyTo = data.find(m => m.id === msg.reply_to_id);
            }

            return {
              ...msg,
              status,
              reactions,
              attachments,
              reply_to: replyTo,
            } as MessageWithRelations;
          })
      );

      if (before) {
        // Loading older messages - append to end
        setMessages(prev => {
          const newMessages = [...prev, ...messagesWithRelations];
          console.log('[ChatScreen] Older messages appended, total:', newMessages.length);
          return newMessages;
        });
        setHasMore(messagesWithRelations.length === 50);
      } else {
        // Initial load
        console.log('[ChatScreen] Initial messages set, count:', messagesWithRelations.length);
        setMessages(messagesWithRelations);
        setHasMore(messagesWithRelations.length === 50);
      }
    } catch (error) {
      console.error('[ChatScreen] Error loading messages:', error);
      if (!before) {
        setMessages([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [conversationId]);

  const loadMoreMessages = useCallback(() => {
    if (loadingMore || !hasMore || messages.length === 0) {
      return;
    }

    const oldestMessage = messages[messages.length - 1];
    loadMessages(oldestMessage.sent_at);
  }, [messages, loadingMore, hasMore, loadMessages]);

  const handleSendMessage = useCallback(
    async (content: string, replyToId?: string) => {
      console.log('[ChatScreen] Sending message:', {
        content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        replyToId,
        editing: !!editingMessage,
      });
      // Stop typing indicator
      sendTyping(conversationId, false);

      // If editing, update the message
      if (editingMessage) {
        console.log('[ChatScreen] Editing message:', editingMessage.id);
        try {
          const updated = await messagingAPI.editMessage(
            editingMessage.id,
            conversationId,
            content
          );
          console.log('[ChatScreen] Message edited successfully');
          setMessages(prev =>
            prev.map(msg =>
              msg.id === editingMessage.id
                ? { ...msg, ...updated, edited_at: updated.edited_at }
                : msg
            )
          );
          setEditingMessage(null);
        } catch (error) {
          console.error('[ChatScreen] Error editing message:', error);
        }
        return;
      }

      // Optimistic UI - add message immediately
      const tempMessage: MessageWithRelations = {
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
        reply_to_id: replyToId,
        reply_to: replyingTo || undefined,
      };

      console.log('[ChatScreen] Adding optimistic message:', tempMessage.id);
      setMessages(prev => [tempMessage, ...prev]);
      setReplyingTo(null);

      // Send via WebSocket
      console.log('[ChatScreen] Sending via WebSocket');
      wsSendMessage(conversationId, content, 'text', tempMessage.client_random);
    },
    [conversationId, userId, wsSendMessage, sendTyping, editingMessage, replyingTo]
  );

  const handleSendMedia = useCallback(
    async (uri: string, type: 'image' | 'video' | 'file', replyToId?: string) => {
      console.log('[ChatScreen] Sending media:', {
        type,
        uri: uri.substring(0, 50) + '...',
        replyToId,
      });
      // Stop typing indicator
      sendTyping(conversationId, false);

      try {
        // Create optimistic message
        const tempMessage: MessageWithRelations = {
          id: `temp-${Date.now()}`,
          conversation_id: conversationId,
          sender_id: userId,
          message_type: 'media',
          content: type === 'image' ? 'Photo' : type === 'video' ? 'Vidéo' : 'Fichier',
          metadata: {
            media_type: type,
            media_url: uri,
            thumbnail_url: uri, // For now, use same URI for thumbnail
          },
          client_random: Math.floor(Math.random() * 1000000),
          sent_at: new Date().toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
          status: 'sending',
          reply_to_id: replyToId,
          reply_to: replyingTo || undefined,
          attachments: [
            {
              id: `att-temp-${Date.now()}`,
              message_id: `temp-${Date.now()}`,
              media_id: `media-temp-${Date.now()}`,
              media_type: type,
              metadata: {
                filename: uri.split('/').pop() || 'media',
                media_url: uri,
                thumbnail_url: uri,
              },
              created_at: new Date().toISOString(),
            },
          ],
        };

        setMessages(prev => [tempMessage, ...prev]);
        setReplyingTo(null);

        // Send via API (mock for now)
        const sentMessage = await messagingAPI.sendMessage(conversationId, {
          content: tempMessage.content,
          message_type: 'media',
          client_random: tempMessage.client_random,
          metadata: tempMessage.metadata,
          reply_to_id: replyToId,
        });

        // Add attachment to mockStore
        if (tempMessage.attachments && tempMessage.attachments[0]) {
          mockStore.addAttachment(sentMessage.id, tempMessage.attachments[0]);
        }

        // Update message with real ID
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempMessage.id
              ? {
                  ...msg,
                  id: sentMessage.id,
                  status: 'sent' as const,
                }
              : msg
          )
        );
      } catch (error) {
        console.error('Error sending media:', error);
        // Update message status to failed
        setMessages(prev =>
          prev.map(msg =>
            msg.id.startsWith('temp-') && msg.status === 'sending'
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );
      }
    },
    [conversationId, userId, sendTyping, replyingTo]
  );

  const handleReactionPress = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        await messagingAPI.addReaction(messageId, userId, emoji);
        
        // Reload reactions and update local state
        const reactionData = await messagingAPI.getMessageReactions(messageId);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === messageId
              ? { ...msg, reactions: reactionData.reactions || [] }
              : msg
          )
        );
      } catch (error) {
        console.error('Error adding reaction:', error);
      }
    },
    [userId]
  );

  // Group messages by date and add date separators
  const messagesWithSeparators = useMemo(() => {
    if (messages.length === 0) return [];

    const result: Array<MessageWithRelations | { type: 'date'; date: Date; id: string }> = [];
    let lastDate: string | null = null;

    messages.forEach((message) => {
      const messageDate = new Date(message.sent_at);
      const dateKey = messageDate.toDateString();

      // Add date separator if date changed
      if (lastDate !== dateKey) {
        result.push({
          type: 'date',
          date: messageDate,
          id: `date-${dateKey}`,
        } as any);
        lastDate = dateKey;
      }

      result.push(message);
    });

    return result;
  }, [messages]);

  const scrollToMessage = useCallback((messageId: string) => {
    const index = messagesWithSeparators.findIndex(
      item => !(item as any).type && (item as MessageWithRelations).id === messageId
    );
    
    if (index !== -1 && flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5,
        });
      } catch (error) {
        console.error(`[ChatScreen] Error scrolling to message ${messageId}:`, error);
      }
    } else {
      console.warn(`[ChatScreen] Cannot scroll to message ${messageId} (index: ${index})`);
    }
  }, [messagesWithSeparators]);

  const handleReplyPress = useCallback(
    (messageId: string) => {
      scrollToMessage(messageId);
    },
    [scrollToMessage]
  );

  const handleMessageLongPress = useCallback((message: MessageWithRelations) => {
    setSelectedMessage(message);
    setShowActionsMenu(true);
  }, []);

  const handleEditMessage = useCallback(() => {
    if (selectedMessage) {
      setEditingMessage(selectedMessage);
      setShowActionsMenu(false);
    }
  }, [selectedMessage]);

  const handleDeleteMessage = useCallback(
    async (deleteForEveryone: boolean) => {
      if (!selectedMessage) return;

      try {
        await messagingAPI.deleteMessage(
          selectedMessage.id,
          conversationId,
          deleteForEveryone
        );

        if (deleteForEveryone) {
          // Update message to show "[Message supprimé]"
          setMessages(prev =>
            prev.map(msg =>
              msg.id === selectedMessage.id
                ? {
                    ...msg,
                    is_deleted: true,
                    delete_for_everyone: true,
                    content: '[Message supprimé]',
                  }
                : msg
            )
          );
        } else {
          // Remove from view
          setMessages(prev => prev.filter(msg => msg.id !== selectedMessage.id));
        }
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    },
    [selectedMessage, conversationId]
  );

  const handleStartReply = useCallback(() => {
    if (selectedMessage) {
      setReplyingTo(selectedMessage);
      setShowActionsMenu(false);
    }
  }, [selectedMessage]);

  const handleStartReaction = useCallback(() => {
    if (selectedMessage) {
      setReactionPickerMessageId(selectedMessage.id);
      setShowReactionPicker(true);
      setShowActionsMenu(false);
    }
  }, [selectedMessage]);

  const handlePinMessage = useCallback(async () => {
    if (!selectedMessage) return;

    try {
      const isCurrentlyPinned = pinnedMessages.some(m => m.id === selectedMessage.id);
      const action = isCurrentlyPinned ? 'unpin' : 'pin';
      
      if (isCurrentlyPinned) {
        await messagingAPI.unpinMessage(conversationId, selectedMessage.id);
      } else {
        await messagingAPI.pinMessage(conversationId, selectedMessage.id);
      }
      
      console.log(`[ChatScreen] Message ${action}ned: ${selectedMessage.id}`);
      await loadPinnedMessages();
      
      setMessages(prev =>
        prev.map(msg =>
          msg.id === selectedMessage.id
            ? { ...msg, is_pinned: !isCurrentlyPinned }
            : msg
        )
      );
    } catch (error) {
      const isCurrentlyPinned = pinnedMessages.some(m => m.id === selectedMessage.id);
      console.error(`[ChatScreen] Error ${isCurrentlyPinned ? 'unpinning' : 'pinning'} message:`, error);
    }
  }, [selectedMessage, conversationId, pinnedMessages, loadPinnedMessages]);

  const handlePinnedMessagePress = useCallback(
    (messageId: string) => {
      if (!messages.some(m => m.id === messageId)) {
        console.warn(`[ChatScreen] Pinned message not found: ${messageId}`);
        return;
      }
      scrollToMessage(messageId);
    },
    [scrollToMessage, messages]
  );

  const handleReactionSelectFromPicker = useCallback(
    async (emoji: string) => {
      if (reactionPickerMessageId) {
        await handleReactionPress(reactionPickerMessageId, emoji);
        setShowReactionPicker(false);
        setReactionPickerMessageId(null);
      }
    },
    [reactionPickerMessageId, handleReactionPress]
  );

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const results = messages.filter(msg => {
        if (msg.message_type === 'system') return false;
        return msg.content?.toLowerCase().includes(query.toLowerCase());
      });
      setSearchResults(results);
      setCurrentSearchIndex(0);
      
      // Scroll to first result
      if (results.length > 0 && flatListRef.current) {
        const firstResultIndex = messagesWithSeparators.findIndex(
          item => !(item as any).type && (item as MessageWithRelations).id === results[0].id
        );
        if (firstResultIndex !== -1) {
          try {
            flatListRef.current.scrollToIndex({
              index: firstResultIndex,
              animated: true,
              viewPosition: 0.5,
            });
          } catch (error) {
            // Ignore scroll errors
          }
        }
      }
    } else {
      setSearchResults([]);
      setCurrentSearchIndex(0);
    }
  }, [messages, messagesWithSeparators]);

  const handleSearchNext = useCallback(() => {
    if (currentSearchIndex < searchResults.length - 1) {
      const newIndex = currentSearchIndex + 1;
      setCurrentSearchIndex(newIndex);
      const result = searchResults[newIndex];
      const resultIndex = messagesWithSeparators.findIndex(
        item => !(item as any).type && (item as MessageWithRelations).id === result.id
      );
      if (resultIndex !== -1 && flatListRef.current) {
        try {
          flatListRef.current.scrollToIndex({
            index: resultIndex,
            animated: true,
            viewPosition: 0.5,
          });
        } catch (error) {
          // Ignore scroll errors
        }
      }
    }
  }, [currentSearchIndex, searchResults, messagesWithSeparators]);

  const handleSearchPrevious = useCallback(() => {
    if (currentSearchIndex > 0) {
      const newIndex = currentSearchIndex - 1;
      setCurrentSearchIndex(newIndex);
      const result = searchResults[newIndex];
      const resultIndex = messagesWithSeparators.findIndex(
        item => !(item as any).type && (item as MessageWithRelations).id === result.id
      );
      if (resultIndex !== -1 && flatListRef.current) {
        try {
          flatListRef.current.scrollToIndex({
            index: resultIndex,
            animated: true,
            viewPosition: 0.5,
          });
        } catch (error) {
          // Ignore scroll errors
        }
      }
    }
  }, [currentSearchIndex, searchResults, messagesWithSeparators]);

  const handleInfoPress = useCallback(() => {
    console.log('[ChatScreen] Info button pressed');
    console.log('[ChatScreen] Current conversation:', {
      id: conversation?.id,
      name: conversation?.display_name,
      type: conversation?.type,
    });
    setShowInfoModal(true);
    console.log('[ChatScreen] Info modal opened');
  }, [conversation]);

  const renderItem = useCallback(
    ({ item }: { item: MessageWithRelations | { type: 'date'; date: Date; id: string } }) => {
      // Check if it's a date separator
      if ((item as any).type === 'date') {
        return <DateSeparator date={(item as any).date} />;
      }

      const message = item as MessageWithRelations;
      
      // Handle system messages
      if (message.message_type === 'system') {
        return <SystemMessage content={message.content} />;
      }

      const isSent = message.sender_id === userId;
      const isHighlighted = Boolean(searchQuery.trim() && searchResults.some(r => r.id === message.id));
      
      return (
        <MessageBubble
          message={message}
          isSent={isSent}
          currentUserId={userId}
          onReactionPress={handleReactionPress}
          onReplyPress={handleReplyPress}
          onLongPress={() => handleMessageLongPress(message)}
          isHighlighted={isHighlighted}
        />
      );
    },
    [userId, handleReactionPress, handleReplyPress, handleMessageLongPress, searchQuery, searchResults]
  );

  const keyExtractor = useCallback(
    (item: MessageWithRelations | { type: 'date'; date: Date; id: string }) => {
      if ((item as any).type === 'date') {
        return (item as any).id;
      }
      return (item as MessageWithRelations).id;
    },
    []
  );

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <ChatHeader
          conversationName={conversation?.display_name || 'Contact'}
          conversationType={conversation?.type || 'direct'}
          isOnline={false}
          onSearchPress={() => setShowSearch(true)}
          onInfoPress={handleInfoPress}
        />
        {showPinnedBar && pinnedMessages.length > 0 && (
          <PinnedMessagesBar
            pinnedMessages={pinnedMessages}
            onMessagePress={handlePinnedMessagePress}
            onClose={() => setShowPinnedBar(false)}
          />
        )}
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
        <FlatList
          ref={flatListRef}
          data={messagesWithSeparators}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          inverted
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={15}
          windowSize={10}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.3}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !loading && messages.length === 0 ? (
              <EmptyChatState conversationName="Contact" />
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={themeColors.primary} />
              </View>
            ) : typingUsers.length > 0 ? (
              <TypingIndicator />
            ) : null
          }
        />
        <MessageInput
          onSend={handleSendMessage}
          onSendMedia={handleSendMedia}
          onTyping={(typing) => sendTyping(conversationId, typing)}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
        />
      </KeyboardAvoidingView>
      <MessageActionsMenu
        visible={showActionsMenu}
        message={selectedMessage}
        isSent={selectedMessage?.sender_id === userId}
        isPinned={pinnedMessages.some(m => m.id === selectedMessage?.id)}
        onClose={() => {
          setShowActionsMenu(false);
          setSelectedMessage(null);
        }}
        onReply={handleStartReply}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onReact={handleStartReaction}
        onPin={handlePinMessage}
      />
      {showReactionPicker && (
        <ReactionPicker
          visible={showReactionPicker}
          onClose={() => {
            setShowReactionPicker(false);
            setReactionPickerMessageId(null);
          }}
          onReactionSelect={handleReactionSelectFromPicker}
        />
      )}
      <MessageSearch
        visible={showSearch}
        onClose={() => {
          setShowSearch(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
        onSearch={handleSearch}
        resultsCount={searchResults.length}
        currentIndex={currentSearchIndex}
        onNext={handleSearchNext}
        onPrevious={handleSearchPrevious}
      />
      <Modal
        visible={showInfoModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          console.log('[ChatScreen] Info modal closed (back button)');
          setShowInfoModal(false);
        }}
        onShow={() => {
          console.log('[ChatScreen] Info modal shown');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background.primary }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text.primary }]}>
                Informations de la conversation
              </Text>
              <TouchableOpacity
                onPress={() => {
                  console.log('[ChatScreen] Info modal close button clicked');
                  setShowInfoModal(false);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={themeColors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={[styles.infoSection, { borderBottomWidth: 0, marginBottom: 0 }]}>
                <Avatar
                  size={80}
                  uri={conversation?.avatar_url}
                  name={conversation?.display_name || 'Contact'}
                  showOnlineBadge={conversation?.type === 'direct'}
                  isOnline={false}
                />
                <Text style={[styles.infoValue, { color: themeColors.text.primary, marginTop: 16, fontSize: 22 }]}>
                  {conversation?.display_name || 'Contact'}
                </Text>
                {conversation?.type === 'direct' && (
                  <Text style={[styles.infoLabel, { color: themeColors.text.secondary, marginTop: 4, textTransform: 'none', fontSize: 14 }]}>
                    Hors ligne
                  </Text>
                )}
              </View>
              <View style={styles.infoSection}>
                <Text style={[styles.infoLabel, { color: themeColors.text.secondary }]}>
                  Type
                </Text>
                <Text style={[styles.infoValue, { color: themeColors.text.primary }]}>
                  {conversation?.type === 'group' ? 'Groupe' : 'Conversation directe'}
                </Text>
              </View>
              <View style={styles.infoSection}>
                <Text style={[styles.infoLabel, { color: themeColors.text.secondary }]}>
                  Messages
                </Text>
                <Text style={[styles.infoValue, { color: themeColors.text.primary }]}>
                  {messages.length} message{messages.length > 1 ? 's' : ''}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  },
  keyboardView: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    backgroundColor: 'rgba(26, 31, 58, 0.95)',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    borderLeftColor: 'rgba(255, 255, 255, 0.05)',
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalBody: {
    padding: 20,
  },
  infoSection: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoLabel: {
    fontSize: 11,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.6,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '500',
  },
});
