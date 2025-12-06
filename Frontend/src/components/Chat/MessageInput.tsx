/**
 * MessageInput - Message input component with send button
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Alert, FlatList, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { Message } from '../../types/messaging';
import { ReplyPreview } from './ReplyPreview';
import { Avatar } from './Avatar';

interface MessageInputProps {
  onSend: (message: string, replyToId?: string, mentions?: string[]) => void;
  onSendMedia?: (uri: string, type: 'image' | 'video' | 'file', replyToId?: string) => void;
  onTyping?: (typing: boolean) => void;
  placeholder?: string;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  conversationType?: 'direct' | 'group';
  members?: Array<{ id: string; display_name: string; username?: string }>;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onSendMedia,
  onTyping,
  placeholder = 'Message...',
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  conversationType = 'direct',
  members = [],
}) => {
  const [text, setText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  // Update text when editing message changes
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content);
    } else if (!replyingTo) {
      setText('');
    }
  }, [editingMessage, replyingTo]);

  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText);

      // Check for @ mentions (only in groups)
      if (conversationType === 'group' && members.length > 0) {
        const lastAtIndex = newText.lastIndexOf('@');
        const cursorPos = newText.length;
        
        if (lastAtIndex !== -1) {
          // Check if @ is followed by space or is at the end
          const afterAt = newText.substring(lastAtIndex + 1);
          const spaceIndex = afterAt.indexOf(' ');
          
          if (spaceIndex === -1 || spaceIndex === afterAt.length - 1) {
            // We're in a mention
            const query = spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
            setMentionQuery(query.toLowerCase());
            setMentionStartIndex(lastAtIndex);
            setShowMentions(true);
          } else {
            setShowMentions(false);
          }
        } else {
          setShowMentions(false);
        }
      }

      // Send typing_start on first keystroke
      if (newText.length === 1 && !typingTimeoutRef.current) {
        onTyping?.(true);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Send typing_stop after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false);
        typingTimeoutRef.current = null;
      }, 3000);
    },
    [onTyping, conversationType, members]
  );

  const handleMentionSelect = useCallback((member: { id: string; display_name: string; username?: string }) => {
    if (mentionStartIndex === -1) return;
    
    const beforeMention = text.substring(0, mentionStartIndex);
    const afterMention = text.substring(mentionStartIndex).replace(/@[^\s]*/, '');
    const mentionText = member.username ? `@${member.username} ` : `@${member.display_name} `;
    const newText = beforeMention + mentionText + afterMention;
    
    setText(newText);
    setShowMentions(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
    
    // Focus back on input
    inputRef.current?.focus();
  }, [text, mentionStartIndex]);

  const handleSend = useCallback(() => {
    if (text.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Extract mentions from text
      const mentionRegex = /@(\w+)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(text)) !== null) {
        const username = match[1];
        const member = members.find(m => m.username === username || m.display_name.toLowerCase() === username.toLowerCase());
        if (member) {
          mentions.push(member.id);
        }
      }
      
      onSend(text.trim(), replyingTo?.id, mentions.length > 0 ? mentions : undefined);
      setText('');
      setShowMentions(false);
      onCancelReply?.();
      onCancelEdit?.();
    }
  }, [text, onSend, replyingTo, onCancelReply, onCancelEdit, members]);

  const handlePickImage = useCallback(async () => {
    console.log('[MessageInput] Starting image picker');
    try {
      // Request permissions
      console.log('[MessageInput] Requesting media library permissions');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[MessageInput] Permission status:', status);
      
      if (status !== 'granted') {
        console.log('[MessageInput] Permission denied');
        Alert.alert('Permission requise', 'Nous avons besoin de votre permission pour accéder à vos photos.');
        return;
      }

      // Launch image picker
      console.log('[MessageInput] Launching image picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('[MessageInput] Image picker result:', {
        canceled: result.canceled,
        assetsCount: result.assets?.length || 0,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        console.log('[MessageInput] Image selected:', {
          uri: asset.uri?.substring(0, 50) + '...',
          width: asset.width,
          height: asset.height,
          type: asset.type,
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSendMedia?.(asset.uri, 'image', replyingTo?.id);
        onCancelReply?.();
      } else {
        console.log('[MessageInput] Image picker canceled or no assets');
      }
    } catch (error: any) {
      console.error('[MessageInput] Error picking image:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack?.substring(0, 200),
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      Alert.alert(
        'Erreur', 
        `Impossible de sélectionner une image.${error?.message ? `\n\n${error.message}` : ''}`
      );
    }
  }, [onSendMedia, replyingTo, onCancelReply]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: 'transparent' },
      ]}
    >
      {(replyingTo || editingMessage) && (
        <View
          style={[
            styles.replyContainer,
            { backgroundColor: 'rgba(26, 31, 58, 0.6)' }, // Dark card with transparency
          ]}
        >
          {replyingTo && <ReplyPreview replyTo={replyingTo} />}
          {editingMessage && (
            <View style={styles.editContainer}>
              <Text style={[styles.editLabel, { color: themeColors.primary }]}>
                Modifier le message
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={replyingTo ? onCancelReply : onCancelEdit}
            style={styles.cancelReplyButton}
          >
            <Ionicons
              name="close"
              size={20}
              color={themeColors.text.secondary}
            />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputContainer}>
        {!editingMessage && (
          <TouchableOpacity
            onPress={handlePickImage}
            style={styles.attachButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name="image-outline"
              size={24}
              color={themeColors.text.secondary}
            />
          </TouchableOpacity>
        )}
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                color: themeColors.text.primary,
                backgroundColor: 'rgba(26, 31, 58, 0.6)', // Dark card with transparency
              },
            ]}
            value={text}
            onChangeText={handleTextChange}
            placeholder={
              editingMessage
                ? 'Modifier le message...'
                : replyingTo
                ? 'Répondre...'
                : placeholder
            }
            placeholderTextColor={themeColors.text.tertiary}
            multiline
            maxLength={1000}
          />
          {showMentions && conversationType === 'group' && members.length > 0 && (
            <View style={[styles.mentionsList, { backgroundColor: 'rgba(26, 31, 58, 0.95)' }]}>
              <ScrollView style={styles.mentionsScroll} nestedScrollEnabled>
                {members
                  .filter(member => {
                    if (!mentionQuery) return true;
                    const name = member.display_name.toLowerCase();
                    const username = member.username?.toLowerCase() || '';
                    return name.includes(mentionQuery) || username.includes(mentionQuery);
                  })
                  .slice(0, 5)
                  .map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={styles.mentionItem}
                      onPress={() => handleMentionSelect(member)}
                      activeOpacity={0.7}
                    >
                      <Avatar
                        size={32}
                        name={member.display_name}
                        showOnlineBadge={false}
                        isOnline={false}
                      />
                      <View style={styles.mentionInfo}>
                        <Text style={[styles.mentionName, { color: themeColors.text.primary }]}>
                          {member.display_name}
                        </Text>
                        {member.username && (
                          <Text style={[styles.mentionUsername, { color: themeColors.text.secondary }]}>
                            @{member.username}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim()}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#FFB07B', '#F04882']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          >
            <Text style={styles.sendIcon}>→</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelReplyButton: {
    marginLeft: 'auto',
    padding: 4,
  },
  editContainer: {
    flex: 1,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  attachButton: {
    marginRight: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    marginRight: 8,
  },
  input: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  mentionsList: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    maxHeight: 200,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  mentionsScroll: {
    maxHeight: 200,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  mentionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  mentionName: {
    fontSize: 15,
    fontWeight: '600',
  },
  mentionUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendIcon: {
    color: colors.text.light,
    fontSize: 20,
    fontWeight: '600',
  },
});

