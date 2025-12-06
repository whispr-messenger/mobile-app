/**
 * Whispr Logo Component
 * Displays the Whispr brand logo with different variants
 */

import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  style?: ViewStyle;
}

const SIZES = {
  small: 32,
  medium: 64,
  large: 120,
  xlarge: 200,
};

export const Logo: React.FC<LogoProps> = ({
  variant = 'icon',
  size = 'medium',
  style,
}) => {
  const logoSource = variant === 'full'
    ? require('../../../assets/images/logo-full.png')
    : require('../../../assets/images/logo-icon.png');

  const logoSize = SIZES[size];

  return (
    <View style={[styles.container, style]}>
      <Image
        source={logoSource}
        style={{
          width: logoSize,
          height: logoSize,
        }}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Logo;

