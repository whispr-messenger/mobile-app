/**
 * WhisprIcon - Custom Whispr logo icon component
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

interface WhisprIconProps {
  size?: number;
  variant?: 'single' | 'double';
}

export const WhisprIcon: React.FC<WhisprIconProps> = ({ 
  size = 24, 
  variant = 'single' 
}) => {
  const iconSize = size;
  const innerSize = iconSize * 0.7;

  if (variant === 'double') {
    // Double globe icon for Chats
    return (
      <View style={[styles.container, { width: iconSize, height: iconSize }]}>
        {/* Back globe */}
        <View style={[styles.backGlobe, { width: innerSize, height: innerSize }]}>
          <LinearGradient
            colors={[colors.primary.main, colors.primary.light]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradient, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}
          />
        </View>
        {/* Front globe */}
        <View style={[styles.frontGlobe, { width: innerSize, height: innerSize }]}>
          <LinearGradient
            colors={[colors.secondary.main, colors.secondary.light]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradient, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}
          />
        </View>
      </View>
    );
  }

  // Single globe icon for Settings
  return (
    <View style={[styles.container, { width: iconSize, height: iconSize }]}>
      <LinearGradient
        colors={[colors.secondary.main, colors.primary.main]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backGlobe: {
    position: 'absolute',
    top: 2,
    left: 0,
    opacity: 0.8,
  },
  frontGlobe: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  gradient: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

