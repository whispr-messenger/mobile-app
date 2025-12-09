/**
 * MyQRCodeScreen - Display personal QR code for contact sharing
 * WHISPR-216: Generate and share personal QR code
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import QRCodeStyled from 'react-native-qrcode-styled';
// Note: react-native-view-shot and expo-media-library will be installed if needed
// For now, using Share API which is native
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { qrCodeService } from '../../services/qrCode/qrCodeService';
import { UserService } from '../../services/UserService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QR_SIZE = Math.min(SCREEN_WIDTH - 64, 280);

export const MyQRCodeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const qrViewRef = useRef<View>(null);

  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{
    firstName: string;
    lastName: string;
    username: string;
  } | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    loadQRCode();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadQRCode = async () => {
    try {
      setLoading(true);
      console.log('[MyQRCode] Loading QR code...');

      // Get current user ID and generate QR code
      const qrData = await qrCodeService.generateMyQRCode();
      if (!qrData) {
        console.error('[MyQRCode] Failed to generate QR code');
        Alert.alert('Erreur', 'Impossible de générer le QR code. Veuillez vous reconnecter.');
        navigation.goBack();
        return;
      }

      setQrCodeData(qrData);
      console.log('[MyQRCode] QR code generated successfully');

      // Load user profile for display
      const userService = UserService.getInstance();
      const profileResult = await userService.getProfile();
      if (profileResult.success && profileResult.profile) {
        setUserProfile({
          firstName: profileResult.profile.firstName,
          lastName: profileResult.profile.lastName,
          username: profileResult.profile.username,
        });
        console.log('[MyQRCode] Profile loaded');
      }
    } catch (error) {
      console.error('[MyQRCode] Error:', error);
      Alert.alert('Erreur', 'Impossible de charger le QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!qrCodeData) return;

    try {
      const result = await Share.share({
        message: `Ajoutez-moi sur Whispr en scannant mon QR code !\n\n${qrCodeData}`,
        title: 'Mon QR code Whispr',
      });

      if (result.action === Share.sharedAction) {
        // Successfully shared
      }
    } catch (error: any) {
      Alert.alert('Erreur', 'Impossible de partager le QR code');
    }
  };

  const handleSaveToGallery = async () => {
    if (!qrCodeData) return;

    try {
      // For now, use Share API to save/share QR code
      // In production, we can use react-native-view-shot + expo-media-library
      await Share.share({
        message: `Mon QR code Whispr:\n${qrCodeData}`,
        title: 'QR code Whispr',
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        Alert.alert('Erreur', 'Impossible de sauvegarder le QR code');
      }
    }
  };

  const displayName = userProfile
    ? `${userProfile.firstName} ${userProfile.lastName}`.trim() || userProfile.username
    : 'Utilisateur';

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
            Mon QR code
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.text.light }]}>
                Génération du QR code...
              </Text>
            </View>
          ) : qrCodeData ? (
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* User Info Card */}
              <View style={styles.userCard}>
                <Text style={[styles.userName, { color: colors.text.light }]}>
                  {displayName}
                </Text>
                {userProfile?.username && (
                  <Text style={[styles.userUsername, { color: colors.text.light, opacity: 0.8 }]}>
                    @{userProfile.username}
                  </Text>
                )}
                <Text style={[styles.userDescription, { color: colors.text.light, opacity: 0.7 }]}>
                  Scannez ce code pour m'ajouter comme contact
                </Text>
              </View>

              {/* QR Code Card */}
              <View style={styles.qrCard}>
                <View style={styles.qrContainer}>
                  <QRCodeStyled
                    data={qrCodeData}
                    size={QR_SIZE - 48}
                    padding={20}
                    pieceSize={6}
                    pieceCornerType="square"
                    isPiecesGlued={false}
                    errorCorrectionLevel="M"
                    color="#000000"
                    backgroundColor="#FFFFFF"
                    outerEyesOptions={{
                      topLeft: { 
                        borderRadius: 8, 
                        stroke: '#000000', 
                        strokeWidth: 2, 
                        color: '#FFFFFF' 
                      },
                      topRight: { 
                        borderRadius: 8, 
                        stroke: '#000000', 
                        strokeWidth: 2, 
                        color: '#FFFFFF' 
                      },
                      bottomLeft: { 
                        borderRadius: 8, 
                        stroke: '#000000', 
                        strokeWidth: 2, 
                        color: '#FFFFFF' 
                      },
                    }}
                    innerEyesOptions={{
                      topLeft: { borderRadius: 4, color: '#000000' },
                      topRight: { borderRadius: 4, color: '#000000' },
                      bottomLeft: { borderRadius: 4, color: '#000000' },
                    }}
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.shareButton]}
                  onPress={handleShare}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-outline" size={20} color={colors.text.light} />
                  <Text style={[styles.actionButtonText, { color: colors.text.light }]}>
                    Partager
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={handleSaveToGallery}
                  activeOpacity={0.8}
                >
                  <Ionicons name="download-outline" size={20} color={colors.text.light} />
                  <Text style={[styles.actionButtonText, { color: colors.text.light }]}>
                    Sauvegarder
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Info Text */}
              <View style={styles.infoContainer}>
                <Ionicons name="information-circle-outline" size={16} color={colors.text.light} style={{ opacity: 0.7 }} />
                <Text style={[styles.infoText, { color: colors.text.light, opacity: 0.7 }]}>
                  Partagez ce QR code avec vos amis pour qu'ils puissent vous ajouter facilement
                </Text>
              </View>
            </Animated.View>
          ) : (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={64} color={colors.ui.error} />
              <Text style={[styles.errorText, { color: colors.text.light }]}>
                Impossible de générer le QR code
              </Text>
            </View>
          )}
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  content: {
    alignItems: 'center',
  },
  userCard: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 16,
    marginBottom: 12,
  },
  userDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
  qrCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  qrContainer: {
    width: QR_SIZE,
    height: QR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  shareButton: {
    backgroundColor: colors.secondary.main,
  },
  saveButton: {
    backgroundColor: colors.primary.main,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});

