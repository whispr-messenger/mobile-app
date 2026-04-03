import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';

export default function App() {
  // Fix: Expo sets body { overflow: hidden } which breaks scroll on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      document.body.style.overflow = 'auto';
    }
  }, []);
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer>
          <AuthNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}
