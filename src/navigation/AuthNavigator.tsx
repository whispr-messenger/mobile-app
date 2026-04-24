import React, { useEffect, useState } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { WelcomeScreen } from "../screens/Auth/WelcomeScreen";
import { PhoneInputScreen } from "../screens/Auth/PhoneInputScreen";
import { OtpScreen } from "../screens/Auth/OtpScreen";
import { ProfileSetupScreen } from "../screens/Auth/ProfileSetupScreen";
import { MyProfileScreen } from "../screens/Profile/MyProfileScreen";
import { UserProfileScreen } from "../screens/Profile/UserProfileScreen";
import { SettingsScreen } from "../screens/Settings/SettingsScreen";
import { AboutContentScreen } from "../screens/Settings/AboutContentScreen";
import { DevicesScreen } from "../screens/Settings/DevicesScreen";
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
import { ModerationTestScreen } from "../screens/Debug/ModerationTestScreen";
import { ModerationDecisionScreen } from "../screens/Moderation/ModerationDecisionScreen";
import { ModerationAppealFormScreen } from "../screens/Moderation/ModerationAppealFormScreen";
import { ModerationAppealSubmittedScreen } from "../screens/Moderation/ModerationAppealSubmittedScreen";
import {
  ReportHistoryScreen,
  ReportDetailScreen,
  SanctionNoticeScreen,
  MySanctionsScreen,
  AppealFormScreen,
  AppealStatusScreen,
} from "../screens/Moderation";
import {
  ModerationDashboardScreen,
  ReportQueueScreen,
  ReportReviewScreen,
  AppealQueueScreen,
  AppealReviewScreen,
  UserModerationScreen,
  SanctionFormScreen,
} from "../screens/Admin";

