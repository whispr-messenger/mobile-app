import React from 'react';
import { render } from '@testing-library/react-native';
import { CallsScreen } from '../src/screens/Calls/CallsScreen';

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/components/Navigation/BottomTabBar', () => ({
  BottomTabBar: () => null,
}));
jest.mock('../src/screens/Calls/CallHistoryScreen', () => ({
  CallHistoryScreen: () => null,
}));
jest.mock('../src/theme/colors', () => ({
  colors: {
    background: { gradient: { app: ['#000', '#111'] } },
    primary: { main: '#6200ee' },
    text: { light: '#fff' },
  },
}));

describe('CallsScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<CallsScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
