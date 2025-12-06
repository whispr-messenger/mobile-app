/**
 * Whispr Button Component
 * Primary, Secondary, and Ghost button variants based on Figma design
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const SIZES = {
  small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    fontSize: 14,
    height: 36,
  },
  medium: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    height: 48,
  },
  large: {
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    fontSize: 18,
    height: 56,
  },
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
}) => {
  const sizeStyles = SIZES[size];

  const getButtonStyles = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      paddingVertical: sizeStyles.paddingVertical,
      paddingHorizontal: sizeStyles.paddingHorizontal,
      height: sizeStyles.height,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    };

    if (fullWidth) {
      baseStyle.width = '100%';
    }

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? colors.ui.border : colors.primary.main,
          ...shadows.sm,
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? colors.background.secondary : colors.secondary.main,
          ...shadows.sm,
        };
      case 'ghost':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: disabled ? colors.ui.border : colors.primary.main,
        };
      case 'danger':
        return {
          ...baseStyle,
          backgroundColor: disabled ? colors.ui.border : colors.ui.error,
          ...shadows.sm,
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyles = (): TextStyle => {
    const baseTextStyle: TextStyle = {
      fontSize: sizeStyles.fontSize,
      fontWeight: '600',
    };

    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'danger':
        return {
          ...baseTextStyle,
          color: colors.text.light,
        };
      case 'ghost':
        return {
          ...baseTextStyle,
          color: disabled ? colors.text.disabled : colors.primary.main,
        };
      default:
        return baseTextStyle;
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyles(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.primary.main : colors.text.light} />
      ) : (
        <Text style={[getTextStyles(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({});

export default Button;


