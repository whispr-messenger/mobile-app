import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PhoneInputScreen } from '../src/screens/Auth/PhoneInputScreen';
import { AuthService } from '../src/services/AuthService';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, replace: jest.fn() }),
  useRoute: () => ({ params: { mode: 'login' } }),
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { gradient: ['#000', '#111'], primary: '#000', secondary: '#111' },
      text: { primary: '#fff', secondary: '#aaa', tertiary: '#555' },
      primary: '#6200ee',
    }),
    getFontSize: () => 16,
    getLocalizedText: (key: string) => key,
    settings: { language: 'fr', theme: 'dark', fontSize: 'medium' },
    updateSettings: jest.fn(),
  }),
}));
jest.mock('../src/components', () => ({
  Button: ({ title, onPress, disabled }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={disabled ? undefined : onPress} disabled={!!disabled}>
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  },
}));
jest.mock('../src/services/AuthService', () => ({
  AuthService: { requestVerification: jest.fn() },
}));
jest.mock('../src/theme', () => ({
  colors: { text: { light: '#fff', placeholder: '#888' }, primary: { main: '#6200ee' }, background: { darkCard: '#222' }, ui: { error: '#f00' } },
  spacing: { xl: 24, xs: 4, md: 16, lg: 20, sm: 8, base: 12, xxxl: 40 },
  typography: { fontSize: { xxxl: 32, md: 16, base: 14, sm: 12, lg: 18 } },
}));
jest.mock('../src/utils/phoneUtils', () => ({
  normalizePhoneToE164: (digits: string, code: string) => `${code}${digits}`,
}));
jest.mock('../assets/images/logo-icon.png', () => 1, { virtual: true });
jest.mock('./assets/images/logo-icon.png', () => 1, { virtual: true });

const mockedAuthService = AuthService as jest.Mocked<typeof AuthService>;

describe('PhoneInputScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders phone input field', () => {
    const { getByPlaceholderText } = render(<PhoneInputScreen />);
    expect(getByPlaceholderText('07 12 34 56 78')).toBeTruthy();
  });

  it('shows continue button', () => {
    const { getByText } = render(<PhoneInputScreen />);
    expect(getByText('auth.continue')).toBeTruthy();
  });

  it('navigates to Otp on successful verification request', async () => {
    mockedAuthService.requestVerification.mockResolvedValue({
      verificationId: 'vid123',
      code: '123456',
    });
    const { getByPlaceholderText, getByText } = render(<PhoneInputScreen />);
    fireEvent.changeText(getByPlaceholderText('07 12 34 56 78'), '0612345678');
    fireEvent.press(getByText('auth.continue'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Otp', expect.objectContaining({
        verificationId: 'vid123',
        purpose: 'login',
      }));
    });
  });

  it('does not call requestVerification when phone is empty', () => {
    const { getByText } = render(<PhoneInputScreen />);
    fireEvent.press(getByText('auth.continue'));
    expect(mockedAuthService.requestVerification).not.toHaveBeenCalled();
  });
});
