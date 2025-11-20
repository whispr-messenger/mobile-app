/**
 * SecurityKeysScreen - WHISPR-134
 * Security keys and connected devices management
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

interface ConnectedDevice {
  id: string;
  name: string;
  type: 'mobile' | 'tablet' | 'desktop' | 'web';
  lastActive: string;
  location?: string;
  isCurrent: boolean;
  securityCode?: string;
}

interface SecurityKey {
  id: string;
  deviceId: string;
  deviceName: string;
  fingerprint: string;
  createdAt: string;
  verified: boolean;
}

export const SecurityKeysScreen: React.FC = () => {
  const navigation = useNavigation();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const accentColor = '#9692AC';
  const accentColorDark = '#727596';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const modalScale = useRef(new Animated.Value(0.9)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  const [devices, setDevices] = useState<ConnectedDevice[]>([
    {
      id: '1',
      name: 'iPhone 15 Pro',
      type: 'mobile',
      lastActive: 'Maintenant',
      location: 'Paris, France',
      isCurrent: true,
    },
    {
      id: '2',
      name: 'MacBook Pro',
      type: 'desktop',
      lastActive: 'Il y a 2 heures',
      location: 'Paris, France',
      isCurrent: false,
      securityCode: 'ABC123-DEF456-GHI789',
    },
    {
      id: '3',
      name: 'iPad Air',
      type: 'tablet',
      lastActive: 'Il y a 3 jours',
      location: 'Lyon, France',
      isCurrent: false,
      securityCode: 'XYZ789-UVW456-RST123',
    },
  ]);

  const [securityKeys, setSecurityKeys] = useState<SecurityKey[]>([
    {
      id: '1',
      deviceId: '1',
      deviceName: 'iPhone 15 Pro',
      fingerprint: 'A1B2C3D4E5F6G7H8',
      createdAt: '2024-01-15T10:30:00Z',
      verified: true,
    },
    {
      id: '2',
      deviceId: '2',
      deviceName: 'MacBook Pro',
      fingerprint: 'I9J0K1L2M3N4O5P6',
      createdAt: '2024-01-10T14:20:00Z',
      verified: true,
    },
  ]);

  const [showSecurityCodeModal, setShowSecurityCodeModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<ConnectedDevice | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [showSecurityKeys, setShowSecurityKeys] = useState(false);
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
    if (showSecurityCodeModal) {
      Animated.parallel([
        Animated.spring(modalScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(modalScale, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showSecurityCodeModal]);

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (Platform.OS === 'ios') {
      try {
        Haptics.impactAsync(
          type === 'light' ? Haptics.ImpactFeedbackStyle.Light :
          type === 'medium' ? Haptics.ImpactFeedbackStyle.Medium :
          Haptics.ImpactFeedbackStyle.Heavy
        );
      } catch (error) {
        console.log('⚠️ Haptic feedback error:', error);
      }
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const handleDisconnectDevice = (device: ConnectedDevice) => {
    if (device.isCurrent) {
      triggerHaptic('medium');
      showToast(getLocalizedText('security.cannotDisconnectCurrentMessage'), 'warning');
      return;
    }

    triggerHaptic('light');
    Alert.alert(
      getLocalizedText('security.disconnectDevice'),
      `${getLocalizedText('security.disconnectDeviceMessage')} ${device.name}?`,
      [
        { text: getLocalizedText('common.cancel'), style: 'cancel' },
        {
          text: getLocalizedText('security.disconnect'),
          style: 'destructive',
          onPress: () => {
            triggerHaptic('medium');
            setDevices(prev => prev.filter(d => d.id !== device.id));
            showToast(getLocalizedText('security.deviceDisconnected'), 'success');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleShowSecurityCode = (device: ConnectedDevice) => {
    triggerHaptic('light');
    setSelectedDevice(device);
    setShowSecurityCodeModal(true);
  };

  const handleVerifySecurityCode = () => {
    if (verificationCode.length < 6) {
      triggerHaptic('heavy');
      showToast(getLocalizedText('security.invalidCode'), 'error');
      return;
    }

    triggerHaptic('success');
    showToast(getLocalizedText('security.codeVerified'), 'success');
    setShowSecurityCodeModal(false);
    setVerificationCode('');
  };

  const handleCopySecurityCode = async (code: string) => {
    triggerHaptic('light');
    const success = await copyToClipboard(code);
    if (success) {
      triggerHaptic('success');
      showToast(getLocalizedText('security.codeCopied'), 'success');
    } else {
      showToast(`${getLocalizedText('security.codeCopied')}: ${code}`, 'info');
    }
  };

  const handleScanQRCode = () => {
    triggerHaptic('light');
    Alert.alert(
      '',
      getLocalizedText('security.qrScannerComingSoon'),
      [{ text: getLocalizedText('common.ok') }],
      { cancelable: true }
    );
  };

  const getDeviceIcon = (type: string): { name: any; color: string } => {
    const iconColor = accentColor;
    switch (type) {
      case 'mobile':
        return { name: 'phone-portrait', color: iconColor };
      case 'tablet':
        return { name: 'tablet-portrait', color: iconColor };
      case 'desktop':
        return { name: 'laptop', color: iconColor };
      case 'web':
        return { name: 'globe', color: iconColor };
      default:
        return { name: 'device-desktop', color: iconColor };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const DeviceCard = ({ device, index }: { device: ConnectedDevice; index: number }) => {
    const cardScale = useRef(new Animated.Value(1)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.sequence([
        Animated.delay(index * 100),
        Animated.parallel([
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(cardScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, []);

    const handlePressIn = () => {
      Animated.spring(cardScale, {
        toValue: 0.98,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start();
    };

    const deviceIcon = getDeviceIcon(device.type);

    return (
      <Animated.View
        style={[
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.deviceCard,
            {
              backgroundColor: themeColors.background.secondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: 'rgba(255, 255, 255, 0.1)',
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                },
                android: {
                  elevation: 2,
                },
              }),
            },
          ]}
        >
          <View style={styles.deviceCardHeader}>
            <View style={styles.deviceInfo}>
              <View
                style={[
                  styles.deviceIconContainer,
                  {
                    backgroundColor: deviceIcon.color + '15',
                  },
                ]}
              >
                <Ionicons
                  name={deviceIcon.name as any}
                  size={28}
                  color={deviceIcon.color}
                />
              </View>
              <View style={styles.deviceDetails}>
                <View style={styles.deviceNameRow}>
                  <Text
                    style={[
                      styles.deviceName,
                      { color: themeColors.text.primary, fontSize: getFontSize('base') },
                    ]}
                  >
                    {device.name}
                  </Text>
                  {device.isCurrent && (
                    <LinearGradient
                      colors={[accentColor, accentColorDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.currentBadge}
                    >
                      <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
                      <Text
                        style={[
                          styles.currentBadgeText,
                          { color: '#FFFFFF', fontSize: getFontSize('xs') },
                        ]}
                      >
                        {getLocalizedText('security.currentDevice')}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
                <View style={styles.deviceMetaRow}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={themeColors.text.tertiary}
                  />
                  <Text
                    style={[
                      styles.deviceMeta,
                      { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                    ]}
                  >
                    {device.lastActive}
                  </Text>
                  {device.location && (
                    <>
                      <Text style={[styles.deviceMetaSeparator, { color: themeColors.text.tertiary }]}>
                        •
                      </Text>
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color={themeColors.text.tertiary}
                      />
                      <Text
                        style={[
                          styles.deviceMeta,
                          { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                        ]}
                      >
                        {device.location}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </View>
            {!device.isCurrent && (
              <TouchableOpacity
                onPress={() => handleDisconnectDevice(device)}
                style={[
                  styles.disconnectButton,
                  {
                    backgroundColor: themeColors.text.tertiary + '20',
                  },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={20} color={themeColors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
          {device.securityCode && (
            <TouchableOpacity
              style={[
                styles.securityCodeButton,
                {
                  borderColor: accentColor + '40',
                  backgroundColor: accentColor + '08',
                },
              ]}
              onPress={() => handleShowSecurityCode(device)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[accentColor + '20', accentColor + '10']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.securityCodeButtonGradient}
              >
                <Ionicons name="key" size={18} color={accentColor} />
                <Text
                  style={[
                    styles.securityCodeText,
                    { color: accentColor, fontSize: getFontSize('sm') },
                  ]}
                >
                  {getLocalizedText('security.viewSecurityCode')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const SecurityKeyCard = ({ securityKey, index }: { securityKey: SecurityKey; index: number }) => {
    const cardScale = useRef(new Animated.Value(1)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.sequence([
        Animated.delay((devices.length + index) * 100),
        Animated.parallel([
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(cardScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, []);

    return (
      <Animated.View
        style={[
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        <View
          style={[
            styles.keyCard,
            {
              backgroundColor: themeColors.background.secondary,
              borderLeftWidth: 4,
              borderLeftColor: securityKey.verified ? accentColor : themeColors.warning,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: 'rgba(255, 255, 255, 0.1)',
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                },
                android: {
                  elevation: 2,
                },
              }),
            },
          ]}
        >
          <View style={styles.keyHeader}>
            <View
              style={[
                styles.keyIconContainer,
                {
                  backgroundColor: (securityKey.verified ? accentColor : themeColors.warning) + '20',
                },
              ]}
            >
              <Ionicons
                name="finger-print"
                size={24}
                color={securityKey.verified ? accentColor : themeColors.warning}
              />
            </View>
            <View style={styles.keyInfo}>
              <View style={styles.keyDeviceNameRow}>
                <Text
                  style={[
                    styles.keyDeviceName,
                    { color: themeColors.text.primary, fontSize: getFontSize('base') },
                  ]}
                >
                  {securityKey.deviceName}
                </Text>
                {securityKey.verified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={accentColor}
                    style={styles.verifiedIcon}
                  />
                )}
              </View>
              <View style={styles.fingerprintContainer}>
                <Text
                  style={[
                    styles.keyFingerprint,
                    { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                  ]}
                >
                  {securityKey.fingerprint}
                </Text>
                <TouchableOpacity
                  onPress={() => handleCopySecurityCode(securityKey.fingerprint)}
                  style={styles.copyFingerprintButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="copy-outline" size={16} color={themeColors.text.tertiary} />
                </TouchableOpacity>
              </View>
              <View style={styles.keyDateRow}>
                <Ionicons name="calendar-outline" size={12} color={themeColors.text.tertiary} />
                <Text
                  style={[
                    styles.keyDate,
                    { color: themeColors.text.tertiary, fontSize: getFontSize('xs') },
                  ]}
                >
                  {getLocalizedText('security.createdOn')} {formatDate(securityKey.createdAt)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
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
              {getLocalizedText('security.title')}
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
              <Ionicons name="information-circle" size={22} color={accentColor} />
            </View>
            <Text
              style={[
                styles.infoText,
                { color: themeColors.text.primary, fontSize: getFontSize('sm') },
              ]}
            >
              {getLocalizedText('security.infoMessage')}
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
              <Ionicons
                name="phone-portrait-outline"
                size={20}
                color={accentColor}
              />
            </View>
              <View style={styles.sectionTitleContainer}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: themeColors.text.primary, fontSize: getFontSize('lg') },
                  ]}
                >
                  {getLocalizedText('security.connectedDevices')}
                </Text>
                <Text
                  style={[
                    styles.sectionSubtitle,
                    { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                  ]}
                >
                  {getLocalizedText('security.connectedDevicesSubtitle')}
                </Text>
              </View>
            </View>
            {devices.map((device, index) => (
              <DeviceCard key={device.id} device={device} index={index} />
            ))}
          </View>

          <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconContainer,
                { backgroundColor: accentColor + '20' },
              ]}
            >
              <Ionicons
                name="key"
                size={20}
                color={accentColor}
              />
            </View>
              <View style={styles.sectionTitleContainer}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: themeColors.text.primary, fontSize: getFontSize('lg') },
                  ]}
                >
                  {getLocalizedText('security.securityKeys')}
                </Text>
                <Text
                  style={[
                    styles.sectionSubtitle,
                    { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
                  ]}
                >
                  {getLocalizedText('security.securityKeysSubtitle')}
                </Text>
              </View>
            </View>
            {!showSecurityKeys ? (
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  setShowSecurityKeys(true);
                }}
                style={[
                  styles.showKeysButton,
                  {
                    backgroundColor: accentColor + '15',
                    borderColor: accentColor + '40',
                  },
                ]}
                activeOpacity={0.8}
              >
                <Ionicons name="eye-outline" size={18} color={accentColor} />
                <Text
                  style={[
                    styles.showKeysButtonText,
                    { color: accentColor, fontSize: getFontSize('base') },
                  ]}
                >
                  {getLocalizedText('security.showSecurityKeys')}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('light');
                    setShowSecurityKeys(false);
                  }}
                  style={[
                    styles.hideKeysButton,
                    {
                      backgroundColor: themeColors.text.tertiary + '15',
                      borderColor: themeColors.text.tertiary + '30',
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="eye-off-outline" size={18} color={themeColors.text.secondary} />
                  <Text
                    style={[
                      styles.hideKeysButtonText,
                      { color: themeColors.text.secondary, fontSize: getFontSize('base') },
                    ]}
                  >
                    {getLocalizedText('security.hideSecurityKeys')}
                  </Text>
                </TouchableOpacity>
                {securityKeys.map((securityKey, index) => (
                  <SecurityKeyCard key={securityKey.id} securityKey={securityKey} index={index} />
                ))}
              </>
            )}
          </View>

          <View style={styles.actionsSection}>
            <TouchableOpacity
              onPress={handleScanQRCode}
              activeOpacity={0.9}
              style={styles.actionButtonContainer}
            >
              <LinearGradient
                colors={[themeColors.primary, themeColors.primary + 'DD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.actionButton,
                  Platform.select({
                    ios: {
                      shadowColor: themeColors.primary,
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.3,
                      shadowRadius: 16,
                    },
                    android: {
                      elevation: 8,
                    },
                  }),
                ]}
              >
                <Ionicons name="qr-code" size={22} color="#FFFFFF" />
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: '#FFFFFF', fontSize: getFontSize('base') },
                  ]}
                >
                  {getLocalizedText('security.scanQRCode')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>

      <Modal
        visible={showSecurityCodeModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowSecurityCodeModal(false)}
      >
        <Animated.View
          style={[
            styles.modalOverlay,
            {
              opacity: modalOpacity,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowSecurityCodeModal(false)}
          />
          <Animated.View
            style={[
              styles.modalContent,
              {
                backgroundColor: themeColors.background.primary,
                transform: [{ scale: modalScale }],
                ...Platform.select({
                  ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 20,
                  },
                  android: {
                    elevation: 24,
                  },
                }),
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: themeColors.text.primary, fontSize: getFontSize('xl') },
                ]}
              >
                {getLocalizedText('security.securityCode')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowSecurityCodeModal(false)}
                style={[
                  styles.modalCloseButton,
                  { backgroundColor: themeColors.background.secondary },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={themeColors.text.primary} />
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.modalSubtitle,
                { color: themeColors.text.secondary, fontSize: getFontSize('base') },
              ]}
            >
              {selectedDevice?.name}
            </Text>

            {selectedDevice?.securityCode && (
              <View
                style={[
                  styles.codeContainer,
                  {
                    backgroundColor: themeColors.background.secondary,
                    borderColor: themeColors.primary + '30',
                    ...Platform.select({
                      ios: {
                        shadowColor: themeColors.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                      },
                      android: {
                        elevation: 4,
                      },
                    }),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.codeText,
                    { color: themeColors.text.primary, fontSize: getFontSize('lg') },
                  ]}
                >
                  {selectedDevice.securityCode}
                </Text>
                <TouchableOpacity
                  onPress={() => handleCopySecurityCode(selectedDevice.securityCode!)}
                  style={[
                    styles.copyButton,
                    { backgroundColor: themeColors.primary + '20' },
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="copy" size={20} color={themeColors.primary} />
                </TouchableOpacity>
              </View>
            )}

            <Text
              style={[
                styles.verifyLabel,
                { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
              ]}
            >
              {getLocalizedText('security.verifyCode')}
            </Text>
            <TextInput
              style={[
                styles.codeInput,
                {
                  backgroundColor: themeColors.background.secondary,
                  color: themeColors.text.primary,
                  borderColor: themeColors.primary + '40',
                  fontSize: getFontSize('base'),
                },
              ]}
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder={getLocalizedText('security.enterCode')}
              placeholderTextColor={themeColors.text.tertiary}
              maxLength={6}
              keyboardType="default"
              autoCapitalize="characters"
            />

            <TouchableOpacity
              onPress={handleVerifySecurityCode}
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
                  {getLocalizedText('security.verify')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

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
  deviceCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  deviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  deviceName: {
    fontWeight: '500',
    marginRight: 8,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  currentBadgeText: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  deviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceMeta: {
    marginLeft: 2,
  },
  deviceMetaSeparator: {
    marginHorizontal: 4,
  },
  disconnectButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginTop: 2,
  },
  securityCodeButton: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  securityCodeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  securityCodeText: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  keyCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  keyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  keyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  keyInfo: {
    flex: 1,
  },
  keyDeviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  keyDeviceName: {
    fontWeight: '500',
  },
  verifiedIcon: {
    marginLeft: 8,
  },
  fingerprintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
  },
  keyFingerprint: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
    letterSpacing: 1,
  },
  copyFingerprintButton: {
    padding: 4,
    marginLeft: 8,
  },
  keyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  keyDate: {
    marginLeft: 4,
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginTop: 40,
    marginBottom: 40,
  },
  actionButtonContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 10,
  },
  actionButtonText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    flex: 1,
    letterSpacing: 2,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
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
  showKeysButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
  },
  showKeysButtonText: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  hideKeysButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  hideKeysButtonText: {
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});

export default SecurityKeysScreen;
