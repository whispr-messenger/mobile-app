/**
 * MessageInput - Message input component with send button
 */

import React, { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface MessageInputProps {
  onSend: (message: string) => void;
  onTyping?: (typing: boolean) => void;
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onTyping,
  placeholder = 'Message...',
}) => {
  const [text, setText] = useState('');
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

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
      onSend(text.trim());
      setText('');
    }
  }, [text, onSend]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.background.primary },
      ]}
    >
      <TextInput
        style={[
          styles.input,
          {
            color: themeColors.text.primary,
            backgroundColor: themeColors.background.secondary,
          },
        ]}
        value={text}
        onChangeText={handleTextChange}
        placeholder={placeholder}
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
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 176, 123, 0.1)',
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

