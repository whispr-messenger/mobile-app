/**
 * SkeletonLoader - Loading skeleton for conversation items
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

export const ConversationSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <SkeletonLoader width={48} height={48} borderRadius={24} />
      <View style={styles.content}>
        <SkeletonLoader width="60%" height={16} style={styles.nameSkeleton} />
        <SkeletonLoader width="80%" height={14} />
      </View>
      <View style={styles.meta}>
        <SkeletonLoader width={40} height={12} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  nameSkeleton: {
    marginBottom: 8,
  },
  meta: {
    alignItems: 'flex-end',
  },
});

