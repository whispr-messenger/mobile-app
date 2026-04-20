import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from './src/screens/Profile/ProfileScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, reset: jest.fn() }),
  useRoute: () => ({ params: { firstName: 'John', lastName: 'Doe', username: 'johndoe', phoneNumber: '+33612345678', biography: '' } }),
  useFocusEffect: (cb: () => void | (() => void)) => { const React = require('react'); React.useEffect(() => cb(), []); },
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('./src/components', () => ({
  Logo: () => null,
  Button: ({ title, onPress, disabled }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return <TouchableOpacity onPress={onPress} disabled={disabled}><Text>{title}</Text></TouchableOpacity>;
  },
}));
jest.mock('./src/services', () => ({
  UserService: {
    getInstance: () => ({
      getProfile: jest.fn().mockResolvedValue({ success: false }),
      updateProfile: jest.fn().mockResolvedValue({ success: true }),
    }),
  },
}));
jest.mock('./src/services/MediaService', () => ({
  MediaService: { uploadMedia: jest.fn().mockResolvedValue({ id: 'media-1', url: 'https://cdn.test/img.jpg' }) },
}));
jest.mock('./src/context/AuthContext', () => ({
  useAuth: () => ({ userId: 'user-123' }),
}));
// ProfileScreen uses colors.background.gradient.app from theme/colors (not theme)
jest.mock('./src/theme/colors', () => ({
  colors: {
    background: { gradient: { app: ['#000', '#111'] }, primary: '#000', secondary: '#111', dark: '#000' },
    text: { light: '#fff', secondary: '#aaa', placeholder: '#666', primary: '#000' },
    primary: { main: '#6200ee' },
    ui: { error: '#f00', border: '#333' },
    status: { online: '#0f0', offline: '#888' },
  },
  withOpacity: (c: string) => c,
}));
jest.mock('./src/theme', () => ({
  colors: {
    text: { light: '#fff', secondary: '#aaa', placeholder: '#666', primary: '#000' },
    primary: { main: '#6200ee' },
    background: { primary: '#000', secondary: '#111', gradient: { app: ['#000', '#111'] } },
    ui: { error: '#f00', border: '#333' },
    status: { online: '#0f0', offline: '#888' },
  },
  spacing: { xl: 24, xs: 4, md: 16, lg: 20, sm: 8, xxxl: 40 },
  typography: {
    fontSize: { xl: 24, base: 14, sm: 12, lg: 18, xxxl: 32, xs: 10 },
    fontWeight: { bold: '700', medium: '500', semiBold: '600' },
  },
  borderRadius: { lg: 12, xl: 20 },
  shadows: {},
}));

describe('ProfileScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders profile header', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Profil')).toBeTruthy();
  });

  it('renders user name from route params', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('John Doe')).toBeTruthy();
  });

  it('renders edit profile button', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Modifier le profil')).toBeTruthy();
  });

  it('enters edit mode on edit button press', () => {
    const { getByText } = render(<ProfileScreen />);
    fireEvent.press(getByText('Modifier le profil'));
    expect(getByText('Sauvegarder')).toBeTruthy();
  });

  it('navigates back on back press when not editing', () => {
    const { getByText } = render(<ProfileScreen />);
    fireEvent.press(getByText('← Retour'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('navigates to Settings on settings press', () => {
    const { getByText } = render(<ProfileScreen />);
    fireEvent.press(getByText('⚙️'));
    expect(mockNavigate).toHaveBeenCalledWith('Settings');
  });
});