import { useAuth } from "../context/AuthContext";
import { useOfflineQueueDrainer } from "../hooks/useOfflineQueueDrainer";
import { useModerationStore } from "../store/moderationStore";
import { useConversationsStore } from "../store/conversationsStore";
import { profileSetupFlag } from "../services/profileSetupFlag";
import { SplashScreen } from "../screens/SplashScreen/SplashScreen";
import { contactsAPI } from "../services/contacts/api";
import { TokenService } from "../services/TokenService";
import { UserService } from "../services/UserService";
import { NotificationService } from "../services/NotificationService";
import Constants from "expo-constants";
import type { AuthPurpose } from "../types/auth";
import type {
  Report,
  Appeal,
  UserSanction,
  SanctionType,
} from "../types/moderation";

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
  MyProfile: undefined;
  UserProfile: { userId: string };
  Settings: undefined;
  AboutContent: undefined;
  SecurityKeys: undefined;
  Devices: undefined;
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
  GroupDetails: {
    groupId: string;
    conversationId: string;
    conversationName?: string;
  };
  GroupManagement: { groupId: string; conversationId: string };
  ScheduledMessages: { conversationId: string };
  Calls: undefined;
  IncomingCall: undefined;
  InCall: undefined;
  CallHistory: undefined;
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
  // Moderation (user-facing)
  ReportHistory: undefined;
  ReportDetail: { report: Report };
  MySanctions: undefined;
  SanctionNotice: { sanctionId: string };
  AppealForm: { sanction: UserSanction };
  AppealStatus: { sanctionId?: string; appealId?: string };
  // Admin screens
  ModerationDashboard: undefined;
  ReportQueue: undefined;
  ReportReview: { report: Report };
  AppealQueue: undefined;
  AppealReview: { appealId?: string; appeal?: Appeal };
  UserModeration: { userId: string; userName?: string; userAvatar?: string };
  SanctionForm: {
    userId?: string;
    userName?: string;
    defaultType?: SanctionType;
  };
};

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  const { isLoading, isAuthenticated, userId } = useAuth();
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);
  const [profileSetupPending, setProfileSetupPending] = useState<
    boolean | null
  >(null);
  const fetchMyRole = useModerationStore((s) => s.fetchMyRole);

  // WHISPR-1060: drain any offline-queued messages left over from a
  // previous session as soon as the authenticated tree mounts, and keep
  // listening for WebSocket reconnects to drain on demand. The hook is
  // a no-op when the queue is empty, so calling it unconditionally is
  // cheap.
  useOfflineQueueDrainer();

  useEffect(() => {
    const t = setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfileSetupPending(false);
      return;
    }
    let cancelled = false;
    profileSetupFlag
      .get()
      .then((flag) => {
        if (!cancelled) setProfileSetupPending(flag === "0");
      })
      .catch(() => {
        if (!cancelled) setProfileSetupPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // WHISPR-929: load the current user's moderation role as soon as the app
  // enters its authenticated tree so every screen (not just Settings) can
  // gate admin-only UI correctly from first render.
  useEffect(() => {
    if (isAuthenticated) {
      fetchMyRole();
    }
  }, [isAuthenticated, fetchMyRole]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const preload = async () => {
      const token = await TokenService.getAccessToken();
      if (!token || cancelled) return;
      await Promise.allSettled([
        useConversationsStore.getState().fetchConversations(),
        useConversationsStore.getState().loadManuallyUnreadIds(),
        contactsAPI.getContacts(),
        contactsAPI.getContactRequests(),
        UserService.getInstance().getPrivacySettings(),
        userId ? NotificationService.getSettings(userId) : Promise.resolve(),
      ]);
    };

    preload().catch(() => {});
    try {
      require("../screens/Contacts/QRCodeScannerScreen");
    } catch {}
    if (Constants.appOwnership !== "expo") {
      try {
        require("../screens/Calls/CallsScreen");
        require("../screens/Calls/IncomingCallScreen");
        require("../screens/Calls/InCallScreen");
        require("../screens/Calls/CallHistoryScreen");
      } catch {}
    }
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  const showSplash =
    isLoading || !splashMinElapsed || profileSetupPending === null;

  if (showSplash) {
    return <SplashScreen />;
  }

  const initialRouteName = !isAuthenticated
    ? "Welcome"
    : profileSetupPending
      ? "ProfileSetup"
      : "ConversationsList";

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
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
      <Stack.Screen name="MyProfile" component={MyProfileScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
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
      <Stack.Screen name="Devices" component={DevicesScreen} />
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
      <Stack.Screen
        name="Calls"
        getComponent={() => require("../screens/Calls/CallsScreen").CallsScreen}
      />
      <Stack.Screen
        name="IncomingCall"
        getComponent={() =>
          require("../screens/Calls/IncomingCallScreen").IncomingCallScreen
        }
        options={{
          presentation: "modal",
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="InCall"
        getComponent={() =>
          require("../screens/Calls/InCallScreen").InCallScreen
        }
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="CallHistory"
        getComponent={() =>
          require("../screens/Calls/CallHistoryScreen").CallHistoryScreen
        }
        options={{ title: "Appels" }}
      />
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
      {/* Moderation — user-facing */}
      <Stack.Screen name="ReportHistory" component={ReportHistoryScreen} />
      <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
      <Stack.Screen name="MySanctions" component={MySanctionsScreen} />
      <Stack.Screen
        name="SanctionNotice"
        component={SanctionNoticeScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="AppealForm" component={AppealFormScreen} />
      <Stack.Screen name="AppealStatus" component={AppealStatusScreen} />
      {/* Moderation — admin */}
      <Stack.Screen
        name="ModerationDashboard"
        component={ModerationDashboardScreen}
      />
      <Stack.Screen name="ReportQueue" component={ReportQueueScreen} />
      <Stack.Screen name="ReportReview" component={ReportReviewScreen} />
      <Stack.Screen name="AppealQueue" component={AppealQueueScreen} />
      <Stack.Screen name="AppealReview" component={AppealReviewScreen} />
      <Stack.Screen name="UserModeration" component={UserModerationScreen} />
      <Stack.Screen name="SanctionForm" component={SanctionFormScreen} />
      {__DEV__ && (
        <Stack.Screen name="ModerationTest" component={ModerationTestScreen} />
      )}
    </Stack.Navigator>
  );
};

export default AuthNavigator;
