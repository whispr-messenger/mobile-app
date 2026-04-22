import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { GroupDetailsScreen } from './src/screens/Groups/GroupDetailsScreen';
import { groupsAPI } from './src/services/groups/api';

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: { groupId: 'g1', conversationId: 'conv1' } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));
// Inline mock for react-native-reanimated to avoid ESM parse error
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const AnimatedView = (props: any) => React.createElement(View, props);
  const animEntry = {
    duration: jest.fn().mockReturnThis(),
    delay: jest.fn().mockReturnThis(),
    springify: jest.fn().mockReturnThis(),
  };
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (c: any) => c,
      View: AnimatedView,
    },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => jest.fn(),
    useAnimatedRef: () => ({ current: null }),
    useScrollViewOffset: () => ({ value: 0 }),
    withSpring: (v: any) => v,
    withTiming: (v: any) => v,
    withSequence: (...args: any[]) => args[args.length - 1],
    interpolate: (v: any) => v,
    Extrapolate: { CLAMP: 'clamp' },
    FadeIn: animEntry,
    FadeInDown: animEntry,
    SlideInRight: animEntry,
    SlideOutRight: animEntry,
    createAnimatedComponent: (c: any) => c,
  };
});
jest.mock('./src/context/ThemeContext', () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { gradient: ['#000', '#111'], primary: '#000', secondary: '#111' },
      text: { primary: '#fff', secondary: '#aaa', tertiary: '#555' },
      primary: '#6200ee',
    }),
    getFontSize: () => 16,
    getLocalizedText: (key: string) => key,
  }),
}));
jest.mock('./src/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    userId: 'user1',
    deviceId: 'dev1',
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));
jest.mock('./src/components/Chat/Avatar', () => ({ Avatar: () => null }));
jest.mock('./src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('./src/services/groups/api', () => ({
  groupsAPI: {
    getGroupDetails: jest.fn(),
    getGroupMembers: jest.fn(),
    getGroupStats: jest.fn(),
    getGroupLogs: jest.fn(),
    getGroupSettings: jest.fn(),
  },
}));
jest.mock('./src/theme/colors', () => ({
  colors: {
    background: { gradient: { app: ['#000', '#111'] }, dark: '#000' },
    text: { light: '#fff' },
    primary: { main: '#6200ee' },
    secondary: { main: '#03dac6' },
    ui: { divider: '#333', error: '#f00' },
  },
  withOpacity: (c: string) => c,
}));
jest.mock('./src/theme/typography', () => ({
  typography: {
    fontSize: { base: 14, sm: 12, lg: 18, xl: 22, xs: 10, xxxl: 32 },
    fontWeight: { bold: '700', medium: '500', semiBold: '600', normal: '400' },
  },
}));

const mockedGroupsAPI = groupsAPI as jest.Mocked<typeof groupsAPI>;

describe('GroupDetailsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGroupsAPI.getGroupDetails.mockResolvedValue({
      id: 'g1',
      name: 'Test Group',
      description: 'A test group',
      avatar_url: null,
      created_at: '2024-01-01T00:00:00Z',
      member_count: 3,
    });
    mockedGroupsAPI.getGroupMembers.mockResolvedValue({ members: [] } as any);
    mockedGroupsAPI.getGroupStats.mockResolvedValue({ message_count: 0, member_count: 3 } as any);
    mockedGroupsAPI.getGroupLogs.mockResolvedValue({ logs: [] } as any);
    mockedGroupsAPI.getGroupSettings.mockResolvedValue({} as any);
  });

  it('renders without crashing', async () => {
    const { toJSON } = render(<GroupDetailsScreen />);
    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('loads group details on mount', async () => {
    render(<GroupDetailsScreen />);
    await waitFor(() => {
      expect(mockedGroupsAPI.getGroupDetails).toHaveBeenCalledWith('g1', 'conv1');
    });
  });

  it('shows group name after loading', async () => {
    const { getAllByText } = render(<GroupDetailsScreen />);
    await waitFor(() => {
      expect(getAllByText('Test Group').length).toBeGreaterThan(0);
    });
  });
});
