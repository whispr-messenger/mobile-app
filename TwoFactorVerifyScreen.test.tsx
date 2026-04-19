import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TwoFactorVerifyScreen } from './src/screens/Security/TwoFactorVerifyScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { secret: 'JBSWY3DPEHPK3PXP' } }),
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
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
jest.mock('./src/components/Toast/Toast', () => () => null);
jest.mock('./src/services/TwoFactorService', () => ({
  TwoFactorService: {
    enable: jest.fn().mockResolvedValue({ backupCodes: ['code1', 'code2'] }),
    verify: jest.fn().mockResolvedValue({ verified: true }),
  },
}));

describe('TwoFactorVerifyScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    const { toJSON } = render(<TwoFactorVerifyScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders code input with placeholder 000000', () => {
    const { getByPlaceholderText } = render(<TwoFactorVerifyScreen />);
    expect(getByPlaceholderText('000000')).toBeTruthy();
  });

  it('renders verify button', () => {
    const { getByText } = render(<TwoFactorVerifyScreen />);
    expect(getByText('twoFactor.verify')).toBeTruthy();
  });

  it('calls TwoFactorService.enable on valid code submit', async () => {
    const { TwoFactorService } = require('./src/services/TwoFactorService');
    const { getByPlaceholderText, getByText } = render(<TwoFactorVerifyScreen />);
    fireEvent.changeText(getByPlaceholderText('000000'), '123456');
    fireEvent.press(getByText('twoFactor.verify'));
    await waitFor(() => {
      expect(TwoFactorService.enable).toHaveBeenCalledWith('123456');
    });
  });
});
