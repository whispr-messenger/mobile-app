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
  isOnline?: boolean;
  conversationType: 'direct' | 'group';
  onSearchPress?: () => void;
  onInfoPress?: () => void;
  onGalleryPress?: () => void;
  mediaCount?: number;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversationName,
  isOnline = false,
  conversationType,
  onSearchPress,
  onInfoPress,
  onGalleryPress,
  mediaCount = 0,
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
      <View style={styles.actions}>
        {onGalleryPress && mediaCount > 0 && (
          <TouchableOpacity
            onPress={onGalleryPress}
            style={styles.actionButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="images"
              size={22}
              color={themeColors.text.primary}
            />
            {mediaCount > 0 && (
              <View style={styles.mediaBadge}>
                <Text style={styles.mediaBadgeText}>{mediaCount > 99 ? '99+' : mediaCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {onSearchPress && (
          <TouchableOpacity
            onPress={onSearchPress}
            style={styles.actionButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
            console.log('[ChatHeader] Info button clicked');
            console.log('[ChatHeader] onInfoPress function:', typeof onInfoPress);
            onInfoPress?.();
          }}
          style={styles.actionButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
    position: 'relative',
  },
  mediaBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.primary.main,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.background.dark,
  },
  mediaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.light,
  },
});


