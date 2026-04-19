import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileSetupScreen } from './src/screens/Auth/ProfileSetupScreen';

const mockReset = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), reset: mockReset }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
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
jest.mock('./src/components', () => ({
  Button: ({ title, onPress, disabled }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return <TouchableOpacity onPress={onPress} disabled={disabled}><Text>{title}</Text></TouchableOpacity>;
  },
  Input: ({ placeholder, value, onChangeText }: any) => {
    const { TextInput } = require('react-native');
    return <TextInput placeholder={placeholder} value={value} onChangeText={onChangeText} />;
  },
}));
jest.mock('./src/services/TokenService', () => ({
  TokenService: { getAccessToken: jest.fn().mockResolvedValue('tok') },
}));
jest.mock('./src/services/MediaService', () => ({
  MediaService: { uploadMedia: jest.fn().mockResolvedValue({ url: 'https://cdn.test/img.jpg' }) },
}));
jest.mock('./src/services/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.test.com',
}));
jest.mock('./src/theme', () => ({
  colors: { text: { light: '#fff' }, primary: { main: '#6200ee' } },
  spacing: { xl: 24, xs: 4, md: 16, lg: 20, sm: 8, xxxl: 40 },
  typography: { fontSize: { xxl: 28, base: 14, sm: 12 } },
}));

global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as any;

describe('ProfileSetupScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders form fields', () => {
    const { getByPlaceholderText } = render(<ProfileSetupScreen />);
    expect(getByPlaceholderText('auth.firstName')).toBeTruthy();
    expect(getByPlaceholderText('auth.lastName')).toBeTruthy();
    expect(getByPlaceholderText('@username')).toBeTruthy();
  });

  it('renders save button', () => {
    const { getByText } = render(<ProfileSetupScreen />);
    expect(getByText('common.save')).toBeTruthy();
  });

  it('renders skip button', () => {
    const { getByText } = render(<ProfileSetupScreen />);
    expect(getByText(/auth.cancel/)).toBeTruthy();
  });

  it('navigates to ConversationsList on skip', () => {
    const { getByText } = render(<ProfileSetupScreen />);
    fireEvent.press(getByText(/auth.cancel/));
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'ConversationsList' }] });
  });

  it('navigates to ConversationsList on successful save', async () => {
    const { getByPlaceholderText, getByText } = render(<ProfileSetupScreen />);
    fireEvent.changeText(getByPlaceholderText('auth.firstName'), 'John');
    fireEvent.changeText(getByPlaceholderText('auth.lastName'), 'Doe');
    fireEvent.changeText(getByPlaceholderText('@username'), 'johndoe');
    fireEvent.press(getByText('common.save'));
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'ConversationsList' }] });
    });
  });
});
