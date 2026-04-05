import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { TwoFactorAuthScreen } from './src/screens/Security/TwoFactorAuthScreen';
import { TwoFactorService } from './src/services/TwoFactorService';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('./src/services/TwoFactorService');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}));
jest.mock('./src/context/ThemeContext', () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { gradient: ['#000', '#111'], primary: '#000', secondary: '#111' },
      text: { primary: '#fff', secondary: '#aaa', tertiary: '#555' },
      primary: '#9692AC',
    }),
    getFontSize: () => 14,
    getLocalizedText: (key: string) => key,
  }),
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));
jest.mock('react-native-qrcode-styled', () => () => null);
jest.mock('react-native-svg', () => ({
  Circle: () => null,
  Path: () => null,
}));
jest.mock('./src/components/Toast/Toast', () => () => null);

const mockedTwoFactorService = TwoFactorService as jest.Mocked<typeof TwoFactorService>;

describe('TwoFactorAuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and displays disabled 2FA status from backend', async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: false });

    const { queryByText } = render(<TwoFactorAuthScreen />);

    await waitFor(() => {
      expect(mockedTwoFactorService.getStatus).toHaveBeenCalledTimes(1);
    });

    expect(queryByText('twoFactor.qrCode')).toBeNull();
  });

  it('loads and displays enabled 2FA status from backend', async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: true });

    const { findByText } = render(<TwoFactorAuthScreen />);

    await findByText('twoFactor.qrCode');
    expect(mockedTwoFactorService.getStatus).toHaveBeenCalledTimes(1);
  });

  it('calls setup and shows QR section when toggling 2FA on', async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: false });
    mockedTwoFactorService.setup.mockResolvedValue({
      secret: 'TESTSECRET',
      qrCodeUri: 'otpauth://totp/WHISPR?secret=TESTSECRET&issuer=Whispr',
    });

    const { getByRole, queryByText } = render(<TwoFactorAuthScreen />);

    await waitFor(() => expect(mockedTwoFactorService.getStatus).toHaveBeenCalled());

    expect(queryByText('twoFactor.qrCode')).toBeNull();

    const toggle = getByRole('switch');
    await act(async () => { fireEvent(toggle, 'valueChange', true); });

    expect(mockedTwoFactorService.setup).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(queryByText('twoFactor.qrCode')).not.toBeNull());
  });

  it('calls enable and fetches backup codes on valid TOTP token', async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: false });
    mockedTwoFactorService.setup.mockResolvedValue({
      secret: 'TESTSECRET',
      qrCodeUri: 'otpauth://totp/WHISPR?secret=TESTSECRET',
    });
    mockedTwoFactorService.enable.mockResolvedValue(undefined);
    mockedTwoFactorService.getBackupCodes.mockResolvedValue({
      codes: ['1111-2222', '3333-4444'],
    });

    const { getByRole, getByPlaceholderText, getByText } = render(<TwoFactorAuthScreen />);

    await waitFor(() => expect(mockedTwoFactorService.getStatus).toHaveBeenCalled());

    const toggle = getByRole('switch');
    await act(async () => { fireEvent(toggle, 'valueChange', true); });

    await waitFor(() => expect(mockedTwoFactorService.setup).toHaveBeenCalled());

    const input = getByPlaceholderText('twoFactor.enterCode');
    fireEvent.changeText(input, '123456');

    const verifyButton = getByText('twoFactor.verify');
    await act(async () => { fireEvent.press(verifyButton); });

    expect(mockedTwoFactorService.enable).toHaveBeenCalledWith('123456');
    expect(mockedTwoFactorService.getBackupCodes).toHaveBeenCalledTimes(1);
  });

  it('shows disable prompt and calls disable with TOTP token', async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: true });
    mockedTwoFactorService.disable.mockResolvedValue(undefined);

    const { getByRole, getByPlaceholderText, getAllByText } = render(<TwoFactorAuthScreen />);

    await waitFor(() => expect(mockedTwoFactorService.getStatus).toHaveBeenCalled());

    const toggle = getByRole('switch');
    await act(async () => { fireEvent(toggle, 'valueChange', false); });

    const input = getByPlaceholderText('twoFactor.enterCode');
    fireEvent.changeText(input, '654321');

    const disableButtons = getAllByText('twoFactor.disable');
    const confirmButton = disableButtons[disableButtons.length - 1];
    await act(async () => { fireEvent.press(confirmButton); });

    expect(mockedTwoFactorService.disable).toHaveBeenCalledWith('654321');
  });

  it('calls getBackupCodes when regenerate button is pressed', async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: true });
    mockedTwoFactorService.getBackupCodes.mockResolvedValue({
      codes: ['aaaa-bbbb', 'cccc-dddd'],
    });

    const { getByText } = render(<TwoFactorAuthScreen />);

    await waitFor(() => expect(mockedTwoFactorService.getStatus).toHaveBeenCalled());

    // expand recovery codes section
    const viewCodesButton = getByText('twoFactor.viewRecoveryCodes');
    await act(async () => { fireEvent.press(viewCodesButton); });

    const regenerateButton = getByText('twoFactor.regenerateCodes');
    await act(async () => { fireEvent.press(regenerateButton); });

    expect(mockedTwoFactorService.getBackupCodes).toHaveBeenCalledTimes(1);
  });
});
