/**
 * Avatar - User avatar component with fallback
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: number;
  showOnlineBadge?: boolean;
  isOnline?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 48,
  showOnlineBadge = false,
  isOnline = false,
}) => {
  const initials = name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {uri ? (
        <Image 
          source={{ uri }} 
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} 
          resizeMode="cover"
          onError={() => {
            // Fallback to initials if image fails to load
            // Image will fallback to initials automatically
          }}
        />
      ) : (
        <LinearGradient
          colors={[colors.primary.main, colors.primary.light]}
          style={[styles.gradient, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
        </LinearGradient>
      )}
      {showOnlineBadge && (
        <View
          style={[
            styles.onlineBadge,
            {
              width: size * 0.25,
              height: size * 0.25,
              borderRadius: size * 0.125,
              backgroundColor: isOnline ? colors.status.online : colors.status.offline,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  gradient: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: colors.text.light,
    fontWeight: '600',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
});


