/**
 * EmptyState - Empty state component for conversations list
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

export const EmptyState: React.FC = () => {
  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Text style={[styles.title, { color: '#FFFFFF' }]}>
        Aucune conversation
      </Text>
      <Text style={[styles.subtitle, { color: 'rgba(255, 255, 255, 0.7)' }]}>
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


