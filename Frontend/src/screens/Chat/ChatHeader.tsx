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
  onCallPress?: () => void;
  onVideoCallPress?: () => void;
  participantId?: string;
  participantUsername?: string;
  participantAvatarUrl?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversationName,
  isOnline = false,
  conversationType,
  onSearchPress,
  onInfoPress,
  onCallPress,
  onVideoCallPress,
  participantId,
  participantUsername,
  participantAvatarUrl,
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
        {/* Boutons d'appel pour direct ET group */}
        {(conversationType === 'direct' || conversationType === 'group') && (
          <>
            {onVideoCallPress && (
              <TouchableOpacity
                onPress={() => {
                  console.log('[ChatHeader] Video call button pressed for:', conversationName, 'type:', conversationType);
                  onVideoCallPress();
                }}
                style={styles.actionButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="videocam"
                  size={18}
                  color={colors.text.light}
                />
              </TouchableOpacity>
            )}
            {onCallPress && (
              <TouchableOpacity
                onPress={() => {
                  console.log('[ChatHeader] Call button pressed for:', conversationName, 'type:', conversationType);
                  onCallPress();
                }}
                style={styles.actionButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="call"
                  size={18}
                  color={colors.text.light}
                />
              </TouchableOpacity>
            )}
          </>
        )}
        {onSearchPress && (
          <TouchableOpacity
            onPress={onSearchPress}
            style={styles.secondaryButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name="search"
              size={20}
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
          style={styles.secondaryButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
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
    gap: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.main,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  secondaryButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


