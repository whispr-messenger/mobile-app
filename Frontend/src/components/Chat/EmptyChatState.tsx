/**
 * EmptyChatState - Empty state when no messages in conversation
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface EmptyChatStateProps {
  conversationName?: string;
}

export const EmptyChatState: React.FC<EmptyChatStateProps> = ({
  conversationName = 'Contact',
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={['#FFB07B', '#F04882']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <Ionicons name="chatbubbles-outline" size={48} color={colors.text.light} />
        </LinearGradient>
      </View>
      <Text style={[styles.title, { color: themeColors.text.primary }]}>
        Aucun message
      </Text>
      <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
        Commencez la conversation avec {conversationName}
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
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

