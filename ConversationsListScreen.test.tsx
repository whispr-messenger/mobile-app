import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ConversationsListScreen } from './src/screens/Chat/ConversationsListScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));
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
jest.mock('./src/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    joinConversationChannel: jest.fn().mockReturnValue({ channel: null, cleanup: jest.fn() }),
    sendMessage: jest.fn(),
    markAsRead: jest.fn(),
    sendTyping: jest.fn(),
  }),
}));
jest.mock('./src/services/TokenService', () => ({
  TokenService: { getAccessToken: jest.fn().mockResolvedValue('tok') },
}));
jest.mock('./src/services/messaging/api', () => ({
  messagingAPI: {
    searchMessagesGlobal: jest.fn().mockResolvedValue(null),
  },
}));
jest.mock('./src/store/conversationsStore', () => ({
  useConversationsStore: (selector: any) => selector({
    conversations: [],
    status: 'empty',
    fetchConversations: jest.fn().mockResolvedValue(undefined),
    refreshConversations: jest.fn().mockResolvedValue(undefined),
    applyConversationUpdate: jest.fn(),
    applyNewMessage: jest.fn(),
    deleteConversation: jest.fn().mockResolvedValue(undefined),
    archiveConversation: jest.fn(),
    muteConversation: jest.fn().mockResolvedValue(undefined),
    pinConversation: jest.fn(),
    markAsUnread: jest.fn(),
    clearManualUnread: jest.fn(),
    loadManuallyUnreadIds: jest.fn(),
  }),
}));
jest.mock('./src/components/Chat/SwipeableConversationItem', () => ({
  SwipeableConversationItem: ({ conversation, onPress }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={() => onPress(conversation.id)}>
        <Text>{conversation.display_name || 'Conversation'}</Text>
      </TouchableOpacity>
    );
  },
}));
jest.mock('./src/components/Chat/EmptyState', () => ({
  EmptyState: ({ onNewConversation }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={onNewConversation}>
        <Text>Nouvelle conversation</Text>
      </TouchableOpacity>
    );
  },
}));
jest.mock('./src/components/Chat/SkeletonLoader', () => ({
  ConversationSkeleton: () => null,
}));
jest.mock('./src/components/Navigation/BottomTabBar', () => ({
  BottomTabBar: () => null,
}));
jest.mock('./src/components/Chat/NewConversationModal', () => ({
  NewConversationModal: () => null,
}));
jest.mock('./src/components/Toast/Toast', () => () => null);
jest.mock('./src/theme/colors', () => ({
  colors: {
    background: { gradient: { app: ['#000', '#111'] } },
    primary: { main: '#6200ee' },
    text: { light: '#fff' },
    ui: { error: '#f00' },
    secondary: { main: '#03dac6' },
  },
}));

describe('ConversationsListScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    const { toJSON } = render(<ConversationsListScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders search bar', () => {
    const { getByPlaceholderText } = render(<ConversationsListScreen />);
    expect(getByPlaceholderText('Search for messages or users')).toBeTruthy();
  });

  it('renders empty state when no conversations', () => {
    const { getByText } = render(<ConversationsListScreen />);
    expect(getByText('Nouvelle conversation')).toBeTruthy();
  });

  it('renders Edit button', () => {
    const { getByText } = render(<ConversationsListScreen />);
    expect(getByText('Edit')).toBeTruthy();
  });

  it('toggles edit mode on Edit press', () => {
    const { getByText } = render(<ConversationsListScreen />);
    fireEvent.press(getByText('Edit'));
    expect(getByText('Cancel')).toBeTruthy();
  });
});
