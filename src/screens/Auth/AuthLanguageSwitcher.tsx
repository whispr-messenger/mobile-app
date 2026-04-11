import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

export const AuthLanguageSwitcher: React.FC = () => {
  const { settings, updateSettings, getLocalizedText } = useTheme();

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => void updateSettings({ language: 'fr' })}
        style={[styles.chip, settings.language === 'fr' && styles.chipActive]}
        accessibilityLabel={getLocalizedText('settings.language.fr')}
        accessibilityState={{ selected: settings.language === 'fr' }}
      >
        <Text style={[styles.chipText, settings.language === 'fr' && styles.chipTextActive]}>FR</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => void updateSettings({ language: 'en' })}
        style={[styles.chip, settings.language === 'en' && styles.chipActive]}
        accessibilityLabel={getLocalizedText('settings.language.en')}
        accessibilityState={{ selected: settings.language === 'en' }}
      >
        <Text style={[styles.chipText, settings.language === 'en' && styles.chipTextActive]}>EN</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  chipActive: {
    borderColor: colors.primary.main,
    backgroundColor: 'rgba(254, 122, 92, 0.22)',
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  chipTextActive: {
    color: colors.text.light,
  },
});
