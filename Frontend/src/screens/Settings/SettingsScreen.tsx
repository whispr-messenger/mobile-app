/**
 * SettingsScreen - Application Settings
 * WHISPR-133: Implement SettingsScreen with app configuration
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import AuthService from '../../services/AuthService';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { settings, updateSettings, getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showFontSizeModal, setShowFontSizeModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [selectedPrivacyItem, setSelectedPrivacyItem] = useState<string | null>(null);

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState({
    profilePhoto: 'Everyone',
    firstName: 'Everyone',
    lastName: 'Contacts',
    biography: 'Everyone',
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

  const handleToggle = (category: string, key: string, value: boolean) => {
    console.log(`🔄 Toggle ${category}.${key}:`, value);
    
    switch (category) {
      case 'notifications':
        setNotificationSettings(prev => ({ ...prev, [key]: value }));
        break;
      case 'messaging':
        setMessagingSettings(prev => ({ ...prev, [key]: value }));
        break;
      case 'app':
        setAppSettings(prev => ({ ...prev, [key]: value }));
        break;
      case 'security':
        setSecuritySettings(prev => ({ ...prev, [key]: value }));
        break;
    }
  };

  const handleSelect = async (type: 'theme' | 'language' | 'fontSize' | 'privacy', value: string) => {
    console.log(`🎯 Select ${type}:`, value);
    
    if (type === 'theme') {
      await updateSettings({ theme: value as 'light' | 'dark' | 'auto' });
      setShowThemeModal(false);
    } else if (type === 'language') {
      await updateSettings({ language: value as 'fr' | 'en' });
      setShowLanguageModal(false);
    } else if (type === 'fontSize') {
      await updateSettings({ fontSize: value as 'small' | 'medium' | 'large' });
      setShowFontSizeModal(false);
    } else if (type === 'privacy' && selectedPrivacyItem) {
      try {
        setPrivacySettings(prev => ({ ...prev, [selectedPrivacyItem]: value }));
        setShowPrivacyModal(false);
        setSelectedPrivacyItem(null);
      } catch (error) {
        console.error('❌ Error updating privacy setting:', error);
      }
    }
  };

  const handlePrivacyItemPress = (item: string) => {
    setSelectedPrivacyItem(item);
    setShowPrivacyModal(true);
  };

  const handleLogout = () => {
    Alert.alert(
      getLocalizedText('settings.logout'),
      getLocalizedText('notif.logoutConfirm'),
      [
        { text: getLocalizedText('common.cancel'), style: 'cancel' },
        {
          text: getLocalizedText('settings.logout'),
          style: 'destructive',
          onPress: async () => {
            const result = await AuthService.getInstance().logout();
            if (result.success) {
              Alert.alert(getLocalizedText('notif.success'), getLocalizedText('notif.logoutSuccess'));
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' as never }],
              });
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      getLocalizedText('settings.deleteAccount'),
      getLocalizedText('notif.deleteAccountConfirm'),
      [
        { text: getLocalizedText('common.cancel'), style: 'cancel' },
        {
          text: getLocalizedText('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const result = await AuthService.getInstance().deleteAccount();
            if (result.success) {
              Alert.alert(getLocalizedText('notif.success'), getLocalizedText('notif.deleteAccountSuccess'));
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' as never }],
              });
            }
          },
        },
      ]
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
              { color: themeColors.text.primary, fontSize: getFontSize('base') },
            ]}
          >
            {label}
          </Text>
          {subtitle && (
            <Text
              style={[
                styles.settingSubtitle,
                { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
              ]}
            >
              {subtitle}
            </Text>
          )}
          {value && !subtitle && (
            <Text
              style={[
                styles.settingValue,
                { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
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
            { color: themeColors.text.primary, fontSize: getFontSize('lg') },
          ]}
        >
          {title}
        </Text>
      </View>
      <View style={[styles.sectionContent, { backgroundColor: themeColors.background.secondary }]}>
        {children}
      </View>
    </View>
  );

  const SelectionModal = ({
    visible,
    onClose,
    title,
    subtitle,
    options,
    selectedValue,
    onSelect,
  }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    options: { label: string; value: string }[];
    selectedValue: string;
    onSelect: (value: string) => void;
  }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: themeColors.background.primary },
          ]}
        >
          <Text
            style={[
              styles.modalTitle,
              { color: themeColors.text.primary, fontSize: getFontSize('xl') },
            ]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[
                styles.modalSubtitle,
                { color: themeColors.text.secondary, fontSize: getFontSize('base') },
              ]}
            >
              {subtitle}
            </Text>
          )}
          <ScrollView style={styles.modalScrollView}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  {
                    backgroundColor:
                      selectedValue === option.value
                        ? themeColors.primary + '20'
                        : 'transparent',
                  },
                ]}
                onPress={() => onSelect(option.value)}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    {
                      color:
                        selectedValue === option.value
                          ? themeColors.primary
                          : themeColors.text.primary,
                      fontSize: getFontSize('base'),
                    },
                  ]}
                >
                  {option.label}
                </Text>
                {selectedValue === option.value && (
                  <Ionicons name="checkmark" size={20} color={themeColors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.modalCloseButton, { backgroundColor: themeColors.primary }]}
            onPress={onClose}
          >
            <Text
              style={[
                styles.modalCloseButtonText,
                { color: '#FFFFFF', fontSize: getFontSize('base') },
              ]}
            >
              {getLocalizedText('common.cancel')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
          </TouchableOpacity>
          <Text
            style={[
              styles.title,
              { color: themeColors.text.primary, fontSize: getFontSize('xxxl') },
            ]}
          >
            {getLocalizedText('settings.title')}
          </Text>
        </View>

        {/* Privacy Section */}
        <SettingSection title={getLocalizedText('settings.privacy')} icon="shield-outline">
          <SettingItem
            label="Profile photo"
            value={privacySettings.profilePhoto}
            onPress={() => handlePrivacyItemPress('profilePhoto')}
          />
          <SettingItem
            label="First name"
            value={privacySettings.firstName}
            onPress={() => handlePrivacyItemPress('firstName')}
          />
          <SettingItem
            label="Last name"
            value={privacySettings.lastName}
            onPress={() => handlePrivacyItemPress('lastName')}
          />
          <SettingItem
            label="Biography"
            value={privacySettings.biography}
            onPress={() => handlePrivacyItemPress('biography')}
          />
        </SettingSection>

        {/* Notifications Section */}
        <SettingSection title={getLocalizedText('settings.notifications')} icon="notifications-outline">
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: themeColors.text.primary, fontSize: getFontSize('base') },
                  ]}
                >
                  Notifications
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                  ]}
                >
                  Receive notifications
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.notifications}
              onValueChange={(value) => handleToggle('notifications', 'notifications', value)}
              trackColor={{ false: themeColors.text.tertiary, true: themeColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: themeColors.text.primary, fontSize: getFontSize('base') },
                  ]}
                >
                  Sound
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                  ]}
                >
                  Notification sound
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.sound}
              onValueChange={(value) => handleToggle('notifications', 'sound', value)}
              trackColor={{ false: themeColors.text.tertiary, true: themeColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: themeColors.text.primary, fontSize: getFontSize('base') },
                  ]}
                >
                  Mentions
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                  ]}
                >
                  Mention notifications
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.mentions}
              onValueChange={(value) => handleToggle('notifications', 'mentions', value)}
              trackColor={{ false: themeColors.text.tertiary, true: themeColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </SettingSection>

        {/* Messaging Section */}
        <SettingSection title={getLocalizedText('settings.messaging')} icon="chatbubbles-outline">
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: themeColors.text.primary, fontSize: getFontSize('base') },
                  ]}
                >
                  Read receipts
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                  ]}
                >
                  Confirm message reading
                </Text>
              </View>
            </View>
            <Switch
              value={messagingSettings.readReceipts}
              onValueChange={(value) => handleToggle('messaging', 'readReceipts', value)}
              trackColor={{ false: themeColors.text.tertiary, true: themeColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: themeColors.text.primary, fontSize: getFontSize('base') },
                  ]}
                >
                  Typing indicator
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                  ]}
                >
                  Show 'typing'
                </Text>
              </View>
            </View>
            <Switch
              value={messagingSettings.typingIndicator}
              onValueChange={(value) => handleToggle('messaging', 'typingIndicator', value)}
              trackColor={{ false: themeColors.text.tertiary, true: themeColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </SettingSection>

        {/* Application Settings */}
        <SettingSection title={getLocalizedText('settings.application')} icon="settings-outline">
          <SettingItem
            label={getLocalizedText('settings.theme')}
            value={
              settings.theme === 'light'
                ? getLocalizedText('settings.theme.light')
                : settings.theme === 'dark'
                ? getLocalizedText('settings.theme.dark')
                : 'Automatic'
            }
            onPress={() => setShowThemeModal(true)}
          />
          <SettingItem
            label={getLocalizedText('settings.language')}
            value={
              settings.language === 'fr'
                ? getLocalizedText('settings.language.fr')
                : getLocalizedText('settings.language.en')
            }
            onPress={() => setShowLanguageModal(true)}
          />
          <SettingItem
            label={getLocalizedText('settings.fontSize')}
            value={
              settings.fontSize === 'small'
                ? getLocalizedText('settings.fontSize.small')
                : settings.fontSize === 'medium'
                ? getLocalizedText('settings.fontSize.medium')
                : getLocalizedText('settings.fontSize.large')
            }
            onPress={() => setShowFontSizeModal(true)}
          />
        </SettingSection>

        {/* Security Settings */}
        <SettingSection title={getLocalizedText('settings.security')} icon="lock-closed-outline">
          <SettingItem
            label="Security Keys"
            subtitle="Manage your encryption keys and devices"
            onPress={() => navigation.navigate('SecurityKeys' as never)}
            icon="key-outline"
          />
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: themeColors.text.primary, fontSize: getFontSize('base') },
                  ]}
                >
                  Two-factor authentication
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                  ]}
                >
                  Secure your account
                </Text>
              </View>
            </View>
            <Switch
              value={securitySettings.twoFactorAuth}
              onValueChange={(value) => handleToggle('security', 'twoFactorAuth', value)}
              trackColor={{ false: themeColors.text.tertiary, true: themeColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: themeColors.text.primary, fontSize: getFontSize('base') },
                  ]}
                >
                  Biometric authentication
                </Text>
                <Text
                  style={[
                    styles.settingSubtitle,
                    { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                  ]}
                >
                  Unlock with fingerprint/face
                </Text>
              </View>
            </View>
            <Switch
              value={securitySettings.biometricAuth}
              onValueChange={(value) => handleToggle('security', 'biometricAuth', value)}
              trackColor={{ false: themeColors.text.tertiary, true: themeColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </SettingSection>

        {/* Account Settings */}
        <SettingSection title={getLocalizedText('settings.account')} icon="person-outline">
          <SettingItem
            label={getLocalizedText('settings.logout')}
            subtitle="Log out of your account"
            onPress={handleLogout}
            rightComponent={
              <Ionicons name="chevron-forward" size={20} color={themeColors.text.tertiary} />
            }
          />
          <SettingItem
            label={getLocalizedText('settings.deleteAccount')}
            subtitle="Permanently delete your account"
            onPress={handleDeleteAccount}
            rightComponent={
              <Ionicons name="chevron-forward" size={20} color={themeColors.text.tertiary} />
            }
          />
        </SettingSection>
      </ScrollView>

      {/* Modals */}
      <SelectionModal
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        title={getLocalizedText('settings.theme')}
        subtitle="Choose your theme"
        options={[
          { label: 'Automatic', value: 'auto' },
          { label: getLocalizedText('settings.theme.light'), value: 'light' },
          { label: getLocalizedText('settings.theme.dark'), value: 'dark' },
        ]}
        selectedValue={settings.theme}
        onSelect={(value) => handleSelect('theme', value)}
      />

      <SelectionModal
        visible={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        title={getLocalizedText('settings.language')}
        options={[
          { label: getLocalizedText('settings.language.fr'), value: 'fr' },
          { label: getLocalizedText('settings.language.en'), value: 'en' },
        ]}
        selectedValue={settings.language}
        onSelect={(value) => handleSelect('language', value)}
      />

      <SelectionModal
        visible={showFontSizeModal}
        onClose={() => setShowFontSizeModal(false)}
        title={getLocalizedText('settings.fontSize')}
        options={[
          { label: getLocalizedText('settings.fontSize.small'), value: 'small' },
          { label: getLocalizedText('settings.fontSize.medium'), value: 'medium' },
          { label: getLocalizedText('settings.fontSize.large'), value: 'large' },
        ]}
        selectedValue={settings.fontSize}
        onSelect={(value) => handleSelect('fontSize', value)}
      />

      {selectedPrivacyItem && (
        <SelectionModal
          visible={showPrivacyModal}
          onClose={() => {
            setShowPrivacyModal(false);
            setSelectedPrivacyItem(null);
          }}
          title={selectedPrivacyItem}
          options={[
            { label: 'Everyone', value: 'Everyone' },
            { label: 'Contacts', value: 'Contacts' },
            { label: 'Nobody', value: 'Nobody' },
          ]}
          selectedValue={
            privacySettings[selectedPrivacyItem as keyof typeof privacySettings] as string
          }
          onSelect={(value) => handleSelect('privacy', value)}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontWeight: 'bold',
  },
  sectionContent: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontWeight: '500',
  },
  settingSubtitle: {
    marginTop: 2,
  },
  settingValue: {
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    textAlign: 'center',
    marginBottom: 20,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalOptionText: {
    fontWeight: '500',
  },
  modalCloseButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  modalCloseButtonText: {
    fontWeight: '600',
  },
});

export default SettingsScreen;
