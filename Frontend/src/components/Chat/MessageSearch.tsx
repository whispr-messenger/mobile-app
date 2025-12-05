/**
 * MessageSearch - Search bar for messages in conversation
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

interface MessageSearchProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  resultsCount?: number;
  currentIndex?: number;
  onNext?: () => void;
  onPrevious?: () => void;
}

export const MessageSearch: React.FC<MessageSearchProps> = ({
  visible,
  onClose,
  onSearch,
  resultsCount = 0,
  currentIndex = 0,
  onNext,
  onPrevious,
}) => {
  const [query, setQuery] = useState('');
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const handleSearch = (text: string) => {
    setQuery(text);
    onSearch(text);
  };

  const handleClose = () => {
    setQuery('');
    onSearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: 'rgba(26, 31, 58, 0.95)' },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.text.primary,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            ]}
            value={query}
            onChangeText={handleSearch}
            placeholder="Rechercher dans les messages..."
            placeholderTextColor={themeColors.text.tertiary}
            autoFocus
          />
          {query.length > 0 && resultsCount > 0 && (
            <View style={styles.resultsInfo}>
              <Text style={[styles.resultsText, { color: themeColors.text.secondary }]}>
                {currentIndex + 1} / {resultsCount}
              </Text>
              <TouchableOpacity
                onPress={onPrevious}
                style={styles.navButton}
                disabled={currentIndex === 0}
              >
                <Ionicons
                  name="chevron-up"
                  size={20}
                  color={currentIndex === 0 ? themeColors.text.tertiary : themeColors.text.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onNext}
                style={styles.navButton}
                disabled={currentIndex >= resultsCount - 1}
              >
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={currentIndex >= resultsCount - 1 ? themeColors.text.tertiary : themeColors.text.primary}
                />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={themeColors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    marginRight: 8,
  },
  resultsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  resultsText: {
    fontSize: 12,
    marginRight: 8,
  },
  navButton: {
    padding: 4,
    marginHorizontal: 2,
  },
  closeButton: {
    padding: 4,
  },
});




