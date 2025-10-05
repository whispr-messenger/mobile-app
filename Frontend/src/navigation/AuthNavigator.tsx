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

export type AuthStackParamList = {
  Login: undefined;
  Registration: undefined;
  Verification: { phoneNumber: string; isLogin?: boolean };
  ProfileSetup: { userId: string; token: string };
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
    </Stack.Navigator>
  );
};

export default AuthNavigator;



