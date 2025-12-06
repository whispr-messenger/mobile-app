/**
 * SettingsScreen - Application Settings
 * WHISPR-133: Implement SettingsScreen with app configuration
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '../../theme';

export const SettingsScreen: React.FC = () => {
  return (
    <LinearGradient
      colors={[colors.background.primary, colors.background.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Paramètres</Text>
        <Text style={styles.subtitle}>Coming Soon...</Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default SettingsScreen;




