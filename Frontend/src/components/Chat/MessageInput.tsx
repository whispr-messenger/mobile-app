/**
 * MessageInput - Message input component with send button
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { Message } from '../../types/messaging';
import { ReplyPreview } from './ReplyPreview';

interface MessageInputProps {
  onSend: (message: string, replyToId?: string) => void;
  onTyping?: (typing: boolean) => void;
  placeholder?: string;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onTyping,
  placeholder = 'Message...',
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
}) => {
  const [text, setText] = useState('');
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
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
    [onTyping]
  );

  const handleSend = useCallback(() => {
    if (text.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSend(text.trim(), replyingTo?.id);
      setText('');
      onCancelReply?.();
      onCancelEdit?.();
    }
  }, [text, onSend, replyingTo, onCancelReply, onCancelEdit]);

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
        <TextInput
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
    borderTopColor: colors.ui.divider,
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
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 8,
    fontSize: 15,
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

