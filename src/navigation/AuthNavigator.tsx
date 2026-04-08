import React from "react";
import { ActivityIndicator, View } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import { WelcomeScreen } from "../screens/Auth/WelcomeScreen";
import { PhoneInputScreen } from "../screens/Auth/PhoneInputScreen";
import { OtpScreen } from "../screens/Auth/OtpScreen";
import { ProfileSetupScreen } from "../screens/Auth/ProfileSetupScreen";
import { ProfileScreen } from "../screens/Profile/ProfileScreen";
import { SettingsScreen } from "../screens/Settings/SettingsScreen";
import { SecurityKeysScreen } from "../screens/Security/SecurityKeysScreen";
import { TwoFactorAuthScreen } from "../screens/Security/TwoFactorAuthScreen";
import { TwoFactorSetupScreen } from "../screens/Security/TwoFactorSetupScreen";
import { TwoFactorVerifyScreen } from "../screens/Security/TwoFactorVerifyScreen";
import { TwoFactorBackupCodesScreen } from "../screens/Security/TwoFactorBackupCodesScreen";
import { ConversationsListScreen } from "../screens/Chat/ConversationsListScreen";
import { ChatScreen } from "../screens/Chat/ChatScreen";
import { ContactsScreen } from "../screens/Contacts/ContactsScreen";
import { BlockedUsersScreen } from "../screens/Contacts/BlockedUsersScreen";
import { GroupDetailsScreen } from "../screens/Groups/GroupDetailsScreen";
import { GroupManagementScreen } from "../screens/Groups/GroupManagementScreen";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import type { AuthPurpose } from "../types/auth";

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneInput: { mode: AuthPurpose };
  Otp: {
    phoneNumber: string;
    verificationId: string;
    purpose: AuthPurpose;
    demoCode?: string;
  };
  ProfileSetup: undefined;
  Profile: {
    userId?: string;
    token?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    profilePicture?: string;
    username?: string;
    biography?: string;
  };
  Settings: undefined;
  SecurityKeys: undefined;
  TwoFactorAuth: undefined;
  TwoFactorSetup: undefined;
  TwoFactorVerify: { secret: string };
  TwoFactorBackupCodes: { codes: string[] };
  ConversationsList: undefined;
  Chat: { conversationId: string };
  Contacts: undefined;
  BlockedUsers: undefined;
  GroupDetails: { groupId: string; conversationId: string };
  GroupManagement: { groupId: string; conversationId: string };
};

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background.dark,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={isAuthenticated ? "ConversationsList" : "Welcome"}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: "horizontal",
        cardStyleInterpolator: ({ current, layouts }) => ({
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
        }),
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SecurityKeys" component={SecurityKeysScreen} />
      <Stack.Screen name="TwoFactorAuth" component={TwoFactorAuthScreen} />
      <Stack.Screen
        name="TwoFactorSetup"
        component={TwoFactorSetupScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="TwoFactorVerify"
        component={TwoFactorVerifyScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="TwoFactorBackupCodes"
        component={TwoFactorBackupCodesScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="ConversationsList"
        component={ConversationsListScreen}
      />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Contacts" component={ContactsScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
      <Stack.Screen name="GroupManagement" component={GroupManagementScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
