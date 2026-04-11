/**
 * SettingsScreen - Application Settings
 * WHISPR-133: Implement SettingsScreen with app configuration
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { UserService, PrivacySettings } from "../../services/UserService";
import {
  NotificationService,
  NotificationSettings,
} from "../../services/NotificationService";
import { SettingsChoiceAlert } from "./SettingsChoiceAlert";

const PRIVACY_ALERT_TITLE: Record<string, string> = {
  profilePhoto: "Profile photo",
  firstName: "First name",
  lastName: "Last name",
  biography: "Biography",
};

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList>>();
  const {
    settings,
    updateSettings,
    getThemeColors,
    getFontSize,
    getLocalizedText,
  } = useTheme();
  const themeColors = getThemeColors();
  const { signOut, userId } = useAuth();

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showFontSizeModal, setShowFontSizeModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [selectedPrivacyItem, setSelectedPrivacyItem] = useState<string | null>(
    null,
  );

  // AsyncStorage keys
  const STORAGE_KEYS = {
    privacy: "@whispr_settings_privacy",
    notifications: "@whispr_settings_notifications",
    messaging: "@whispr_settings_messaging",
    app: "@whispr_settings_app",
    security: "@whispr_settings_security",
  };

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState({
    profilePhoto: "Everyone",
    firstName: "Everyone",
    lastName: "Contacts",
    biography: "Everyone",
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    notifications: true,
    sound: true,
    mentions: true,
  });

  // Messaging settings
  const [messagingSettings, setMessagingSettings] = useState({
    readReceipts: true,
    typingIndicator: true,
  });

  // Application settings
  const [appSettings, setAppSettings] = useState({
    autoPlayMedia: true,
  });

  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    biometricAuth: false,
  });

  /**
   * Persist a settings category to AsyncStorage
   */
  const persistSettings = useCallback(
    async (key: string, value: Record<string, any>) => {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error("Error persisting settings:", error);
      }
    },
    [],
  );

  /**
   * Map local privacy values (Everyone/Contacts/Nobody) to API format (everyone/contacts/nobody)
   */
  const privacyToApi = useCallback(
    (local: typeof privacySettings): PrivacySettings => ({
      profilePictureVisibility: local.profilePhoto.toLowerCase() as
        | "everyone"
        | "contacts"
        | "nobody",
      firstNameVisibility: local.firstName.toLowerCase() as
        | "everyone"
        | "contacts"
        | "nobody",
      lastNameVisibility: local.lastName.toLowerCase() as
        | "everyone"
        | "contacts"
        | "nobody",
      biographyVisibility: local.biography.toLowerCase() as
        | "everyone"
        | "contacts"
        | "nobody",
      searchVisibility: true,
      phoneNumberSearch: "everyone",
    }),
    [],
  );

  /**
   * Map API privacy format back to local format
   */
  const apiToPrivacy = useCallback((api: PrivacySettings) => {
    const capitalize = (s: string) =>
      s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
    return {
      profilePhoto: capitalize(api.profilePictureVisibility),
      firstName: capitalize(api.firstNameVisibility),
      lastName: capitalize(api.lastNameVisibility),
      biography: capitalize(api.biographyVisibility),
    };
  }, []);

  /**
   * Map local notification settings to the notification-service API format
   */
  const notificationToApi = useCallback(
    (local: typeof notificationSettings): Partial<NotificationSettings> => ({
      push_enabled: local.notifications,
      sound_enabled: local.sound,
      vibration_enabled: local.mentions,
    }),
    [],
  );

  /**
   * Map notification-service API format back to local format
   */
  const apiToNotification = useCallback(
    (api: NotificationSettings) => ({
      notifications: api.push_enabled,
      sound: api.sound_enabled,
      mentions: api.vibration_enabled,
    }),
    [],
  );

  /**
   * Sync notification settings to the notification-service backend.
   * Uses a PATCH-style merge: reads current backend settings first, then
   * updates only the fields we manage locally, preserving backend-only
   * fields (message_previews, show_sender_name, quiet_hours_*).
   */
  const syncNotificationsToBackend = useCallback(
    async (local: typeof notificationSettings) => {
      if (!userId) return;
      try {
        let existing: Partial<NotificationSettings> = {};
        try {
          existing = await NotificationService.getSettings(userId);
        } catch {
          // If fetching fails, proceed with only local fields
        }
        const merged: Partial<NotificationSettings> = {
          ...existing,
          ...notificationToApi(local),
        };
        await NotificationService.updateSettings(userId, merged);
      } catch (error) {
        console.error("Error syncing notification settings to backend:", error);
      }
    },
    [userId, notificationToApi],
  );

  /**
   * Sync privacy settings to the backend API
   */
  const syncPrivacyToBackend = useCallback(
    async (localPrivacy: typeof privacySettings) => {
      try {
        const userService = UserService.getInstance();
        const apiSettings = privacyToApi(localPrivacy);
        const result = await userService.updatePrivacySettings(apiSettings);
        if (!result.success) {
          console.error("Failed to sync privacy settings:", result.message);
        }
      } catch (error) {
        console.error("Error syncing privacy to backend:", error);
      }
    },
    [privacyToApi],
  );

  /**
   * Load all settings from AsyncStorage and privacy from API on mount
   */
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [privacyJson, notifJson, msgJson, appJson, secJson] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.privacy),
            AsyncStorage.getItem(STORAGE_KEYS.notifications),
            AsyncStorage.getItem(STORAGE_KEYS.messaging),
            AsyncStorage.getItem(STORAGE_KEYS.app),
            AsyncStorage.getItem(STORAGE_KEYS.security),
          ]);

        if (privacyJson) setPrivacySettings(JSON.parse(privacyJson));
        if (notifJson) setNotificationSettings(JSON.parse(notifJson));
        if (msgJson) setMessagingSettings(JSON.parse(msgJson));
        if (appJson) setAppSettings(JSON.parse(appJson));
        if (secJson) setSecuritySettings(JSON.parse(secJson));

        // Also fetch privacy settings from backend API (takes precedence over local)
        const userService = UserService.getInstance();
        const result = await userService.getPrivacySettings();
        if (result.success && result.settings) {
          const localPrivacy = apiToPrivacy(result.settings);
          setPrivacySettings(localPrivacy);
          await AsyncStorage.setItem(
            STORAGE_KEYS.privacy,
            JSON.stringify(localPrivacy),
          );
        }

        // Fetch notification settings from notification-service backend (takes precedence over local)
        if (userId) {
          try {
            const backendNotif = await NotificationService.getSettings(userId);
            const localNotif = apiToNotification(backendNotif);
            setNotificationSettings(localNotif);
            await AsyncStorage.setItem(
              STORAGE_KEYS.notifications,
              JSON.stringify(localNotif),
            );
          } catch (notifError) {
            console.error(
              "Error fetching notification settings from backend:",
              notifError,
            );
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = (category: string, key: string, value: boolean) => {
    switch (category) {
      case "notifications":
        setNotificationSettings((prev) => {
          const updated = { ...prev, [key]: value };
          persistSettings(STORAGE_KEYS.notifications, updated);
          syncNotificationsToBackend(updated);
          return updated;
        });
        break;
      case "messaging":
        setMessagingSettings((prev) => {
          const updated = { ...prev, [key]: value };
          persistSettings(STORAGE_KEYS.messaging, updated);
          return updated;
        });
        break;
      case "app":
        setAppSettings((prev) => {
          const updated = { ...prev, [key]: value };
          persistSettings(STORAGE_KEYS.app, updated);
          return updated;
        });
        break;
      case "security":
        setSecuritySettings((prev) => {
          const updated = { ...prev, [key]: value };
          persistSettings(STORAGE_KEYS.security, updated);
          return updated;
        });
        break;
    }
  };

  const handleSelect = async (
    type: "theme" | "language" | "fontSize" | "privacy",
    value: string,
  ) => {
    try {
      if (type === "theme") {
        // Fermer le modal d'abord pour éviter les conflits de re-render
        setShowThemeModal(false);
        // Attendre un peu pour que le modal se ferme avant le changement de thème
        setTimeout(async () => {
          await updateSettings({ theme: value as "light" | "dark" | "auto" });
        }, 100);
      } else if (type === "language") {
        setShowLanguageModal(false);
        setTimeout(async () => {
          await updateSettings({ language: value as "fr" | "en" });
        }, 100);
      } else if (type === "fontSize") {
        setShowFontSizeModal(false);
        setTimeout(async () => {
          await updateSettings({
            fontSize: value as "small" | "medium" | "large",
          });
        }, 100);
      } else if (type === "privacy" && selectedPrivacyItem) {
        setPrivacySettings((prev) => {
          const updated = { ...prev, [selectedPrivacyItem]: value };
          persistSettings(STORAGE_KEYS.privacy, updated);
          syncPrivacyToBackend(updated);
          return updated;
        });
        setShowPrivacyModal(false);
        setSelectedPrivacyItem(null);
      }
    } catch (error) {
      console.error("Error updating setting:", error);
    }
  };

  const handlePrivacyItemPress = (item: string) => {
    setSelectedPrivacyItem(item);
    setShowPrivacyModal(true);
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(getLocalizedText("notif.logoutConfirm"));
      if (confirmed) {
        signOut().then(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: "Welcome" as never }],
          });
        });
      }
      return;
    }
    Alert.alert(
      getLocalizedText("settings.logout"),
      getLocalizedText("notif.logoutConfirm"),
      [
        { text: getLocalizedText("common.cancel"), style: "cancel" },
        {
          text: getLocalizedText("settings.logout"),
          style: "destructive",
          onPress: async () => {
            await signOut();
            navigation.reset({
              index: 0,
              routes: [{ name: "Welcome" as never }],
            });
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "This action is irreversible. All your data, messages, and contacts will be permanently deleted. Are you sure you want to delete your account?",
      );
      if (confirmed) {
        // TODO: Replace signOut() with a real DELETE /user/account endpoint
        // that permanently removes the user's data from the backend
        signOut().then(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: "Welcome" as never }],
          });
        });
      }
      return;
    }
    Alert.alert(
      getLocalizedText("settings.deleteAccount"),
      "This action is irreversible. All your data, messages, and contacts will be permanently deleted. Are you sure you want to delete your account?",
      [
        { text: getLocalizedText("common.cancel"), style: "cancel" },
        {
          text: getLocalizedText("common.delete"),
          style: "destructive",
          onPress: async () => {
            // TODO: Replace signOut() with a real DELETE /user/account endpoint
            // that permanently removes the user's data from the backend
            await signOut();
            navigation.reset({
              index: 0,
              routes: [{ name: "Welcome" as never }],
            });
          },
        },
      ],
    );
  };

  const SettingItem = ({
    label,
    subtitle,
    value,
    onPress,
    rightComponent,
    icon,
  }: {
    label: string;
    subtitle?: string;
    value?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
    icon?: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.settingItem,
        { backgroundColor: themeColors.background.secondary },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingItemLeft}>
        {icon && (
          <Ionicons
            name={icon as any}
            size={20}
            color={themeColors.text.secondary}
            style={styles.settingIcon}
          />
        )}
        <View style={styles.settingTextContainer}>
          <Text
            style={[
              styles.settingLabel,
              {
                color: themeColors.text.primary,
                fontSize: getFontSize("base"),
              },
            ]}
          >
            {label}
          </Text>
          {subtitle && (
            <Text
              style={[
                styles.settingSubtitle,
                {
                  color: themeColors.text.secondary,
                  fontSize: getFontSize("sm"),
                },
              ]}
            >
              {subtitle}
            </Text>
          )}
          {value && !subtitle && (
            <Text
              style={[
                styles.settingValue,
                {
                  color: themeColors.text.secondary,
                  fontSize: getFontSize("sm"),
                },
              ]}
            >
              {value}
            </Text>
          )}
        </View>
      </View>
      {rightComponent || (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={themeColors.text.tertiary}
        />
      )}
    </TouchableOpacity>
  );

  const SettingSection = ({
    title,
    icon,
    children,
  }: {
    title: string;
    icon: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons
          name={icon as any}
          size={20}
          color={themeColors.text.secondary}
          style={styles.sectionIcon}
        />
        <Text
          style={[
            styles.sectionTitle,
            { color: themeColors.text.primary, fontSize: getFontSize("lg") },
          ]}
        >
          {title}
        </Text>
      </View>
      <View
        style={[
          styles.sectionContent,
          { backgroundColor: themeColors.background.secondary },
        ]}
      >
        {children}
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={themeColors.background.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
          <Text
            style={[
              styles.title,
              {
                color: themeColors.text.primary,
                fontSize: getFontSize("xxxl"),
              },
            ]}
          >
            {getLocalizedText("settings.title")}
          </Text>
        </View>

        {/* Privacy Section */}
        <SettingSection
          title={getLocalizedText("settings.privacy")}
          icon="shield-outline"
        >
          <SettingItem
            label="Profile photo"
            value={privacySettings.profilePhoto}
            onPress={() => handlePrivacyItemPress("profilePhoto")}
          />
          <SettingItem
            label="First name"
            value={privacySettings.firstName}
            onPress={() => handlePrivacyItemPress("firstName")}
          />
          <SettingItem
            label="Last name"
            value={privacySettings.lastName}
            onPress={() => handlePrivacyItemPress("lastName")}
          />
          <SettingItem
            label="Biography"
            value={privacySettings.biography}
            onPress={() => handlePrivacyItemPress("biography")}
          />
        </SettingSection>

        {/* Notifications Section */}
        <SettingSection
          title={getLocalizedText("settings.notifications")}
          icon="notifications-outline"
        >
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("base"),
                    },
                  ]}
                >
                  Notifications
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    {
                      color: themeColors.text.secondary,
                      fontSize: getFontSize("sm"),
                    },
                  ]}
                >
                  Receive notifications
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.notifications}
              onValueChange={(value) =>
                handleToggle("notifications", "notifications", value)
              }
              trackColor={{
                false: themeColors.text.tertiary,
                true: themeColors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("base"),
                    },
                  ]}
                >
                  Sound
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    {
                      color: themeColors.text.secondary,
                      fontSize: getFontSize("sm"),
                    },
                  ]}
                >
                  Notification sound
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.sound}
              onValueChange={(value) =>
                handleToggle("notifications", "sound", value)
              }
              trackColor={{
                false: themeColors.text.tertiary,
                true: themeColors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("base"),
                    },
                  ]}
                >
                  Mentions
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    {
                      color: themeColors.text.secondary,
                      fontSize: getFontSize("sm"),
                    },
                  ]}
                >
                  Mention notifications
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.mentions}
              onValueChange={(value) =>
                handleToggle("notifications", "mentions", value)
              }
              trackColor={{
                false: themeColors.text.tertiary,
                true: themeColors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </SettingSection>

        {/* Messaging Section */}
        <SettingSection
          title={getLocalizedText("settings.messaging")}
          icon="chatbubbles-outline"
        >
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("base"),
                    },
                  ]}
                >
                  Read receipts
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    {
                      color: themeColors.text.secondary,
                      fontSize: getFontSize("sm"),
                    },
                  ]}
                >
                  Confirm message reading
                </Text>
              </View>
            </View>
            <Switch
              value={messagingSettings.readReceipts}
              onValueChange={(value) =>
                handleToggle("messaging", "readReceipts", value)
              }
              trackColor={{
                false: themeColors.text.tertiary,
                true: themeColors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("base"),
                    },
                  ]}
                >
                  Typing indicator
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    {
                      color: themeColors.text.secondary,
                      fontSize: getFontSize("sm"),
                    },
                  ]}
                >
                  Show 'typing'
                </Text>
              </View>
            </View>
            <Switch
              value={messagingSettings.typingIndicator}
              onValueChange={(value) =>
                handleToggle("messaging", "typingIndicator", value)
              }
              trackColor={{
                false: themeColors.text.tertiary,
                true: themeColors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </SettingSection>

        {/* Application Settings */}
        <SettingSection
          title={getLocalizedText("settings.application")}
          icon="settings-outline"
        >
          <SettingItem
            label={getLocalizedText("settings.theme")}
            value={
              settings.theme === "light"
                ? getLocalizedText("settings.theme.light")
                : settings.theme === "dark"
                  ? getLocalizedText("settings.theme.dark")
                  : getLocalizedText("settings.theme.auto")
            }
            onPress={() => setShowThemeModal(true)}
          />
          <SettingItem
            label={getLocalizedText("settings.language")}
            value={
              settings.language === "fr"
                ? getLocalizedText("settings.language.fr")
                : getLocalizedText("settings.language.en")
            }
            onPress={() => setShowLanguageModal(true)}
          />
          <SettingItem
            label={getLocalizedText("settings.fontSize")}
            value={
              settings.fontSize === "small"
                ? getLocalizedText("settings.fontSize.small")
                : settings.fontSize === "medium"
                  ? getLocalizedText("settings.fontSize.medium")
                  : getLocalizedText("settings.fontSize.large")
            }
            onPress={() => setShowFontSizeModal(true)}
          />
        </SettingSection>

        {/* Security Settings */}
        <SettingSection
          title={getLocalizedText("settings.security")}
          icon="lock-closed-outline"
        >
          <SettingItem
            label="Security Keys"
            subtitle="Manage your encryption keys and devices"
            onPress={() => navigation.navigate("SecurityKeys" as never)}
            icon="key-outline"
          />
          <SettingItem
            label={getLocalizedText("twoFactor.title")}
            subtitle={getLocalizedText("twoFactor.authenticationSubtitle")}
            onPress={() => navigation.navigate("TwoFactorAuth" as never)}
            icon="shield-checkmark-outline"
          />
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("base"),
                    },
                  ]}
                >
                  Biometric authentication
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    {
                      color: themeColors.text.secondary,
                      fontSize: getFontSize("sm"),
                    },
                  ]}
                >
                  Unlock with fingerprint/face
                </Text>
              </View>
            </View>
            <Switch
              value={securitySettings.biometricAuth}
              onValueChange={(value) =>
                handleToggle("security", "biometricAuth", value)
              }
              trackColor={{
                false: themeColors.text.tertiary,
                true: themeColors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </SettingSection>

        {/* Account Settings */}
        <SettingSection
          title={getLocalizedText("settings.account")}
          icon="person-outline"
        >
          <SettingItem
            label={getLocalizedText("settings.myProfile")}
            subtitle={getLocalizedText("settings.myProfileSubtitle")}
            onPress={() => navigation.navigate("Profile", {})}
            icon="person-circle-outline"
            rightComponent={
              <Ionicons
                name="chevron-forward"
                size={20}
                color={themeColors.text.tertiary}
              />
            }
          />
          <SettingItem
            label={getLocalizedText("settings.logout")}
            subtitle="Log out of your account"
            onPress={handleLogout}
            rightComponent={
              <Ionicons
                name="chevron-forward"
                size={20}
                color={themeColors.text.tertiary}
              />
            }
          />
          <SettingItem
            label={getLocalizedText("settings.deleteAccount")}
            subtitle="Permanently delete your account"
            onPress={handleDeleteAccount}
            rightComponent={
              <Ionicons
                name="chevron-forward"
                size={20}
                color={themeColors.text.tertiary}
              />
            }
          />
        </SettingSection>

        {/* Developer / Debug — stripped from production bundles */}
        {__DEV__ && (
          <SettingSection title="Debug" icon="bug-outline">
            <SettingItem
              label="Moderation Test"
              subtitle="Run the on-device TFJS image gate"
              onPress={() => navigation.navigate("ModerationTest" as never)}
              icon="image-outline"
              rightComponent={
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={themeColors.text.tertiary}
                />
              }
            />
          </SettingSection>
        )}
      </ScrollView>

      {/* Modals — alerte centrée style iOS (Application + Privacy) */}
      <SettingsChoiceAlert
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        title={getLocalizedText("settings.theme")}
        options={[
          { label: getLocalizedText("settings.theme.auto"), value: "auto" },
          { label: getLocalizedText("settings.theme.light"), value: "light" },
          { label: getLocalizedText("settings.theme.dark"), value: "dark" },
        ]}
        selectedValue={settings.theme}
        onSelect={(value) => handleSelect("theme", value)}
        cancelLabel={getLocalizedText("common.cancel")}
        layout="vertical"
      />

      <SettingsChoiceAlert
        visible={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        title={getLocalizedText("settings.language")}
        options={[
          { label: getLocalizedText("settings.language.fr"), value: "fr" },
          { label: getLocalizedText("settings.language.en"), value: "en" },
        ]}
        selectedValue={settings.language}
        onSelect={(value) => handleSelect("language", value)}
        cancelLabel={getLocalizedText("common.cancel")}
        layout="auto"
      />

      <SettingsChoiceAlert
        visible={showFontSizeModal}
        onClose={() => setShowFontSizeModal(false)}
        title={getLocalizedText("settings.fontSize")}
        options={[
          {
            label: getLocalizedText("settings.fontSize.small"),
            value: "small",
          },
          {
            label: getLocalizedText("settings.fontSize.medium"),
            value: "medium",
          },
          {
            label: getLocalizedText("settings.fontSize.large"),
            value: "large",
          },
        ]}
        selectedValue={settings.fontSize}
        onSelect={(value) => handleSelect("fontSize", value)}
        cancelLabel={getLocalizedText("common.cancel")}
        layout="vertical"
      />

      {selectedPrivacyItem && (
        <SettingsChoiceAlert
          visible={showPrivacyModal}
          onClose={() => {
            setShowPrivacyModal(false);
            setSelectedPrivacyItem(null);
          }}
          title={PRIVACY_ALERT_TITLE[selectedPrivacyItem] ?? selectedPrivacyItem}
          options={[
            { label: "Everyone", value: "Everyone" },
            { label: "Contacts", value: "Contacts" },
            { label: "Nobody", value: "Nobody" },
          ]}
          selectedValue={
            privacySettings[
              selectedPrivacyItem as keyof typeof privacySettings
            ] as string
          }
          onSelect={(value) => handleSelect("privacy", value)}
          cancelLabel={getLocalizedText("common.cancel")}
          layout="vertical"
        />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontWeight: "bold",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontWeight: "bold",
  },
  sectionContent: {
    borderRadius: 12,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontWeight: "500",
  },
  settingSubtitle: {
    marginTop: 2,
  },
  settingValue: {
    marginTop: 2,
  },
});

export default SettingsScreen;
