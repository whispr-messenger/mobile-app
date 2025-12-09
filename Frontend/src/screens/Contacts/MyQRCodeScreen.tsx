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
import { Circle, Path } from 'react-native-svg';
// Note: react-native-view-shot and expo-media-library will be installed if needed
// For now, using Share API which is native
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { qrCodeService } from '../../services/qrCode/qrCodeService';
import { UserService } from '../../services/UserService';
import { useMemo, useCallback } from 'react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QR_SIZE = Math.min(SCREEN_WIDTH - 64, 280);

// Shape path builders
const buildStarPath = (cx: number, cy: number, r: number) =>
  `
    M ${cx} ${cy - r}
    L ${cx + r * 0.35} ${cy - r * 0.25}
    L ${cx + r} ${cy - r * 0.15}
    L ${cx + r * 0.4} ${cy + r * 0.1}
    L ${cx + r * 0.65} ${cy + r}
    L ${cx} ${cy + r * 0.45}
    L ${cx - r * 0.65} ${cy + r}
    L ${cx - r * 0.4} ${cy + r * 0.1}
    L ${cx - r} ${cy - r * 0.15}
    L ${cx - r * 0.35} ${cy - r * 0.25}
    Z
  `;

const buildSparkPath = (cx: number, cy: number, r: number) =>
  `
    M ${cx - r} ${cy - r * 0.2}
    L ${cx - r * 0.2} ${cy - r}
    L ${cx + r * 0.2} ${cy - r}
    L ${cx + r} ${cy - r * 0.2}
    L ${cx + r} ${cy + r * 0.2}
    L ${cx + r * 0.2} ${cy + r}
    L ${cx - r * 0.2} ${cy + r}
    L ${cx - r} ${cy + r * 0.2}
    Z
  `;

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
  const buttonShareAnim = useRef(new Animated.Value(1)).current;
  const buttonSaveAnim = useRef(new Animated.Value(1)).current;
  const qrPulseAnim = useRef(new Animated.Value(1)).current;

  // QR code styling
  const qrGradientColors = useMemo(() => [colors.primary.main, colors.secondary.main], []);
  const qrShapes = useMemo(() => ['star', 'spark', 'diamond', 'dot'], []);

  const renderStylizedPiece = useCallback(
    ({ x, y, pieceSize, bitMatrix }: { x: number; y: number; pieceSize: number; bitMatrix: number[][] }) => {
      if (!bitMatrix[y] || bitMatrix[y][x] === 0) {
        return null;
      }
      const shape = qrShapes[(x + y) % qrShapes.length];
      const size = pieceSize * 0.92;
      const cx = x * pieceSize + pieceSize / 2;
      const cy = y * pieceSize + pieceSize / 2;
      const r = size / 2;
      const fill = 'url(#gradient)';

      const key = `${x}-${y}`;

      switch (shape) {
        case 'diamond':
          return (
            <Path
              key={key}
              d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
              fill={fill}
            />
          );
        case 'spark':
          return <Path key={key} d={buildSparkPath(cx, cy, r)} fill={fill} />;
        case 'dot':
          return <Circle key={key} cx={cx} cy={cy} r={r} fill={fill} />;
        case 'star':
        default:
          return <Path key={key} d={buildStarPath(cx, cy, r)} fill={fill} />;
      }
    },
    [qrShapes]
  );

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

    // QR code pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(qrPulseAnim, {
          toValue: 1.02,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(qrPulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
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

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonShareAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonShareAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

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

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonSaveAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonSaveAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

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
              <Animated.View
                style={[
                  styles.qrCard,
                  {
                    transform: [{ scale: qrPulseAnim }],
                  },
                ]}
              >
                <LinearGradient
                  colors={['#FFF3F0', '#FDDDEA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.qrGradientContainer}
                >
                  <View style={styles.qrContainer}>
                    <QRCodeStyled
                      data={qrCodeData}
                      size={QR_SIZE - 48}
                      padding={20}
                      pieceSize={8}
                      pieceCornerType="rounded"
                      pieceBorderRadius={60}
                      pieceLiquidRadius={50}
                      pieceScale={1.05}
                      isPiecesGlued={true}
                      errorCorrectionLevel="M"
                      gradient={{
                        type: 'linear',
                        options: {
                          colors: qrGradientColors,
                          start: [0, 0],
                          end: [1, 1],
                        },
                      }}
                      outerEyesOptions={{
                        topLeft: { 
                          borderRadius: 24, 
                          stroke: '#1D112F', 
                          strokeWidth: 4, 
                          color: '#FDF3EA' 
                        },
                        topRight: { 
                          borderRadius: 24, 
                          stroke: '#1D112F', 
                          strokeWidth: 4, 
                          color: '#FDF3EA' 
                        },
                        bottomLeft: { 
                          borderRadius: 24, 
                          stroke: '#1D112F', 
                          strokeWidth: 4, 
                          color: '#FDF3EA' 
                        },
                      }}
                      innerEyesOptions={{
                        topLeft: { borderRadius: 18, color: '#2D1935' },
                        topRight: { borderRadius: 18, color: '#2D1935' },
                        bottomLeft: { borderRadius: 18, color: '#2D1935' },
                      }}
                      color={colors.primary.main}
                      renderCustomPieceItem={renderStylizedPiece}
                    />
                  </View>
                </LinearGradient>
              </Animated.View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                <Animated.View
                  style={{
                    flex: 1,
                    transform: [{ scale: buttonShareAnim }],
                  }}
                >
                  <TouchableOpacity
                    onPress={handleShare}
                    activeOpacity={0.85}
                    style={styles.shareButtonContainer}
                  >
                    <LinearGradient
                      colors={[colors.secondary.medium, colors.secondary.dark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.actionButton, styles.shareButton]}
                    >
                      <Ionicons name="share-outline" size={22} color={colors.text.light} />
                      <Text style={[styles.actionButtonText, { color: colors.text.light }]}>
                        Partager
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>

                <Animated.View
                  style={{
                    flex: 1,
                    transform: [{ scale: buttonSaveAnim }],
                  }}
                >
                  <TouchableOpacity
                    onPress={handleSaveToGallery}
                    activeOpacity={0.85}
                    style={styles.saveButtonContainer}
                  >
                    <LinearGradient
                      colors={[colors.primary.dark, '#E55A3A']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.actionButton, styles.saveButton]}
                    >
                      <Ionicons name="download-outline" size={22} color={colors.text.light} />
                      <Text style={[styles.actionButtonText, { color: colors.text.light }]}>
                        Sauvegarder
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
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
    marginBottom: 36,
    paddingHorizontal: 24,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  userUsername: {
    fontSize: 17,
    marginBottom: 14,
    fontWeight: '500',
  },
  userDescription: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
  },
  qrCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 24,
    padding: 0,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  qrGradientContainer: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrContainer: {
    width: QR_SIZE - 48,
    height: QR_SIZE - 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  shareButtonContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.secondary.main,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    gap: 10,
    minHeight: 56,
  },
  shareButton: {
    backgroundColor: 'transparent',
  },
  saveButton: {
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
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

