/**
 * SystemMessage - Display system messages (join, leave, etc.)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface SystemMessageProps {
  content: string;
}

export const SystemMessage: React.FC<SystemMessageProps> = ({ content }) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: themeColors.text.secondary }]}>
        {content}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

