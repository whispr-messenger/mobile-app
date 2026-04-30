import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { TwoFactorSetupScreen } from '../src/screens/Security/TwoFactorSetupScreen';

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
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
  }),
}));
jest.mock('../src/components/Toast/Toast', () => () => null);
jest.mock('../src/services/TwoFactorService', () => ({
  TwoFactorService: {
    setup: jest.fn().mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      qrCodeUrl: 'otpauth://totp/test',
      backupCodes: ['code1', 'code2'],
    }),
    verify: jest.fn().mockResolvedValue({ verified: true }),
  },
}));
jest.mock('react-native-qrcode-styled', () => () => null);
jest.mock('react-native-svg', () => ({
  Circle: () => null,
  Path: () => null,
  Svg: () => null,
}));
jest.mock('../src/utils/clipboard', () => ({
  copyToClipboard: jest.fn(),
}));

describe('TwoFactorSetupScreen', () => {
  it('renders without crashing', async () => {
    const { toJSON } = render(<TwoFactorSetupScreen />);
    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it('calls TwoFactorService.setup on mount', async () => {
    const { TwoFactorService } = require('../src/services/TwoFactorService');
    render(<TwoFactorSetupScreen />);
    await waitFor(() => {
      expect(TwoFactorService.setup).toHaveBeenCalled();
    });
  });
});
