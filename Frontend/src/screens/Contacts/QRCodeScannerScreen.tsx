/**
 * QRCodeScannerScreen - Scan QR code to add contact
 * WHISPR-215: Scan QR code for automatic contact addition
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { qrCodeService } from '../../services/qrCode/qrCodeService';
import { contactsAPI } from '../../services/contacts/api';
import { Avatar } from '../Chat/Avatar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_AREA_SIZE = Math.min(SCREEN_WIDTH - 64, 280);

export const QRCodeScannerScreen: React.FC = () => {
  const navigation = useNavigation();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatarUrl?: string;
  } | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (permission?.granted) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Animate scan line
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [permission?.granted]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);
    console.log('[QRScanner] QR code scanned');

    try {
      // Parse QR code data
      const qrData = qrCodeService.parseQRCodeData(data);
      if (!qrData || qrData.type !== 'contact') {
        console.warn('[QRScanner] Invalid QR code format');
        Alert.alert(
          'QR code invalide',
          'Ce QR code n\'est pas un code de contact Whispr.',
          [
            {
              text: 'Réessayer',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
          ],
        );
        return;
      }

      console.log('[QRScanner] Valid contact QR code, userId:', qrData.userId);

      const userId = qrData.userId;

      // Check if scanning own QR code
      const currentUserId = await qrCodeService.getCurrentUserId();
      if (userId === currentUserId) {
        console.warn('[QRScanner] Attempted to scan own QR code');
        Alert.alert(
          'QR code personnel',
          'Vous ne pouvez pas vous ajouter vous-même comme contact.',
          [
            {
              text: 'OK',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
          ],
        );
        return;
      }

      // Search for user to get profile info
      console.log('[QRScanner] Searching for user:', userId);
      try {
        // Try to find user by ID in mock store (temporary solution)
        // In production, this would be a direct API call GET /api/v1/users/{userId}
        const searchResults = await contactsAPI.searchUsers({ username: '' });
        
        // Find user by ID in results (mock implementation)
        const userResult = searchResults.find(r => r.user.id === userId);
        
        if (!userResult) {
          console.warn('[QRScanner] User not found:', userId);
          Alert.alert(
            'Utilisateur introuvable',
            'Cet utilisateur n\'existe pas ou n\'est pas disponible.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setScanned(false);
                  setProcessing(false);
                },
              },
            ],
          );
          return;
        }

        console.log('[QRScanner] User found:', userResult.user.username);

        setUserProfile({
          id: userResult.user.id,
          firstName: userResult.user.first_name || '',
          lastName: userResult.user.last_name || '',
          username: userResult.user.username,
          avatarUrl: userResult.user.avatar_url,
        });

        // Check if already a contact or blocked
        if (userResult.is_blocked) {
          Alert.alert(
            'Contact bloqué',
            'Cet utilisateur est bloqué. Vous ne pouvez pas l\'ajouter comme contact.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setScanned(false);
                  setProcessing(false);
                  setUserProfile(null);
                },
              },
            ],
          );
          return;
        }

        // Show confirmation dialog
        const displayName = userResult.user.first_name
          ? `${userResult.user.first_name} ${userResult.user.last_name || ''}`.trim()
          : userResult.user.username;

        Alert.alert(
          'Ajouter le contact',
          `Voulez-vous ajouter ${displayName} (@${userResult.user.username}) à vos contacts ?`,
          [
            {
              text: 'Annuler',
              style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
                setUserProfile(null);
              },
            },
            {
              text: 'Ajouter',
              onPress: async () => {
                try {
                  console.log('[QRScanner] Adding contact:', userId);
                  await contactsAPI.addContact({ contactId: userId });
                  console.log('[QRScanner] Contact added successfully');
                  Alert.alert('Succès', 'Contact ajouté avec succès', [
                    {
                      text: 'OK',
                      onPress: () => {
                        if (navigation && navigation.goBack) {
                          navigation.goBack();
                        }
                      },
                    },
                  ]);
                } catch (error: any) {
                  console.error('[QRScanner] Error adding contact:', error);
                  Alert.alert(
                    'Erreur',
                    error.message || 'Impossible d\'ajouter ce contact',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          setScanned(false);
                          setProcessing(false);
                          setUserProfile(null);
                        },
                      },
                    ],
                  );
                }
              },
            },
          ],
        );
      } catch (error: any) {
        console.error('[QRCodeScannerScreen] Error searching user:', error);
        Alert.alert(
          'Erreur',
          'Impossible de récupérer les informations de l\'utilisateur.',
          [
            {
              text: 'Réessayer',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
          ],
        );
      }
    } catch (error) {
      console.error('[QRCodeScannerScreen] Error processing QR code:', error);
      Alert.alert('Erreur', 'Impossible de traiter le QR code', [
        {
          text: 'Réessayer',
          onPress: () => {
            setScanned(false);
            setProcessing(false);
          },
        },
      ]);
    }
  };

  if (!permission) {
    return (
      <LinearGradient
        colors={colors.background.gradient.app}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.permissionContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={[styles.permissionText, { color: colors.text.light }]}>
              Vérification des permissions...
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient
        colors={colors.background.gradient.app}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.container} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={themeColors.text.primary || colors.text.light}
              />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: themeColors.text.primary || colors.text.light }]}>
              Scanner QR code
            </Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color={colors.text.light} style={{ opacity: 0.7 }} />
            <Text style={[styles.permissionTitle, { color: colors.text.light }]}>
              Accès à la caméra requis
            </Text>
            <Text style={[styles.permissionText, { color: colors.text.light, opacity: 0.8 }]}>
              Pour scanner un QR code, Whispr a besoin d'accéder à votre caméra.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionButtonText}>Autoriser l'accès</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={themeColors.text.primary || colors.text.light}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text.primary || colors.text.light }]}>
            Scanner QR code
          </Text>
          <View style={styles.placeholder} />
        </View>

        {/* Camera View */}
        <Animated.View style={[styles.cameraContainer, { opacity: fadeAnim }]}>
          <CameraView
            style={styles.camera}
            facing={CameraType.back}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          >
            {/* Overlay */}
            <View style={styles.overlay}>
              {/* Top overlay */}
              <View style={styles.overlayTop} />

              {/* Middle section with scan area */}
              <View style={styles.overlayMiddle}>
                <View style={styles.overlaySide} />
                <View style={styles.scanArea}>
                  {/* Corner indicators */}
                  <View style={[styles.corner, styles.cornerTopLeft]} />
                  <View style={[styles.corner, styles.cornerTopRight]} />
                  <View style={[styles.corner, styles.cornerBottomLeft]} />
                  <View style={[styles.corner, styles.cornerBottomRight]} />

                  {/* Animated scan line */}
                  {!scanned && (
                    <Animated.View
                      style={[
                        styles.scanLine,
                        {
                          transform: [
                            {
                              translateY: scanLineAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, SCAN_AREA_SIZE - 2],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.overlaySide} />
              </View>

              {/* Bottom overlay */}
              <View style={styles.overlayBottom}>
                <Text style={styles.instructionText}>
                  Positionnez le QR code dans le cadre
                </Text>
                {processing && (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator size="small" color={colors.primary.main} />
                    <Text style={styles.processingText}>Traitement...</Text>
                  </View>
                )}
              </View>
            </View>
          </CameraView>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 10,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: SCAN_AREA_SIZE + 32,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    marginVertical: 16,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.primary.main,
    borderWidth: 3,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary.main,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  instructionText: {
    color: colors.text.light,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingText: {
    color: colors.text.light,
    fontSize: 14,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: colors.text.light,
    fontSize: 16,
    fontWeight: '600',
  },
});

