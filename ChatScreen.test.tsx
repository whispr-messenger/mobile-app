import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { ChatScreen } from './src/screens/Chat/ChatScreen';
import { messagingAPI } from './src/services/messaging/api';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { conversationId: 'conv1' } }),
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
    joinConversationChannel: jest.fn().mockReturnValue({ channel: { leave: jest.fn() }, cleanup: jest.fn() }),
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
    getConversation: jest.fn(),
    getMessages: jest.fn(),
    getPinnedMessages: jest.fn(),
    getConversationMembers: jest.fn(),
    getUserInfo: jest.fn(),
    sendMessage: jest.fn(),
    editMessage: jest.fn(),
    deleteMessage: jest.fn(),
    addReaction: jest.fn(),
    getMessageReactions: jest.fn(),
    getAttachments: jest.fn(),
    searchMessages: jest.fn(),
    searchMessagesGlobal: jest.fn(),
    pinMessage: jest.fn(),
    unpinMessage: jest.fn(),
    addAttachment: jest.fn(),
  },
}));
jest.mock('./src/services/MediaService', () => ({
  MediaService: { uploadMedia: jest.fn() },
}));
jest.mock('./src/services/SchedulingService', () => ({
  SchedulingService: { createScheduledMessage: jest.fn() },
}));
jest.mock('./src/store/conversationsStore', () => ({
  useConversationsStore: (selector: any) => selector({ conversations: [] }),
}));
jest.mock('./src/store/presenceStore', () => ({
  usePresenceStore: (selector: any) => selector({ onlineUserIds: new Set(), lastSeenAt: {} }),
}));
jest.mock('./src/components/Chat/MessageBubble', () => ({ MessageBubble: () => null }));
jest.mock('./src/components/Chat/MessageInput', () => ({ MessageInput: () => null }));
jest.mock('./src/components/Chat/TypingIndicator', () => ({ TypingIndicator: () => null }));
jest.mock('./src/components/Chat/Avatar', () => ({ Avatar: () => null }));
jest.mock('./src/components/Chat/MessageActionsMenu', () => ({ MessageActionsMenu: () => null }));
jest.mock('./src/components/Chat/ForwardMessageModal', () => ({ ForwardMessageModal: () => null }));
jest.mock('./src/components/Chat/ReportMessageSheet', () => ({ ReportMessageSheet: () => null }));
jest.mock('./src/services/moderation', () => ({
  gateChatImageBeforeSend: jest.fn().mockResolvedValue({ allowed: true }),
}));
jest.mock('./src/components/Chat/ReactionReactorsModal', () => ({ ReactionReactorsModal: () => null }));
jest.mock('./src/components/Chat/ReactionPicker', () => ({ ReactionPicker: () => null }));
jest.mock('./src/components/Chat/DateSeparator', () => ({ DateSeparator: () => null }));
jest.mock('./src/components/Chat/SystemMessage', () => ({ SystemMessage: () => null }));
jest.mock('./src/components/Chat/MessageSearch', () => ({ MessageSearch: () => null }));
jest.mock('./src/components/Chat/PinnedMessagesBar', () => ({ PinnedMessagesBar: () => null }));
jest.mock('./src/components/Chat/EmptyChatState', () => ({ EmptyChatState: () => null }));
jest.mock('./src/components/Chat/ScheduleDateTimePicker', () => ({ ScheduleDateTimePicker: () => null }));
jest.mock('./src/screens/Chat/ChatHeader', () => ({ ChatHeader: () => null }));
jest.mock('./src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('./src/theme/colors', () => ({
  colors: {
    background: { gradient: { app: ['#000', '#111'] }, dark: '#000' },
    primary: { main: '#6200ee' },
    text: { light: '#fff' },
    ui: { divider: '#333' },
  },
  withOpacity: (c: string) => c,
}));

const mockedMessagingAPI = messagingAPI as jest.Mocked<typeof messagingAPI>;

describe('ChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedMessagingAPI.getConversation.mockResolvedValue({
      id: 'conv1',
      type: 'direct',
      display_name: 'Alice',
      member_user_ids: ['user1', 'user2'],
    });
    mockedMessagingAPI.getMessages.mockResolvedValue([]);
    mockedMessagingAPI.getPinnedMessages.mockResolvedValue([]);
    mockedMessagingAPI.getConversationMembers.mockResolvedValue([]);
  });

  it('renders without crashing', async () => {
    const { toJSON } = render(<ChatScreen />);
    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('loads conversation on mount', async () => {
    render(<ChatScreen />);
    await waitFor(() => {
      expect(mockedMessagingAPI.getConversation).toHaveBeenCalledWith('conv1');
    });
  });

  it('loads messages on mount', async () => {
    render(<ChatScreen />);
    await waitFor(() => {
      expect(mockedMessagingAPI.getMessages).toHaveBeenCalledWith('conv1', expect.any(Object));
    });
  });
});
