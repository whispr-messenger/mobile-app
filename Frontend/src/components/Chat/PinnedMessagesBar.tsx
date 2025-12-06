/**
 * PinnedMessagesBar - Display pinned messages bar at top of chat
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { Message } from '../../types/messaging';

interface PinnedMessagesBarProps {
  pinnedMessages: Message[];
  onMessagePress: (messageId: string) => void;
  onClose: () => void;
}

export const PinnedMessagesBar: React.FC<PinnedMessagesBarProps> = ({
  pinnedMessages,
  onMessagePress,
  onClose,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  if (pinnedMessages.length === 0) return null;

  return (
    <LinearGradient
      colors={['rgba(26, 31, 58, 0.95)', 'rgba(26, 31, 58, 0.98)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="pin" size={16} color={colors.primary.main} />
          <Text style={[styles.headerText, { color: themeColors.text.primary }]}>
            Messages épinglés ({pinnedMessages.length})
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={themeColors.text.secondary} />
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {pinnedMessages.map((message) => {
          const preview = message.content?.substring(0, 50) || '[Message supprimé]';
          return (
            <TouchableOpacity
              key={message.id}
              style={styles.pinnedItem}
              onPress={() => {
                console.log('[PinnedMessagesBar] Pinned message item pressed:', message.id);
                onMessagePress(message.id);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.pinnedText, { color: themeColors.text.secondary }]}
                numberOfLines={1}
              >
                {preview}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  pinnedItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
    maxWidth: 200,
  },
  pinnedText: {
    fontSize: 12,
  },
});




