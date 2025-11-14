import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, Button, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import UsersScreen from './src/screens/UsersScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import AuthScreen from './src/screens/AuthScreen';
import MainScreen from './src/screens/MainScreen';
import UserGestScreen from './src/screens/UserGestScreen';
import { SettingsProvider } from './src/context/SettingsContext';

export default function App() {
  // Dev: pointer direct vers user-service (préfixé) pour préférences
  const [baseUrl, setBaseUrl] = useState('http://localhost:19007/api/v1');
  const [tokens, setTokens] = useState(null); // { accessToken, refreshToken }
  // Déclarer tous les hooks de manière inconditionnelle pour respecter l’ordre
  const [route, setRoute] = useState('main');

  if (!tokens) {
    return (
      <SettingsProvider>
        <View style={{ flex: 1 }}>
          {[
            <AuthScreen key="auth" baseUrl={baseUrl} onAuthenticated={(t) => setTokens(t)} />,
            <StatusBar key="status" style="light" />
          ]}
        </View>
      </SettingsProvider>
    );
  }

  // Navigation simple: main <-> usergest

  // DEV: userId provisoire pour tests tant que l'auth renvoie des tokens factices
  const devUserId = '00000000-0000-0000-0000-000000000001';

  return (
    <SettingsProvider baseUrl={baseUrl} tokens={tokens} userId={devUserId}>
      <View style={{ flex: 1 }}>
        {[
          route === 'main'
            ? <MainScreen key="main" onAvatarPress={() => setRoute('usergest')} />
            : <UserGestScreen key="usergest" onBack={() => setRoute('main')} />,
          <StatusBar key="status" style="light" />
        ]}
      </View>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  label: {
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
  },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
  tabItem: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  tabItemActive: { backgroundColor: '#f0f0f0' },
  tabText: { fontWeight: '600' },
  screenContainer: { paddingBottom: 24 },
});
