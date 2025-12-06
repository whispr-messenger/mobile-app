/**
 * DateSeparator - Display date separator between message groups
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface DateSeparatorProps {
  date: Date;
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const formatDate = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = date.toDateString();
    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();

    if (dateStr === todayStr) {
      return "Aujourd'hui";
    } else if (dateStr === yesterdayStr) {
      return 'Hier';
    } else {
      // Format: "Lundi 15 janvier" or "15/01/2024" if older than 7 days
      const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 7) {
        return date.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
      } else {
        return date.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.line, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} />
      <Text style={[styles.dateText, { color: themeColors.text.secondary }]}>
        {formatDate(date)}
      </Text>
      <View style={[styles.line, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 1,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    textTransform: 'capitalize',
  },
});

