/**
 * Auth Navigation Stack
 * Handles authentication flow screens
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { RegistrationScreen } from '../screens/Auth/RegistrationScreen';
import { VerificationScreen } from '../screens/Auth/VerificationScreen';
import { ProfileSetupScreen } from '../screens/Auth/ProfileSetupScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { SecurityKeysScreen } from '../screens/Security/SecurityKeysScreen';
import { TwoFactorAuthScreen } from '../screens/Security/TwoFactorAuthScreen';
import { ConversationsListScreen } from '../screens/Chat/ConversationsListScreen';
import { ChatScreen } from '../screens/Chat/ChatScreen';

export type AuthStackParamList = {
  Login: undefined;
  Registration: undefined;
  Verification: { phoneNumber: string; isLogin?: boolean };
  ProfileSetup: { userId: string; token: string };
  Profile: { userId?: string; token?: string; firstName?: string; lastName?: string; phoneNumber?: string; profilePicture?: string; username?: string; biography?: string };
  Settings: undefined;
  SecurityKeys: undefined;
  TwoFactorAuth: undefined;
  ConversationsList: undefined;
  Chat: { conversationId: string };
};

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Registration" component={RegistrationScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SecurityKeys" component={SecurityKeysScreen} />
      <Stack.Screen name="TwoFactorAuth" component={TwoFactorAuthScreen} />
      <Stack.Screen name="ConversationsList" component={ConversationsListScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;



