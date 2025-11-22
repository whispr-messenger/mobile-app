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
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  placeholder = 'Message...',
}) => {
  const [text, setText] = useState('');
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

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
        onChangeText={setText}
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
          colors={[colors.primary.main, colors.primary.light]}
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
    borderTopColor: colors.ui.divider,
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

