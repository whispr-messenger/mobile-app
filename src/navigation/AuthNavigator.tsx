import React, { useEffect, useState } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { WelcomeScreen } from "../screens/Auth/WelcomeScreen";
import { PhoneInputScreen } from "../screens/Auth/PhoneInputScreen";
import { OtpScreen } from "../screens/Auth/OtpScreen";
import { ProfileSetupScreen } from "../screens/Auth/ProfileSetupScreen";
import { ProfileScreen } from "../screens/Profile/ProfileScreen";
import { SettingsScreen } from "../screens/Settings/SettingsScreen";
import { AboutContentScreen } from "../screens/Settings/AboutContentScreen";
import { SecurityKeysScreen } from "../screens/Security/SecurityKeysScreen";
import { TwoFactorAuthScreen } from "../screens/Security/TwoFactorAuthScreen";
import { TwoFactorSetupScreen } from "../screens/Security/TwoFactorSetupScreen";
import { TwoFactorVerifyScreen } from "../screens/Security/TwoFactorVerifyScreen";
import { TwoFactorBackupCodesScreen } from "../screens/Security/TwoFactorBackupCodesScreen";
import { ConversationsListScreen } from "../screens/Chat/ConversationsListScreen";
import { ChatScreen } from "../screens/Chat/ChatScreen";
import { ContactsScreen } from "../screens/Contacts/ContactsScreen";
import { BlockedUsersScreen } from "../screens/Contacts/BlockedUsersScreen";
import { MyQRCodeScreen } from "../screens/Contacts/MyQRCodeScreen";
import { GroupDetailsScreen } from "../screens/Groups/GroupDetailsScreen";
import { GroupManagementScreen } from "../screens/Groups/GroupManagementScreen";
import { ScheduledMessagesScreen } from "../screens/Chat/ScheduledMessagesScreen";
import { CallsScreen } from "../screens/Calls/CallsScreen";
import { ModerationTestScreen } from "../screens/Debug/ModerationTestScreen";
import { ModerationDecisionScreen } from "../screens/Moderation/ModerationDecisionScreen";
import { ModerationAppealFormScreen } from "../screens/Moderation/ModerationAppealFormScreen";
import { ModerationAppealSubmittedScreen } from "../screens/Moderation/ModerationAppealSubmittedScreen";

import { useAuth } from "../context/AuthContext";
import { SplashScreen } from "../screens/SplashScreen/SplashScreen";
import type { AuthPurpose } from "../types/auth";

/** Durée minimale du splash in-app (ms), en parallèle avec validateSession. */
const SPLASH_MIN_MS = 2000;

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
  AboutContent: undefined;
  SecurityKeys: undefined;
  TwoFactorAuth: undefined;
  TwoFactorSetup: undefined;
  TwoFactorVerify: { secret: string };
  TwoFactorBackupCodes: { codes: string[] };
  ConversationsList: undefined;
  Chat: { conversationId: string };
  Contacts: undefined;
  MyQRCode: undefined;
  QRCodeScanner: undefined;
  BlockedUsers: undefined;
  GroupDetails: { groupId: string; conversationId: string };
  GroupManagement: { groupId: string; conversationId: string };
  ScheduledMessages: { conversationId: string };
  Calls: undefined;
  ModerationTest: undefined;
  ModerationDecision:
    | {
        decisionId?: string;
        sanctionType?: string;
        reasonLabel?: string;
        incidentDate?: string;
        deadlineDate?: string;
        reference?: string;
      }
    | undefined;
  ModerationAppealForm: { decisionId: string };
  ModerationAppealSubmitted: {
    appealId: string;
    decisionId: string;
    status?: string;
  };
};

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuth();
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  const showSplash = isLoading || !splashMinElapsed;

  if (showSplash) {
    return <SplashScreen />;
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
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          // Le swipe-back horizontal capturait les gestes verticaux sur iOS ; le retour reste via la flèche.
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="AboutContent" component={AboutContentScreen} />
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
      <Stack.Screen name="MyQRCode" component={MyQRCodeScreen} />
      <Stack.Screen
        name="QRCodeScanner"
        getComponent={() =>
          require("../screens/Contacts/QRCodeScannerScreen").QRCodeScannerScreen
        }
      />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
      <Stack.Screen name="GroupManagement" component={GroupManagementScreen} />
      <Stack.Screen
        name="ScheduledMessages"
        component={ScheduledMessagesScreen}
      />
      <Stack.Screen name="Calls" component={CallsScreen} />
      <Stack.Screen
        name="ModerationDecision"
        component={ModerationDecisionScreen}
      />
      <Stack.Screen
        name="ModerationAppealForm"
        component={ModerationAppealFormScreen}
      />
      <Stack.Screen
        name="ModerationAppealSubmitted"
        component={ModerationAppealSubmittedScreen}
      />
      {__DEV__ && (
        <Stack.Screen name="ModerationTest" component={ModerationTestScreen} />
      )}
    </Stack.Navigator>
  );
};

export default AuthNavigator;
