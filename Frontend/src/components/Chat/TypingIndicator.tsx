/**
 * TypingIndicator - Animated typing indicator with user name
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from './Avatar';

interface TypingIndicatorProps {
  userName?: string;
  userNames?: string[];
  avatarUrl?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ userName, userNames, avatarUrl }) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const dot1Y = useSharedValue(0);
  const dot2Y = useSharedValue(0);
  const dot3Y = useSharedValue(0);

  useEffect(() => {
    // Animate dots with 150ms stagger
    const animateDot = (dotY: Animated.SharedValue<number>, delay: number) => {
      setTimeout(() => {
        dotY.value = withRepeat(
          withSequence(
            withTiming(-8, { duration: 400 }),
            withTiming(0, { duration: 400 })
          ),
          -1,
          false
        );
      }, delay);
    };

    animateDot(dot1Y, 0);
    animateDot(dot2Y, 150);
    animateDot(dot3Y, 300);
  }, [dot1Y, dot2Y, dot3Y]);

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1Y.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2Y.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3Y.value }],
  }));

  // Determine display text
  const getDisplayText = () => {
    if (userNames && userNames.length > 0) {
      if (userNames.length === 1) {
        return `${userNames[0]} est en train d'écrire`;
      } else if (userNames.length === 2) {
        return `${userNames[0]} et ${userNames[1]} sont en train d'écrire`;
      } else {
        return `${userNames.length} personnes sont en train d'écrire`;
      }
    }
    if (userName) {
      return `${userName} est en train d'écrire`;
    }
    return "Quelqu'un est en train d'écrire";
  };

  const displayName = userName || (userNames && userNames.length > 0 ? userNames[0] : undefined);

  return (
    <View style={styles.container}>
      <Avatar
        size={32}
        uri={avatarUrl}
        name={displayName || 'User'}
        showOnlineBadge={false}
        isOnline={false}
      />
      <View style={[styles.bubble, { backgroundColor: 'rgba(26, 31, 58, 0.6)' }]}>
        <Text style={[styles.text, { color: themeColors.text.secondary }]}>
          {getDisplayText()}
        </Text>
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, dot1Style, { backgroundColor: themeColors.text.tertiary }]} />
          <Animated.View style={[styles.dot, dot2Style, { backgroundColor: themeColors.text.tertiary }]} />
          <Animated.View style={[styles.dot, dot3Style, { backgroundColor: themeColors.text.tertiary }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    marginHorizontal: 16,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    marginLeft: 8,
  },
  text: {
    fontSize: 13,
    marginRight: 6,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
});





