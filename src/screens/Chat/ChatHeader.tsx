/**
 * ChatHeader - Header component for ChatScreen
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { Avatar } from '../../components/Chat/Avatar';

interface ChatHeaderProps {
  conversationName: string;
  avatarUrl?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
  conversationType: 'direct' | 'group';
  onSearchPress?: () => void;
  onInfoPress?: () => void;
  onScheduledPress?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversationName,
  avatarUrl,
  isOnline = false,
  lastSeenAt,
  conversationType,
  onSearchPress,
  onInfoPress,
  onScheduledPress,
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
        uri={avatarUrl}
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
            style={[styles.status, { color: isOnline ? colors.status.online : themeColors.text.secondary }]}
            numberOfLines={1}
          >
            {isOnline
              ? 'En ligne'
              : lastSeenAt
                ? `Vu \u00e0 ${new Date(lastSeenAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Hors ligne'}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        {onScheduledPress && (
          <TouchableOpacity
            onPress={onScheduledPress}
            style={styles.actionButton}
          >
            <Ionicons
              name="timer-outline"
              size={22}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
        )}
        {onSearchPress && (
          <TouchableOpacity
            onPress={onSearchPress}
            style={styles.actionButton}
          >
            <Ionicons
              name="search"
              size={22}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            onInfoPress?.();
          }}
          style={styles.actionButton}
        >
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={themeColors.text.primary}
          />
        </TouchableOpacity>
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
});

