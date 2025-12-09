/**
 * MessageSearch - Search bar for messages with navigation
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface MessageSearchProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  resultsCount: number;
  currentIndex: number;
  onNext?: () => void;
  onPrevious?: () => void;
}

export const MessageSearch: React.FC<MessageSearchProps> = ({
  visible,
  onClose,
  onSearch,
  resultsCount,
  currentIndex,
  onNext,
  onPrevious,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) {
      // Reset query when search is opened
      setQuery('');
    }
  }, [visible]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    onSearch(text);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['rgba(11, 17, 36, 0.98)', 'rgba(60, 46, 124, 0.98)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.searchContainer}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
            </TouchableOpacity>
            <View style={styles.inputContainer}>
              <Ionicons name="search" size={20} color={themeColors.text.secondary} style={styles.searchIcon} />
              <TextInput
                style={[styles.input, { color: themeColors.text.primary }]}
                placeholder="Rechercher dans les messages..."
                placeholderTextColor={themeColors.text.tertiary}
                value={query}
                onChangeText={handleQueryChange}
                autoFocus
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setQuery('');
                    onSearch('');
                  }}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color={themeColors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {resultsCount > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={[styles.resultsText, { color: themeColors.text.secondary }]}>
                {currentIndex + 1} / {resultsCount}
              </Text>
              <View style={styles.navigationButtons}>
                <TouchableOpacity
                  onPress={onPrevious}
                  disabled={currentIndex === 0}
                  style={[
                    styles.navButton,
                    currentIndex === 0 && styles.navButtonDisabled,
                  ]}
                >
                  <Ionicons
                    name="chevron-up"
                    size={20}
                    color={currentIndex === 0 ? themeColors.text.tertiary : themeColors.text.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onNext}
                  disabled={currentIndex >= resultsCount - 1}
                  style={[
                    styles.navButton,
                    currentIndex >= resultsCount - 1 && styles.navButtonDisabled,
                  ]}
                >
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={currentIndex >= resultsCount - 1 ? themeColors.text.tertiary : themeColors.text.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
          {query.length > 0 && resultsCount === 0 && (
            <View style={styles.noResultsContainer}>
              <Text style={[styles.noResultsText, { color: themeColors.text.secondary }]}>
                Aucun résultat trouvé
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  gradient: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: {
    padding: 4,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  resultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  resultsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  noResultsContainer: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  noResultsText: {
    fontSize: 14,
    textAlign: 'center',
  },
});







