/**
 * TwoFactorAuthScreen - WHISPR-167
 * Two-factor authentication management
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Animated,
  Platform,
  Dimensions,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import * as Haptics from 'expo-haptics';
import Toast from '../../components/Toast/Toast';

const copyToClipboard = async (text: string) => {
  try {
    const Clipboard = require('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    console.log('📋 Copy to clipboard (mock):', text);
    return false;
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RecoveryCode {
  id: string;
  code: string;
  used: boolean;
  createdAt: string;
}

export const TwoFactorAuthScreen: React.FC = () => {
  const navigation = useNavigation();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const accentColor = '#9692AC';
  const accentColorDark = '#727596';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [expandedQR, setExpandedQR] = useState(false);
  const [expandedRecoveryCodes, setExpandedRecoveryCodes] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [qrCodeSecret] = useState('JBSWY3DPEHPK3PXP');
  
  const qrOpacity = useRef(new Animated.Value(0)).current;
  const recoveryCodesOpacity = useRef(new Animated.Value(0)).current;
  const qrChevronRotation = useRef(new Animated.Value(0)).current;
  const recoveryCodesChevronRotation = useRef(new Animated.Value(0)).current;
  const [recoveryCodes] = useState<RecoveryCode[]>([
    { id: '1', code: '1234-5678', used: false, createdAt: '2024-01-15T10:30:00Z' },
    { id: '2', code: '2345-6789', used: false, createdAt: '2024-01-15T10:30:00Z' },
    { id: '3', code: '3456-7890', used: false, createdAt: '2024-01-15T10:30:00Z' },
    { id: '4', code: '4567-8901', used: false, createdAt: '2024-01-15T10:30:00Z' },
    { id: '5', code: '5678-9012', used: false, createdAt: '2024-01-15T10:30:00Z' },
    { id: '6', code: '6789-0123', used: false, createdAt: '2024-01-15T10:30:00Z' },
    { id: '7', code: '7890-1234', used: false, createdAt: '2024-01-15T10:30:00Z' },
    { id: '8', code: '8901-2345', used: false, createdAt: '2024-01-15T10:30:00Z' },
  ]);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning' }>({
    visible: false,
    message: '',
    type: 'info',
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (expandedQR) {
      Animated.parallel([
        Animated.timing(qrOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(qrChevronRotation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(qrOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(qrChevronRotation, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [expandedQR]);

  useEffect(() => {
    if (expandedRecoveryCodes) {
      Animated.parallel([
        Animated.timing(recoveryCodesOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(recoveryCodesChevronRotation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(recoveryCodesOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(recoveryCodesChevronRotation, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [expandedRecoveryCodes]);

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' = 'light') => {
    if (Platform.OS === 'ios') {
      try {
        if (type === 'success') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.impactAsync(
            type === 'light' ? Haptics.ImpactFeedbackStyle.Light :
            type === 'medium' ? Haptics.ImpactFeedbackStyle.Medium :
            Haptics.ImpactFeedbackStyle.Heavy
          );
        }
      } catch (error) {
        console.log('⚠️ Haptic feedback error:', error);
      }
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const handleToggle2FA = (value: boolean) => {
    triggerHaptic('light');
    if (value) {
      setTwoFactorEnabled(true);
      setExpandedQR(true);
    } else {
      Alert.alert(
        getLocalizedText('twoFactor.disable'),
        getLocalizedText('twoFactor.disableConfirm'),
        [
          { text: getLocalizedText('common.cancel'), style: 'cancel' },
          {
            text: getLocalizedText('twoFactor.disable'),
            style: 'destructive',
            onPress: () => {
              triggerHaptic('medium');
              setTwoFactorEnabled(false);
              showToast(getLocalizedText('twoFactor.disabled'), 'success');
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleVerifyQRCode = () => {
    if (verificationCode.length < 6) {
      triggerHaptic('heavy');
      showToast(getLocalizedText('twoFactor.invalidCode'), 'error');
      return;
    }

    triggerHaptic('success');
    setVerificationCode('');
    setExpandedQR(false);
    showToast(getLocalizedText('twoFactor.enabled'), 'success');
  };

  const handleCopyRecoveryCode = async (code: string) => {
    triggerHaptic('light');
    const success = await copyToClipboard(code);
    if (success) {
      triggerHaptic('success');
      showToast(getLocalizedText('twoFactor.codeCopied'), 'success');
    } else {
      showToast(`${getLocalizedText('twoFactor.codeCopied')}: ${code}`, 'info');
    }
  };

  const handleScanQRCode = () => {
    triggerHaptic('light');
    Alert.alert(
      '',
      getLocalizedText('twoFactor.qrScannerComingSoon'),
      [{ text: getLocalizedText('common.ok') }],
      { cancelable: true }
    );
  };

  return (
    <LinearGradient
      colors={themeColors.background.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={[
                styles.backButton,
                {
                  backgroundColor: themeColors.background.secondary + '80',
                },
              ]}
              onPress={() => {
                triggerHaptic('light');
                navigation.goBack();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={themeColors.text.primary} />
            </TouchableOpacity>
            <Text
              style={[
                styles.title,
                { color: themeColors.text.primary, fontSize: getFontSize('xxxl') },
              ]}
            >
              {getLocalizedText('twoFactor.title')}
            </Text>
          </View>

          <View
            style={[
              styles.infoBanner,
              {
                backgroundColor: themeColors.background.secondary,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              },
            ]}
          >
            <View
              style={[
                styles.infoIconContainer,
                { backgroundColor: accentColor + '20' },
              ]}
            >
              <Ionicons name="shield-checkmark" size={22} color={accentColor} />
            </View>
            <Text
              style={[
                styles.infoText,
                { color: themeColors.text.primary, fontSize: getFontSize('sm') },
              ]}
            >
              {getLocalizedText('twoFactor.infoMessage')}
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.sectionIconContainer,
                  { backgroundColor: accentColor + '20' },
                ]}
              >
                <Ionicons name="lock-closed" size={20} color={accentColor} />
              </View>
              <View style={styles.sectionTitleContainer}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: themeColors.text.primary, fontSize: getFontSize('lg') },
                  ]}
                >
                  {getLocalizedText('twoFactor.authentication')}
                </Text>
                <Text
                  style={[
                    styles.sectionSubtitle,
                    { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                  ]}
                >
                  {getLocalizedText('twoFactor.authenticationSubtitle')}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.toggleCard,
                {
                  backgroundColor: themeColors.background.secondary,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                },
              ]}
            >
              <View style={styles.toggleContent}>
                <View style={styles.toggleInfo}>
                  <Text
                    style={[
                      styles.toggleTitle,
                      { color: themeColors.text.primary, fontSize: getFontSize('base') },
                    ]}
                  >
                    {getLocalizedText('twoFactor.enable2FA')}
                  </Text>
                  <Text
                    style={[
                      styles.toggleSubtitle,
                      { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                    ]}
                  >
                    {getLocalizedText('twoFactor.enable2FASubtitle')}
                  </Text>
                </View>
                <Switch
                  value={twoFactorEnabled}
                  onValueChange={handleToggle2FA}
                  trackColor={{ false: themeColors.text.tertiary, true: themeColors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {twoFactorEnabled && (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIconContainer,
                      { backgroundColor: accentColor + '20' },
                    ]}
                  >
                    <Ionicons name="qr-code" size={20} color={accentColor} />
                  </View>
                  <View style={styles.sectionTitleContainer}>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: themeColors.text.primary, fontSize: getFontSize('lg') },
                      ]}
                    >
                      {getLocalizedText('twoFactor.qrCode')}
                    </Text>
                    <Text
                      style={[
                        styles.sectionSubtitle,
                        { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                      ]}
                    >
                      {getLocalizedText('twoFactor.qrCodeSubtitle')}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('light');
                    setExpandedQR(!expandedQR);
                    if (expandedRecoveryCodes) setExpandedRecoveryCodes(false);
                  }}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: themeColors.background.secondary,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionCardContent}>
                    <View
                      style={[
                        styles.actionIconContainer,
                        { backgroundColor: accentColor + '20' },
                      ]}
                    >
                      <Ionicons name="qr-code-outline" size={24} color={accentColor} />
                    </View>
                    <View style={styles.actionCardInfo}>
                      <Text
                        style={[
                          styles.actionCardTitle,
                          { color: themeColors.text.primary, fontSize: getFontSize('base') },
                        ]}
                      >
                        {getLocalizedText('twoFactor.viewQRCode')}
                      </Text>
                      <Text
                        style={[
                          styles.actionCardSubtitle,
                          { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                        ]}
                      >
                        {getLocalizedText('twoFactor.viewQRCodeSubtitle')}
                      </Text>
                    </View>
                    <Animated.View
                      style={{
                        transform: [{
                          rotate: qrChevronRotation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '180deg'],
                          }),
                        }],
                      }}
                    >
                      <Ionicons name="chevron-down" size={20} color={themeColors.text.tertiary} />
                    </Animated.View>
                  </View>
                </TouchableOpacity>

                {expandedQR && (
                  <Animated.View
                    style={[
                      styles.expandableContent,
                      {
                        opacity: qrOpacity,
                      },
                    ]}
                  >
                  <View
                    style={[
                      styles.expandableInner,
                      {
                        backgroundColor: themeColors.background.secondary,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.qrCodeContainer,
                        {
                          backgroundColor: themeColors.background.primary,
                          borderColor: accentColor + '30',
                        },
                      ]}
                    >
                      <View style={styles.qrCodePlaceholder}>
                        <Ionicons name="qr-code" size={120} color={accentColor} />
                        <Text
                          style={[
                            styles.qrCodeText,
                            { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                          ]}
                        >
                          {qrCodeSecret}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={handleScanQRCode}
                      activeOpacity={0.8}
                      style={[
                        styles.scanButton,
                        {
                          backgroundColor: themeColors.background.primary,
                          borderColor: accentColor + '40',
                        },
                      ]}
                    >
                      <Ionicons name="camera" size={20} color={accentColor} />
                      <Text
                        style={[
                          styles.scanButtonText,
                          { color: accentColor, fontSize: getFontSize('base') },
                        ]}
                      >
                        {getLocalizedText('twoFactor.scanQRCode')}
                      </Text>
                    </TouchableOpacity>

                    <Text
                      style={[
                        styles.verifyLabel,
                        { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                      ]}
                    >
                      {getLocalizedText('twoFactor.enterVerificationCode')}
                    </Text>
                    <TextInput
                      style={[
                        styles.codeInput,
                        {
                          backgroundColor: themeColors.background.primary,
                          color: themeColors.text.primary,
                          borderColor: accentColor + '40',
                          fontSize: getFontSize('base'),
                        },
                      ]}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      placeholder={getLocalizedText('twoFactor.enterCode')}
                      placeholderTextColor={themeColors.text.tertiary}
                      maxLength={6}
                      keyboardType="number-pad"
                    />

                    <TouchableOpacity
                      onPress={handleVerifyQRCode}
                      activeOpacity={0.9}
                      style={styles.verifyButtonContainer}
                    >
                      <LinearGradient
                        colors={[themeColors.primary, themeColors.primary + 'DD']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.verifyButton,
                          Platform.select({
                            ios: {
                              shadowColor: themeColors.primary,
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.3,
                              shadowRadius: 12,
                            },
                            android: {
                              elevation: 6,
                            },
                          }),
                        ]}
                      >
                        <Text
                          style={[
                            styles.verifyButtonText,
                            { color: '#FFFFFF', fontSize: getFontSize('base') },
                          ]}
                        >
                          {getLocalizedText('twoFactor.verify')}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
                )}
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIconContainer,
                      { backgroundColor: accentColor + '20' },
                    ]}
                  >
                    <Ionicons name="key" size={20} color={accentColor} />
                  </View>
                  <View style={styles.sectionTitleContainer}>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: themeColors.text.primary, fontSize: getFontSize('lg') },
                      ]}
                    >
                      {getLocalizedText('twoFactor.recoveryCodes')}
                    </Text>
                    <Text
                      style={[
                        styles.sectionSubtitle,
                        { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                      ]}
                    >
                      {getLocalizedText('twoFactor.recoveryCodesSubtitle')}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('light');
                    setExpandedRecoveryCodes(!expandedRecoveryCodes);
                    if (expandedQR) setExpandedQR(false);
                  }}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: themeColors.background.secondary,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionCardContent}>
                    <View
                      style={[
                        styles.actionIconContainer,
                        { backgroundColor: accentColor + '20' },
                      ]}
                    >
                      <Ionicons name="key-outline" size={24} color={accentColor} />
                    </View>
                    <View style={styles.actionCardInfo}>
                      <Text
                        style={[
                          styles.actionCardTitle,
                          { color: themeColors.text.primary, fontSize: getFontSize('base') },
                        ]}
                      >
                        {getLocalizedText('twoFactor.viewRecoveryCodes')}
                      </Text>
                      <Text
                        style={[
                          styles.actionCardSubtitle,
                          { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                        ]}
                      >
                        {getLocalizedText('twoFactor.viewRecoveryCodesSubtitle')}
                      </Text>
                    </View>
                    <Animated.View
                      style={{
                        transform: [{
                          rotate: recoveryCodesChevronRotation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '180deg'],
                          }),
                        }],
                      }}
                    >
                      <Ionicons name="chevron-down" size={20} color={themeColors.text.tertiary} />
                    </Animated.View>
                  </View>
                </TouchableOpacity>

                {expandedRecoveryCodes && (
                  <Animated.View
                    style={[
                      styles.expandableContent,
                      {
                        opacity: recoveryCodesOpacity,
                      },
                    ]}
                  >
                  <View
                    style={[
                      styles.expandableInner,
                      {
                        backgroundColor: themeColors.background.secondary,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.recoveryCodesInfo,
                        { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                      ]}
                    >
                      {getLocalizedText('twoFactor.recoveryCodesInfo')}
                    </Text>

                    <View style={styles.recoveryCodesGrid}>
                      {recoveryCodes.map((recoveryCode, index) => (
                        <View
                          key={recoveryCode.id}
                          style={[
                            styles.recoveryCodeCard,
                            {
                              backgroundColor: themeColors.background.primary,
                              borderColor: recoveryCode.used 
                                ? themeColors.text.tertiary + '30' 
                                : accentColor + '30',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.recoveryCodeText,
                              {
                                color: recoveryCode.used 
                                  ? themeColors.text.tertiary 
                                  : themeColors.text.primary,
                                fontSize: getFontSize('base'),
                                textDecorationLine: recoveryCode.used ? 'line-through' : 'none',
                              },
                            ]}
                          >
                            {recoveryCode.code}
                          </Text>
                          {!recoveryCode.used && (
                            <TouchableOpacity
                              onPress={() => handleCopyRecoveryCode(recoveryCode.code)}
                              style={[
                                styles.copyCodeButton,
                                { backgroundColor: accentColor + '20' },
                              ]}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="copy" size={16} color={accentColor} />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                </Animated.View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={3000}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedContainer: {
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
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  title: {
    fontWeight: 'bold',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 32,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    lineHeight: 20,
  },
  section: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    lineHeight: 18,
  },
  toggleCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontWeight: '500',
    marginBottom: 4,
  },
  toggleSubtitle: {
    lineHeight: 18,
  },
  actionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionCardInfo: {
    flex: 1,
  },
  actionCardTitle: {
    fontWeight: '500',
    marginBottom: 4,
  },
  actionCardSubtitle: {
    lineHeight: 18,
  },
  expandableContent: {
    overflow: 'hidden',
  },
  expandableInner: {
    padding: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  qrCodePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodeText: {
    marginTop: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 8,
  },
  scanButtonText: {
    fontWeight: '600',
  },
  verifyLabel: {
    marginBottom: 12,
    fontWeight: '500',
  },
  codeInput: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    letterSpacing: 3,
    fontWeight: '600',
  },
  verifyButtonContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  verifyButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  recoveryCodesInfo: {
    marginBottom: 20,
    lineHeight: 20,
    textAlign: 'center',
  },
  recoveryCodesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recoveryCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    width: (SCREEN_WIDTH - 80) / 2,
    minWidth: 140,
  },
  recoveryCodeText: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  copyCodeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});

export default TwoFactorAuthScreen;

