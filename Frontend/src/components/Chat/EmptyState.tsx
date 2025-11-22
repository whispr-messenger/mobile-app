/**
 * EmptyState - Empty state component for conversations list
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

export const EmptyState: React.FC = () => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: themeColors.text.primary }]}>
        Aucune conversation
      </Text>
      <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
        Commencez une nouvelle conversation pour démarrer
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
});

