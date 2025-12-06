/**
 * Whispr Design System - Theme
 * Central export for all design tokens
 */

export { colors, withOpacity } from './colors';
export { typography, textStyles } from './typography';
export { spacing, borderRadius, shadows } from './spacing';

// Export complete theme object
export const theme = {
  colors: require('./colors').colors,
  typography: require('./typography').typography,
  textStyles: require('./typography').textStyles,
  spacing: require('./spacing').spacing,
  borderRadius: require('./spacing').borderRadius,
  shadows: require('./spacing').shadows,
} as const;

export type Theme = typeof theme;

