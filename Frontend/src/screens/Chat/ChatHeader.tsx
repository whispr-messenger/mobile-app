/**
 * ChatHeader - Header component for ChatScreen
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { Avatar } from '../../components/Chat/Avatar';

interface ChatHeaderProps {
  conversationName: string;
  isOnline?: boolean;
  conversationType: 'direct' | 'group';
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversationName,
  isOnline = false,
  conversationType,
}) => {
  const navigation = useNavigation();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: 'transparent' },
      ]}
    >
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Ionicons
          name="arrow-back"
          size={24}
          color={themeColors.text.primary}
        />
      </TouchableOpacity>
      <Avatar
        size={32}
        name={conversationName}
        showOnlineBadge={conversationType === 'direct'}
        isOnline={isOnline}
      />
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: themeColors.text.primary }]}
          numberOfLines={1}
        >
          {conversationName}
        </Text>
        {conversationType === 'direct' && (
          <Text
            style={[styles.status, { color: themeColors.text.secondary }]}
            numberOfLines={1}
          >
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    fontSize: 12,
    marginTop: 2,
  },
});


