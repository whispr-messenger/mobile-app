/* eslint-disable @typescript-eslint/no-require-imports */
// Global Jest setup: shared mocks for native/expo modules.

// react-native-safe-area-context — provide full API surface
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(insets),
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    SafeAreaInsetsContext: {
      Consumer: ({ children }) => children(insets),
      Provider: ({ children }) => children,
    },
    initialWindowMetrics: { insets, frame },
  };
});

// expo-linear-gradient — default pass-through
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }) => children,
}));

// @expo/vector-icons — render nothing
jest.mock('@expo/vector-icons', () => {
  const Noop = () => null;
  return new Proxy(
    { __esModule: true, default: Noop },
    { get: () => Noop }
  );
});
