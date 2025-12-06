/**
 * ReactionPicker - Quick reaction picker with common emojis
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onReactionSelect: (emoji: string) => void;
}

const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  visible,
  onClose,
  onReactionSelect,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const handleReactionSelect = (emoji: string) => {
    onReactionSelect(emoji);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: themeColors.background.secondary },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {QUICK_REACTIONS.map(emoji => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionButton}
              onPress={() => handleReactionSelect(emoji)}
              activeOpacity={0.7}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  reactionButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  emoji: {
    fontSize: 28,
  },
});

