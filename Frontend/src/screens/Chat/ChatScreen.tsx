/**
 * ChatScreen - Individual conversation chat interface
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '../../context/ThemeContext';
import { Message, MessageWithStatus, MessageWithRelations } from '../../types/messaging';
import { messagingAPI } from '../../services/messaging/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { MessageBubble } from '../../components/Chat/MessageBubble';
import { MessageInput } from '../../components/Chat/MessageInput';
import { TypingIndicator } from '../../components/Chat/TypingIndicator';
import { MessageActionsMenu } from '../../components/Chat/MessageActionsMenu';
import { ReactionPicker } from '../../components/Chat/ReactionPicker';
import { DateSeparator } from '../../components/Chat/DateSeparator';
import { ChatHeader } from './ChatHeader';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { colors } from '../../theme/colors';

type ChatScreenRouteProp = StackScreenProps<AuthStackParamList, 'Chat'>['route'];

export const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const { conversationId } = route.params;
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

  useEffect(() => {
    loadMessages();
    // Join conversation channel
    const channel = joinConversationChannel(conversationId);
    conversationChannelRef.current = channel;

    return () => {
      channel?.leave();
    };
  }, [conversationId, joinConversationChannel]);

  const loadMessages = useCallback(async (before?: string) => {
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

      // Load reactions and enrich messages
      const messagesWithRelations: MessageWithRelations[] = await Promise.all(
        data
          .filter(msg => msg && (msg.content || msg.is_deleted)) // Include deleted messages (they show "[Message supprimé]")
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

            // Find reply_to message if exists (search in all messages, not just current page)
            let replyTo: Message | undefined;
            if (msg.reply_to_id) {
              // First search in current batch
              replyTo = data.find(m => m.id === msg.reply_to_id);
              // If not found, search in already loaded messages
              if (!replyTo && messages.length > 0) {
                replyTo = messages.find(m => m.id === msg.reply_to_id);
              }
            }

            return {
              ...msg,
              status,
              reactions,
              reply_to: replyTo,
            } as MessageWithRelations;
          })
      );

      if (before) {
        // Loading older messages - append to end
        setMessages(prev => [...prev, ...messagesWithRelations]);
        setHasMore(messagesWithRelations.length === 50);
      } else {
        // Initial load
        setMessages(messagesWithRelations);
        setHasMore(messagesWithRelations.length === 50);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
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
      // Stop typing indicator
      sendTyping(conversationId, false);

      // If editing, update the message
      if (editingMessage) {
        try {
          const updated = await messagingAPI.editMessage(
            editingMessage.id,
            conversationId,
            content
          );
          setMessages(prev =>
            prev.map(msg =>
              msg.id === editingMessage.id
                ? { ...msg, ...updated, edited_at: updated.edited_at }
                : msg
            )
          );
          setEditingMessage(null);
        } catch (error) {
          console.error('Error editing message:', error);
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

      setMessages(prev => [tempMessage, ...prev]);
      setReplyingTo(null);

      // Send via WebSocket
      wsSendMessage(conversationId, content, 'text', tempMessage.client_random);
    },
    [conversationId, userId, wsSendMessage, sendTyping, editingMessage, replyingTo]
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

  const handleReplyPress = useCallback(
    (messageId: string) => {
      const index = messages.findIndex(m => m.id === messageId);
      if (index !== -1 && flatListRef.current) {
        // Scroll to message (inverted list)
        try {
          flatListRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5, // Center the message
          });
        } catch (error) {
          // Fallback if scrollToIndex fails
          console.error('Error scrolling to message:', error);
        }
      }
    },
    [messages]
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

  const renderItem = useCallback(
    ({ item }: { item: MessageWithRelations }) => {
      const isSent = item.sender_id === userId;
      return (
        <MessageBubble
          message={item}
          isSent={isSent}
          currentUserId={userId}
          onReactionPress={handleReactionPress}
          onReplyPress={handleReplyPress}
          onLongPress={() => handleMessageLongPress(item)}
        />
      );
    },
    [userId, handleReactionPress, handleReplyPress, handleMessageLongPress]
  );

  const keyExtractor = useCallback((item: MessageWithStatus) => item.id, []);

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <ChatHeader
          conversationName="Contact"
          conversationType="direct"
          isOnline={false}
        />
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
        onClose={() => {
          setShowActionsMenu(false);
          setSelectedMessage(null);
        }}
        onReply={handleStartReply}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onReact={handleStartReaction}
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
});
