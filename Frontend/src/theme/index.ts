/**
 * Whispr Design System - Theme
 * Central export for all design tokens
 */

import { colors, withOpacity } from './colors';
import { typography, textStyles } from './typography';
import { spacing, borderRadius, shadows } from './spacing';

// Re-export individual modules
export { colors, withOpacity };
export { typography, textStyles };
export { spacing, borderRadius, shadows };

// Export complete theme object
export const theme = {
  colors,
  typography,
  textStyles,
  spacing,
  borderRadius,
  shadows,
} as const;

export type Theme = typeof theme;
