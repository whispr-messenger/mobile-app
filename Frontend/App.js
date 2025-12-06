import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthNavigator } from './src/navigation/AuthNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <AuthNavigator />
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
