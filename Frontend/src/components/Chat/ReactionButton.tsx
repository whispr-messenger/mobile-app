/**
 * ReactionButton - Individual reaction button with emoji and count
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface ReactionButtonProps {
  emoji: string;
  count: number;
  isActive: boolean;
  onPress: () => void;
}

export const ReactionButton: React.FC<ReactionButtonProps> = ({
  emoji,
  count,
  isActive,
  onPress,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: isActive
            ? colors.primary.light + '30'
            : themeColors.background.secondary,
          borderColor: isActive ? themeColors.primary : colors.ui.divider,
        },
      ]}
      activeOpacity={0.7}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      {count > 0 && (
        <Text
          style={[
            styles.count,
            { color: isActive ? themeColors.primary : themeColors.text.secondary },
          ]}
        >
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 4,
  },
  emoji: {
    fontSize: 16,
    marginRight: 4,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
  },
});

