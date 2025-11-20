/**
 * SecurityKeysScreen - Security Keys Management
 * WHISPR-XXX: Implement SecurityKeysScreen with device and key management
 * Note: Using mock data until backend is ready
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
// TODO: Install expo-clipboard: npx expo install expo-clipboard
// Temporary workaround - will be replaced with expo-clipboard
const copyToClipboard = async (text: string) => {
  try {
    // Try to use expo-clipboard if available
    const Clipboard = require('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    // Fallback: log for now, will be implemented with expo-clipboard
    console.log('📋 Copy to clipboard (mock):', text);
    // In production, expo-clipboard will be installed
    return false;
  }
};
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

// Mock data types
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

  // Mock data - will be replaced with API calls later
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

  const [showQRModal, setShowQRModal] = useState(false);
  const [showSecurityCodeModal, setShowSecurityCodeModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<ConnectedDevice | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  const handleDisconnectDevice = (device: ConnectedDevice) => {
    if (device.isCurrent) {
      Alert.alert(
        getLocalizedText('security.cannotDisconnectCurrent'),
        getLocalizedText('security.cannotDisconnectCurrentMessage'),
        [{ text: getLocalizedText('common.ok') }]
      );
      return;
    }

    Alert.alert(
      getLocalizedText('security.disconnectDevice'),
      `${getLocalizedText('security.disconnectDeviceMessage')} ${device.name}?`,
      [
        { text: getLocalizedText('common.cancel'), style: 'cancel' },
        {
          text: getLocalizedText('security.disconnect'),
          style: 'destructive',
          onPress: () => {
            // TODO: API call to disconnect device
            setDevices(prev => prev.filter(d => d.id !== device.id));
            Alert.alert(
              getLocalizedText('notif.success'),
              getLocalizedText('security.deviceDisconnected')
            );
          },
        },
      ]
    );
  };

  const handleShowSecurityCode = (device: ConnectedDevice) => {
    setSelectedDevice(device);
    setShowSecurityCodeModal(true);
  };

  const handleVerifySecurityCode = () => {
    if (verificationCode.length < 6) {
      Alert.alert(
        getLocalizedText('notif.error'),
        getLocalizedText('security.invalidCode')
      );
      return;
    }

    // TODO: API call to verify security code
    Alert.alert(
      getLocalizedText('notif.success'),
      getLocalizedText('security.codeVerified')
    );
    setShowSecurityCodeModal(false);
    setVerificationCode('');
  };

  const handleCopySecurityCode = async (code: string) => {
    const success = await copyToClipboard(code);
    if (success) {
      Alert.alert(
        getLocalizedText('notif.success'),
        getLocalizedText('security.codeCopied')
      );
    } else {
      // Fallback message
      Alert.alert(
        getLocalizedText('security.securityCode'),
        `${getLocalizedText('security.codeCopied')}: ${code}`
      );
    }
  };

  const handleScanQRCode = () => {
    // TODO: Implement QR code scanner
    Alert.alert(
      getLocalizedText('security.scanQRCode'),
      getLocalizedText('security.qrScannerComingSoon')
    );
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return 'phone-portrait-outline';
      case 'tablet':
        return 'tablet-portrait-outline';
      case 'desktop':
        return 'desktop-outline';
      case 'web':
        return 'globe-outline';
      default:
        return 'device-desktop-outline';
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

  const DeviceCard = ({ device }: { device: ConnectedDevice }) => (
    <View
      style={[
        styles.deviceCard,
        { backgroundColor: themeColors.background.secondary },
      ]}
    >
      <View style={styles.deviceCardHeader}>
        <View style={styles.deviceInfo}>
          <Ionicons
            name={getDeviceIcon(device.type) as any}
            size={32}
            color={themeColors.primary}
            style={styles.deviceIcon}
          />
          <View style={styles.deviceDetails}>
            <View style={styles.deviceNameRow}>
              <Text
                style={[
                  styles.deviceName,
                  { color: themeColors.text.primary, fontSize: getFontSize('lg') },
                ]}
              >
                {device.name}
              </Text>
              {device.isCurrent && (
                <View
                  style={[
                    styles.currentBadge,
                    { backgroundColor: themeColors.success },
                  ]}
                >
                  <Text
                    style={[
                      styles.currentBadgeText,
                      { color: '#FFFFFF', fontSize: getFontSize('xs') },
                    ]}
                  >
                    {getLocalizedText('security.currentDevice')}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.deviceMeta,
                { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
              ]}
            >
              {device.lastActive}
              {device.location && ` • ${device.location}`}
            </Text>
          </View>
        </View>
        {!device.isCurrent && (
          <TouchableOpacity
            onPress={() => handleDisconnectDevice(device)}
            style={styles.disconnectButton}
          >
            <Ionicons name="log-out-outline" size={20} color={themeColors.error} />
          </TouchableOpacity>
        )}
      </View>
      {device.securityCode && (
        <TouchableOpacity
          style={[
            styles.securityCodeButton,
            { borderColor: themeColors.primary, borderWidth: 1 },
          ]}
          onPress={() => handleShowSecurityCode(device)}
        >
          <Ionicons name="key-outline" size={16} color={themeColors.primary} />
          <Text
            style={[
              styles.securityCodeText,
              { color: themeColors.primary, fontSize: getFontSize('sm') },
            ]}
          >
            {getLocalizedText('security.viewSecurityCode')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const SecurityKeyCard = ({ securityKey }: { securityKey: SecurityKey }) => (
    <View
      style={[
        styles.keyCard,
        { backgroundColor: themeColors.background.secondary },
      ]}
    >
      <View style={styles.keyHeader}>
        <Ionicons
          name="finger-print-outline"
          size={24}
          color={securityKey.verified ? themeColors.success : themeColors.warning}
        />
        <View style={styles.keyInfo}>
          <Text
            style={[
              styles.keyDeviceName,
              { color: themeColors.text.primary, fontSize: getFontSize('base') },
            ]}
          >
            {securityKey.deviceName}
          </Text>
          <Text
            style={[
              styles.keyFingerprint,
              { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
            ]}
          >
            {securityKey.fingerprint}
          </Text>
          <Text
            style={[
              styles.keyDate,
              { color: themeColors.text.tertiary, fontSize: getFontSize('xs') },
            ]}
          >
            {getLocalizedText('security.createdOn')} {formatDate(securityKey.createdAt)}
          </Text>
        </View>
        {securityKey.verified ? (
          <Ionicons name="checkmark-circle" size={24} color={themeColors.success} />
        ) : (
          <Ionicons name="alert-circle-outline" size={24} color={themeColors.warning} />
        )}
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
            {getLocalizedText('security.title')}
          </Text>
        </View>

        {/* Info Banner */}
        <View
          style={[
            styles.infoBanner,
            { backgroundColor: themeColors.info + '20', borderColor: themeColors.info },
          ]}
        >
          <Ionicons name="information-circle-outline" size={20} color={themeColors.info} />
          <Text
            style={[
              styles.infoText,
              { color: themeColors.text.primary, fontSize: getFontSize('sm') },
            ]}
          >
            {getLocalizedText('security.infoMessage')}
          </Text>
        </View>

        {/* Connected Devices Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="devices-outline"
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
              {getLocalizedText('security.connectedDevices')}
            </Text>
          </View>
          <Text
            style={[
              styles.sectionSubtitle,
              { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
            ]}
          >
            {getLocalizedText('security.connectedDevicesSubtitle')}
          </Text>
          {devices.map(device => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </View>

        {/* Security Keys Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="key-outline"
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
              {getLocalizedText('security.securityKeys')}
            </Text>
          </View>
          <Text
            style={[
              styles.sectionSubtitle,
              { color: themeColors.text.secondary, fontSize: getFontSize('sm') },
            ]}
          >
            {getLocalizedText('security.securityKeysSubtitle')}
          </Text>
          {securityKeys.map(securityKey => (
            <SecurityKeyCard key={securityKey.id} securityKey={securityKey} />
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: themeColors.primary },
            ]}
            onPress={handleScanQRCode}
          >
            <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
            <Text
              style={[
                styles.actionButtonText,
                { color: '#FFFFFF', fontSize: getFontSize('base') },
              ]}
            >
              {getLocalizedText('security.scanQRCode')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Security Code Modal */}
      <Modal
        visible={showSecurityCodeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSecurityCodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: themeColors.background.primary },
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
              <TouchableOpacity onPress={() => setShowSecurityCodeModal(false)}>
                <Ionicons name="close" size={24} color={themeColors.text.primary} />
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
                  { backgroundColor: themeColors.background.secondary },
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
                  style={styles.copyButton}
                >
                  <Ionicons name="copy-outline" size={20} color={themeColors.primary} />
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
                  borderColor: themeColors.primary,
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
              style={[
                styles.verifyButton,
                { backgroundColor: themeColors.primary },
              ]}
              onPress={handleVerifySecurityCode}
            >
              <Text
                style={[
                  styles.verifyButtonText,
                  { color: '#FFFFFF', fontSize: getFontSize('base') },
                ]}
              >
                {getLocalizedText('security.verify')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    marginLeft: 12,
    flex: 1,
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
  sectionSubtitle: {
    marginBottom: 16,
  },
  deviceCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  deviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIcon: {
    marginRight: 12,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceName: {
    fontWeight: '600',
    marginRight: 8,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontWeight: '600',
  },
  deviceMeta: {
    marginTop: 2,
  },
  disconnectButton: {
    padding: 8,
  },
  securityCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  securityCodeText: {
    marginLeft: 8,
    fontWeight: '600',
  },
  keyCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  keyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  keyDeviceName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  keyFingerprint: {
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  keyDate: {
    marginTop: 4,
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    marginLeft: 8,
    fontWeight: '600',
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontWeight: 'bold',
  },
  modalSubtitle: {
    marginBottom: 24,
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  codeText: {
    fontFamily: 'monospace',
    fontWeight: '600',
    flex: 1,
  },
  copyButton: {
    padding: 8,
  },
  verifyLabel: {
    marginBottom: 8,
  },
  codeInput: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 2,
  },
  verifyButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyButtonText: {
    fontWeight: '600',
  },
});

export default SecurityKeysScreen;

