/**
 * TwoFactorAuthScreen - WHISPR-167
 * Two-factor authentication management
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Animated,
  Platform,
  Dimensions,
  Switch,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import * as Haptics from "expo-haptics";
import Toast from "../../components/Toast/Toast";
import QRCodeStyled from "react-native-qrcode-styled";
import { Circle, Path } from "react-native-svg";
import { TwoFactorService } from "../../services/TwoFactorService";

const copyToClipboard = async (text: string) => {
  try {
    const Clipboard = require("expo-clipboard");
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    console.log("📋 Copy to clipboard (fallback):", text);
    return false;
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface RecoveryCode {
  id: string;
  code: string;
  used: boolean;
}

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

export const TwoFactorAuthScreen: React.FC = () => {
  const navigation = useNavigation();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const accentColor = "#9692AC";
  const accentColorDark = "#727596";
  const qrGradientColors = ["#FFB07B", "#F86F71", "#F04882"];
  const qrShapes = useMemo(() => ["star", "spark", "diamond", "dot"], []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [setupInProgress, setSetupInProgress] = useState(false);
  const [expandedQR, setExpandedQR] = useState(false);
  const [expandedRecoveryCodes, setExpandedRecoveryCodes] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisablePrompt, setShowDisablePrompt] = useState(false);
  const [qrCodeSecret, setQrCodeSecret] = useState("");
  const [qrCodeUri, setQrCodeUri] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const renderStylizedPiece = useCallback(
    ({
      x,
      y,
      pieceSize,
      bitMatrix,
    }: {
      x: number;
      y: number;
      pieceSize: number;
      bitMatrix: number[][];
    }) => {
      if (!bitMatrix[y] || bitMatrix[y][x] === 0) {
        return null;
      }
      const shape = qrShapes[(x + y) % qrShapes.length];
      const size = pieceSize * 0.92;
      const cx = x * pieceSize + pieceSize / 2;
      const cy = y * pieceSize + pieceSize / 2;
      const r = size / 2;
      const fill = "url(#gradient)";

      const key = `${x}-${y}`;

      switch (shape) {
        case "diamond":
          return (
            <Path
              key={key}
              d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
              fill={fill}
            />
          );
        case "spark":
          return <Path key={key} d={buildSparkPath(cx, cy, r)} fill={fill} />;
        case "dot":
          return <Circle key={key} cx={cx} cy={cy} r={r} fill={fill} />;
        case "star":
        default:
          return <Path key={key} d={buildStarPath(cx, cy, r)} fill={fill} />;
      }
    },
    [qrShapes],
  );

  const qrOpacity = useRef(new Animated.Value(0)).current;
  const recoveryCodesOpacity = useRef(new Animated.Value(0)).current;
  const qrChevronRotation = useRef(new Animated.Value(0)).current;
  const recoveryCodesChevronRotation = useRef(new Animated.Value(0)).current;
  const [recoveryCodes, setRecoveryCodes] = useState<RecoveryCode[]>([]);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }>({
    visible: false,
    message: "",
    type: "info",
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

    TwoFactorService.getStatus()
      .then(({ enabled }) => setTwoFactorEnabled(enabled))
      .catch(() => showToast(getLocalizedText("twoFactor.loadError"), "error"))
      .finally(() => setLoading(false));
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

  const triggerHaptic = (
    type: "light" | "medium" | "heavy" | "success" = "light",
  ) => {
    if (Platform.OS === "ios") {
      try {
        if (type === "success") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.impactAsync(
            type === "light"
              ? Haptics.ImpactFeedbackStyle.Light
              : type === "medium"
                ? Haptics.ImpactFeedbackStyle.Medium
                : Haptics.ImpactFeedbackStyle.Heavy,
          );
        }
      } catch (error) {
        console.log("⚠️ Haptic feedback error:", error);
      }
    }
  };

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
  ) => {
    setToast({ visible: true, message, type });
  };

  const handleToggle2FA = async (value: boolean) => {
    if (actionLoading || setupInProgress) return;
    triggerHaptic("light");
    if (value) {
      setActionLoading(true);
      try {
        const setupData = await TwoFactorService.setup();
        setQrCodeSecret(setupData.secret);
        setQrCodeUri(setupData.qrCodeUri);
        setSetupInProgress(true);
        setExpandedQR(true);
      } catch {
        showToast(getLocalizedText("twoFactor.setupError"), "error");
      } finally {
        setActionLoading(false);
      }
    } else {
      setShowDisablePrompt(true);
    }
  };

  const handleVerifyQRCode = async () => {
    if (verificationCode.length < 6) {
      triggerHaptic("heavy");
      showToast(getLocalizedText("twoFactor.invalidCode"), "error");
      return;
    }

    setActionLoading(true);
    try {
      await TwoFactorService.enable(verificationCode);
      const backupData = await TwoFactorService.getBackupCodes();
      setRecoveryCodes(
        backupData.codes.map((code, i) => ({
          id: String(i),
          code,
          used: false,
        })),
      );
      setTwoFactorEnabled(true);
      setSetupInProgress(false);
      setVerificationCode("");
      setExpandedQR(false);
      triggerHaptic("success");
      showToast(getLocalizedText("twoFactor.enabled"), "success");
    } catch {
      triggerHaptic("heavy");
      showToast(getLocalizedText("twoFactor.invalidCode"), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (disableCode.length < 6) {
      triggerHaptic("heavy");
      showToast(getLocalizedText("twoFactor.invalidCode"), "error");
      return;
    }

    setActionLoading(true);
    try {
      await TwoFactorService.disable(disableCode);
      setTwoFactorEnabled(false);
      setSetupInProgress(false);
      setDisableCode("");
      setShowDisablePrompt(false);
      setRecoveryCodes([]);
      setQrCodeSecret("");
      setQrCodeUri("");
      triggerHaptic("medium");
      showToast(getLocalizedText("twoFactor.disabled"), "success");
    } catch {
      triggerHaptic("heavy");
      showToast(getLocalizedText("twoFactor.invalidCode"), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    setActionLoading(true);
    try {
      const backupData = await TwoFactorService.getBackupCodes();
      setRecoveryCodes(
        backupData.codes.map((code, i) => ({
          id: String(i),
          code,
          used: false,
        })),
      );
      triggerHaptic("success");
      showToast(getLocalizedText("twoFactor.codesRegenerated"), "success");
    } catch {
      showToast(getLocalizedText("twoFactor.setupError"), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyRecoveryCode = async (code: string) => {
    triggerHaptic("light");
    const success = await copyToClipboard(code);
    if (success) {
      triggerHaptic("success");
      showToast(getLocalizedText("twoFactor.codeCopied"), "success");
    } else {
      showToast(`${getLocalizedText("twoFactor.codeCopied")}: ${code}`, "info");
    }
  };

  const handleScanQRCode = () => {
    triggerHaptic("light");
    Alert.alert(
      "",
      getLocalizedText("twoFactor.qrScannerComingSoon"),
      [{ text: getLocalizedText("common.ok") }],
      { cancelable: true },
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={themeColors.background.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.container,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={accentColor} />
      </LinearGradient>
    );
  }

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
                  backgroundColor: themeColors.background.secondary + "80",
                },
              ]}
              onPress={() => {
                triggerHaptic("light");
                navigation.goBack();
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-back"
                size={22}
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
              {getLocalizedText("twoFactor.title")}
            </Text>
          </View>

          <View
            style={[
              styles.infoBanner,
              {
                backgroundColor: themeColors.background.secondary,
                borderColor: "rgba(255, 255, 255, 0.1)",
              },
            ]}
          >
            <View
              style={[
                styles.infoIconContainer,
                { backgroundColor: accentColor + "20" },
              ]}
            >
              <Ionicons name="shield-checkmark" size={22} color={accentColor} />
            </View>
            <Text
              style={[
                styles.infoText,
                {
                  color: themeColors.text.primary,
                  fontSize: getFontSize("sm"),
                },
              ]}
            >
              {getLocalizedText("twoFactor.infoMessage")}
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.sectionIconContainer,
                  { backgroundColor: accentColor + "20" },
                ]}
              >
                <Ionicons name="lock-closed" size={20} color={accentColor} />
              </View>
              <View style={styles.sectionTitleContainer}>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("lg"),
                    },
                  ]}
                >
                  {getLocalizedText("twoFactor.authentication")}
                </Text>
                <Text
                  style={[
                    styles.sectionSubtitle,
                    {
                      color: themeColors.text.secondary,
                      fontSize: getFontSize("sm"),
                    },
                  ]}
                >
                  {getLocalizedText("twoFactor.authenticationSubtitle")}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.toggleCard,
                {
                  backgroundColor: themeColors.background.secondary,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: "rgba(255, 255, 255, 0.1)",
                },
              ]}
            >
              <View style={styles.toggleContent}>
                <View style={styles.toggleInfo}>
                  <Text
                    style={[
                      styles.toggleTitle,
                      {
                        color: themeColors.text.primary,
                        fontSize: getFontSize("base"),
                      },
                    ]}
                  >
                    {getLocalizedText("twoFactor.enable2FA")}
                  </Text>
                  <Text
                    style={[
                      styles.toggleSubtitle,
                      {
                        color: themeColors.text.secondary,
                        fontSize: getFontSize("sm"),
                      },
                    ]}
                  >
                    {getLocalizedText("twoFactor.enable2FASubtitle")}
                  </Text>
                </View>
                <Switch
                  value={twoFactorEnabled || setupInProgress}
                  onValueChange={handleToggle2FA}
                  trackColor={{
                    false: themeColors.text.tertiary,
                    true: themeColors.primary,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {(twoFactorEnabled || setupInProgress) && (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIconContainer,
                      { backgroundColor: accentColor + "20" },
                    ]}
                  >
                    <Ionicons name="qr-code" size={20} color={accentColor} />
                  </View>
                  <View style={styles.sectionTitleContainer}>
                    <Text
                      style={[
                        styles.sectionTitle,
                        {
                          color: themeColors.text.primary,
                          fontSize: getFontSize("lg"),
                        },
                      ]}
                    >
                      {getLocalizedText("twoFactor.qrCode")}
                    </Text>
                    <Text
                      style={[
                        styles.sectionSubtitle,
                        {
                          color: themeColors.text.secondary,
                          fontSize: getFontSize("sm"),
                        },
                      ]}
                    >
                      {getLocalizedText("twoFactor.qrCodeSubtitle")}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic("light");
                    setExpandedQR(!expandedQR);
                    if (expandedRecoveryCodes) setExpandedRecoveryCodes(false);
                  }}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: themeColors.background.secondary,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: "rgba(255, 255, 255, 0.1)",
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionCardContent}>
                    <View
                      style={[
                        styles.actionIconContainer,
                        { backgroundColor: accentColor + "20" },
                      ]}
                    >
                      <Ionicons
                        name="qr-code-outline"
                        size={24}
                        color={accentColor}
                      />
                    </View>
                    <View style={styles.actionCardInfo}>
                      <Text
                        style={[
                          styles.actionCardTitle,
                          {
                            color: themeColors.text.primary,
                            fontSize: getFontSize("base"),
                          },
                        ]}
                      >
                        {getLocalizedText("twoFactor.viewQRCode")}
                      </Text>
                      <Text
                        style={[
                          styles.actionCardSubtitle,
                          {
                            color: themeColors.text.secondary,
                            fontSize: getFontSize("sm"),
                          },
                        ]}
                      >
                        {getLocalizedText("twoFactor.viewQRCodeSubtitle")}
                      </Text>
                    </View>
                    <Animated.View
                      style={{
                        transform: [
                          {
                            rotate: qrChevronRotation.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0deg", "180deg"],
                            }),
                          },
                        ],
                      }}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={themeColors.text.tertiary}
                      />
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
                          borderBottomColor: "rgba(255, 255, 255, 0.1)",
                        },
                      ]}
                    >
                      <View style={styles.qrCard}>
                        <View style={styles.qrOuterFrame}>
                          <View style={styles.qrInnerFrame}>
                            <LinearGradient
                              colors={["#FFF3F0", "#FDDDEA"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.qrCanvas}
                            >
                              <QRCodeStyled
                                data={
                                  qrCodeUri ||
                                  `otpauth://totp/WHISPR?secret=${qrCodeSecret}&issuer=Whispr`
                                }
                                padding={10}
                                size={190}
                                pieceCornerType="rounded"
                                pieceBorderRadius={60}
                                pieceLiquidRadius={50}
                                pieceScale={1.05}
                                isPiecesGlued
                                gradient={{
                                  type: "linear",
                                  options: {
                                    colors: qrGradientColors,
                                    start: [0, 0],
                                    end: [1, 1],
                                  },
                                }}
                                outerEyesOptions={{
                                  topLeft: {
                                    borderRadius: 24,
                                    stroke: "#1D112F",
                                    strokeWidth: 4,
                                    color: "#FDF3EA",
                                  },
                                  topRight: {
                                    borderRadius: 24,
                                    stroke: "#1D112F",
                                    strokeWidth: 4,
                                    color: "#FDF3EA",
                                  },
                                  bottomLeft: {
                                    borderRadius: 24,
                                    stroke: "#1D112F",
                                    strokeWidth: 4,
                                    color: "#FDF3EA",
                                  },
                                }}
                                innerEyesOptions={{
                                  topLeft: {
                                    borderRadius: 18,
                                    color: "#2D1935",
                                  },
                                  topRight: {
                                    borderRadius: 18,
                                    color: "#2D1935",
                                  },
                                  bottomLeft: {
                                    borderRadius: 18,
                                    color: "#2D1935",
                                  },
                                }}
                                color="#F66E7E"
                                renderCustomPieceItem={renderStylizedPiece}
                              />
                            </LinearGradient>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.qrSecretLabel,
                            {
                              color: themeColors.text.primary,
                              fontSize: getFontSize("sm"),
                            },
                          ]}
                        >
                          {qrCodeSecret}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={handleScanQRCode}
                        activeOpacity={0.8}
                        style={[
                          styles.scanButton,
                          {
                            backgroundColor: themeColors.background.primary,
                            borderColor: accentColor + "40",
                          },
                        ]}
                      >
                        <Ionicons name="camera" size={20} color={accentColor} />
                        <Text
                          style={[
                            styles.scanButtonText,
                            {
                              color: accentColor,
                              fontSize: getFontSize("base"),
                            },
                          ]}
                        >
                          {getLocalizedText("twoFactor.scanQRCode")}
                        </Text>
                      </TouchableOpacity>

                      <Text
                        style={[
                          styles.verifyLabel,
                          {
                            color: themeColors.text.secondary,
                            fontSize: getFontSize("sm"),
                          },
                        ]}
                      >
                        {getLocalizedText("twoFactor.enterVerificationCode")}
                      </Text>
                      <TextInput
                        style={[
                          styles.codeInput,
                          {
                            backgroundColor: themeColors.background.primary,
                            color: themeColors.text.primary,
                            borderColor: accentColor + "40",
                            fontSize: getFontSize("base"),
                          },
                        ]}
                        value={verificationCode}
                        onChangeText={setVerificationCode}
                        placeholder={getLocalizedText("twoFactor.enterCode")}
                        placeholderTextColor={themeColors.text.tertiary}
                        maxLength={6}
                        keyboardType="number-pad"
                      />

                      <TouchableOpacity
                        onPress={handleVerifyQRCode}
                        activeOpacity={0.9}
                        disabled={actionLoading}
                        style={styles.verifyButtonContainer}
                      >
                        <LinearGradient
                          colors={[
                            themeColors.primary,
                            themeColors.primary + "DD",
                          ]}
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
                          {actionLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text
                              style={[
                                styles.verifyButtonText,
                                {
                                  color: "#FFFFFF",
                                  fontSize: getFontSize("base"),
                                },
                              ]}
                            >
                              {getLocalizedText("twoFactor.verify")}
                            </Text>
                          )}
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
                      { backgroundColor: accentColor + "20" },
                    ]}
                  >
                    <Ionicons name="key" size={20} color={accentColor} />
                  </View>
                  <View style={styles.sectionTitleContainer}>
                    <Text
                      style={[
                        styles.sectionTitle,
                        {
                          color: themeColors.text.primary,
                          fontSize: getFontSize("lg"),
                        },
                      ]}
                    >
                      {getLocalizedText("twoFactor.recoveryCodes")}
                    </Text>
                    <Text
                      style={[
                        styles.sectionSubtitle,
                        {
                          color: themeColors.text.secondary,
                          fontSize: getFontSize("sm"),
                        },
                      ]}
                    >
                      {getLocalizedText("twoFactor.recoveryCodesSubtitle")}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic("light");
                    setExpandedRecoveryCodes(!expandedRecoveryCodes);
                    if (expandedQR) setExpandedQR(false);
                  }}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: themeColors.background.secondary,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: "rgba(255, 255, 255, 0.1)",
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionCardContent}>
                    <View
                      style={[
                        styles.actionIconContainer,
                        { backgroundColor: accentColor + "20" },
                      ]}
                    >
                      <Ionicons
                        name="key-outline"
                        size={24}
                        color={accentColor}
                      />
                    </View>
                    <View style={styles.actionCardInfo}>
                      <Text
                        style={[
                          styles.actionCardTitle,
                          {
                            color: themeColors.text.primary,
                            fontSize: getFontSize("base"),
                          },
                        ]}
                      >
                        {getLocalizedText("twoFactor.viewRecoveryCodes")}
                      </Text>
                      <Text
                        style={[
                          styles.actionCardSubtitle,
                          {
                            color: themeColors.text.secondary,
                            fontSize: getFontSize("sm"),
                          },
                        ]}
                      >
                        {getLocalizedText(
                          "twoFactor.viewRecoveryCodesSubtitle",
                        )}
                      </Text>
                    </View>
                    <Animated.View
                      style={{
                        transform: [
                          {
                            rotate: recoveryCodesChevronRotation.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0deg", "180deg"],
                            }),
                          },
                        ],
                      }}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={themeColors.text.tertiary}
                      />
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
                          borderBottomColor: "rgba(255, 255, 255, 0.1)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.recoveryCodesInfo,
                          {
                            color: themeColors.text.secondary,
                            fontSize: getFontSize("sm"),
                          },
                        ]}
                      >
                        {getLocalizedText("twoFactor.recoveryCodesInfo")}
                      </Text>

                      <TouchableOpacity
                        onPress={handleRegenerateBackupCodes}
                        disabled={actionLoading}
                        activeOpacity={0.8}
                        style={[
                          styles.scanButton,
                          {
                            backgroundColor: themeColors.background.primary,
                            borderColor: accentColor + "40",
                            marginBottom: 16,
                          },
                        ]}
                      >
                        {actionLoading ? (
                          <ActivityIndicator size="small" color={accentColor} />
                        ) : (
                          <>
                            <Ionicons
                              name="refresh"
                              size={20}
                              color={accentColor}
                            />
                            <Text
                              style={[
                                styles.scanButtonText,
                                {
                                  color: accentColor,
                                  fontSize: getFontSize("base"),
                                },
                              ]}
                            >
                              {getLocalizedText("twoFactor.regenerateCodes")}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <View style={styles.recoveryCodesGrid}>
                        {recoveryCodes.map((recoveryCode) => (
                          <View
                            key={recoveryCode.id}
                            style={[
                              styles.recoveryCodeCard,
                              {
                                backgroundColor: themeColors.background.primary,
                                borderColor: recoveryCode.used
                                  ? themeColors.text.tertiary + "30"
                                  : accentColor + "30",
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
                                  fontSize: getFontSize("base"),
                                  textDecorationLine: recoveryCode.used
                                    ? "line-through"
                                    : "none",
                                },
                              ]}
                            >
                              {recoveryCode.code}
                            </Text>
                            {!recoveryCode.used && (
                              <TouchableOpacity
                                onPress={() =>
                                  handleCopyRecoveryCode(recoveryCode.code)
                                }
                                style={[
                                  styles.copyCodeButton,
                                  { backgroundColor: accentColor + "20" },
                                ]}
                                activeOpacity={0.7}
                              >
                                <Ionicons
                                  name="copy"
                                  size={16}
                                  color={accentColor}
                                />
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

      {showDisablePrompt && (
        <View style={[styles.disablePromptOverlay]}>
          <View
            style={[
              styles.disablePromptCard,
              { backgroundColor: themeColors.background.secondary },
            ]}
          >
            <Text
              style={[
                styles.disablePromptTitle,
                {
                  color: themeColors.text.primary,
                  fontSize: getFontSize("lg"),
                },
              ]}
            >
              {getLocalizedText("twoFactor.disable")}
            </Text>
            <Text
              style={[
                styles.disablePromptSubtitle,
                {
                  color: themeColors.text.secondary,
                  fontSize: getFontSize("sm"),
                },
              ]}
            >
              {getLocalizedText("twoFactor.disableConfirm")}
            </Text>
            <TextInput
              style={[
                styles.codeInput,
                {
                  backgroundColor: themeColors.background.primary,
                  color: themeColors.text.primary,
                  borderColor: accentColor + "40",
                  fontSize: getFontSize("base"),
                },
              ]}
              value={disableCode}
              onChangeText={setDisableCode}
              placeholder={getLocalizedText("twoFactor.enterCode")}
              placeholderTextColor={themeColors.text.tertiary}
              maxLength={6}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={styles.disablePromptActions}>
              <TouchableOpacity
                onPress={() => {
                  setShowDisablePrompt(false);
                  setDisableCode("");
                }}
                style={[
                  styles.disablePromptButton,
                  { backgroundColor: themeColors.background.primary },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    color: themeColors.text.primary,
                    fontSize: getFontSize("base"),
                  }}
                >
                  {getLocalizedText("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDisable2FA}
                disabled={actionLoading}
                style={[
                  styles.disablePromptButton,
                  { backgroundColor: "#E53E3E" },
                ]}
                activeOpacity={0.8}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    style={{ color: "#FFFFFF", fontSize: getFontSize("base") }}
                  >
                    {getLocalizedText("twoFactor.disable")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    fontWeight: "bold",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 32,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  sectionSubtitle: {
    lineHeight: 18,
  },
  toggleCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  toggleContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontWeight: "500",
    marginBottom: 4,
  },
  toggleSubtitle: {
    lineHeight: 18,
  },
  actionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  actionCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  actionCardInfo: {
    flex: 1,
  },
  actionCardTitle: {
    fontWeight: "500",
    marginBottom: 4,
  },
  actionCardSubtitle: {
    lineHeight: 18,
  },
  expandableContent: {
    overflow: "hidden",
  },
  expandableInner: {
    padding: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  qrCard: {
    marginBottom: 24,
    width: "100%",
  },
  qrOuterFrame: {
    borderRadius: 28,
    padding: 4,
    backgroundColor: "#120B23",
    borderWidth: 2,
    borderColor: "#F9B192",
  },
  qrInnerFrame: {
    borderRadius: 24,
    padding: 12,
    backgroundColor: "#1B1030",
  },
  qrCanvas: {
    borderRadius: 20,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  qrSecretLabel: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 2,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 8,
  },
  scanButtonText: {
    fontWeight: "600",
  },
  verifyLabel: {
    marginBottom: 12,
    fontWeight: "500",
  },
  codeInput: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 24,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlign: "center",
    letterSpacing: 3,
    fontWeight: "600",
  },
  verifyButtonContainer: {
    borderRadius: 16,
    overflow: "hidden",
  },
  verifyButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonText: {
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  recoveryCodesInfo: {
    marginBottom: 20,
    lineHeight: 20,
    textAlign: "center",
  },
  recoveryCodesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  recoveryCodeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    width: (SCREEN_WIDTH - 80) / 2,
    minWidth: 140,
  },
  recoveryCodeText: {
    flex: 1,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 1,
  },
  copyCodeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  disablePromptOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  disablePromptCard: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 16,
    padding: 24,
  },
  disablePromptTitle: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  disablePromptSubtitle: {
    lineHeight: 20,
    marginBottom: 16,
  },
  disablePromptActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  disablePromptButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default TwoFactorAuthScreen;
