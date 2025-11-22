/**
 * TypingIndicator - Animated typing indicator with 3 dots
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { colors } from '../../theme/colors';

interface TypingIndicatorProps {
  userName?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ userName }) => {
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

  return (
    <View style={styles.container}>
      {userName && <View style={styles.avatar} />}
      <View style={styles.bubble}>
        <Animated.View style={[styles.dot, dot1Style]} />
        <Animated.View style={[styles.dot, dot2Style]} />
        <Animated.View style={[styles.dot, dot3Style]} />
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
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary.light,
    marginRight: 8,
  },
  bubble: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.tertiary,
    marginHorizontal: 2,
  },
});

