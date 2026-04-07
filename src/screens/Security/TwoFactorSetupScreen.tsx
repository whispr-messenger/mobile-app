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
  Animated,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import * as Haptics from "expo-haptics";
import Toast from "../../components/Toast/Toast";
import QRCodeStyled from "react-native-qrcode-styled";
import { Circle, Path } from "react-native-svg";
import { TwoFactorService } from "../../services/TwoFactorService";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    // Fallback for non-HTTPS contexts (e.g. Expo web on local IP)
    Clipboard.setString(text);
    return true;
  }
};

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

export const TwoFactorSetupScreen: React.FC = () => {
  const navigation =
    useNavigation<StackNavigationProp<AuthStackParamList, "TwoFactorSetup">>();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const accentColor = "#9692AC";
  const qrGradientColors = ["#FFB07B", "#F86F71", "#F04882"];
  const qrShapes = useMemo(() => ["star", "spark", "diamond", "dot"], []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState("");
  const [qrCodeUri, setQrCodeUri] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }>({ visible: false, message: "", type: "info" });

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
  ) => {
    setToast({ visible: true, message, type });
  };

  const triggerHaptic = (type: "light" | "success" = "light") => {
    if (Platform.OS === "ios") {
      try {
        if (type === "success") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch {}
    }
  };

  const loadSetup = () => {
    setLoading(true);
    setError(null);
    TwoFactorService.setup()
      .then(({ secret: s, qrCodeUri: uri }) => {
        setSecret(s);
        setQrCodeUri(uri);
      })
      .catch(() => setError(getLocalizedText("twoFactor.setupError")))
      .finally(() => setLoading(false));
  };

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
    loadSetup();
  }, []);

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
      if (!bitMatrix[y] || bitMatrix[y][x] === 0) return null;
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

  const handleCopySecret = async () => {
    triggerHaptic("light");
    const success = await copyToClipboard(secret);
    if (success) {
      triggerHaptic("success");
      showToast(getLocalizedText("twoFactor.secretCopied"), "success");
    }
  };

  const handleNext = () => {
    triggerHaptic("light");
    navigation.navigate("TwoFactorVerify", { secret });
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
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
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
                { backgroundColor: themeColors.background.secondary + "80" },
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
              {getLocalizedText("twoFactor.setupTitle")}
            </Text>
          </View>

          <View style={styles.stepIndicator}>
            <Text
              style={[
                styles.stepText,
                {
                  color: themeColors.text.secondary,
                  fontSize: getFontSize("sm"),
                },
              ]}
            >
              {getLocalizedText("twoFactor.step1of3")}
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
              <Ionicons name="qr-code" size={22} color={accentColor} />
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
              {getLocalizedText("twoFactor.setupInfoMessage")}
            </Text>
          </View>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={accentColor} />
            </View>
          )}

          {!loading && error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#E53E3E" />
              <Text
                style={[
                  styles.errorText,
                  {
                    color: themeColors.text.secondary,
                    fontSize: getFontSize("base"),
                  },
                ]}
              >
                {error}
              </Text>
              <TouchableOpacity
                onPress={loadSetup}
                activeOpacity={0.8}
                style={[
                  styles.retryButton,
                  {
                    backgroundColor: accentColor + "20",
                    borderColor: accentColor + "40",
                  },
                ]}
              >
                <Ionicons name="refresh" size={18} color={accentColor} />
                <Text
                  style={[
                    styles.retryButtonText,
                    { color: accentColor, fontSize: getFontSize("base") },
                  ]}
                >
                  {getLocalizedText("common.retry")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && qrCodeUri !== "" && (
            <>
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
                        data={qrCodeUri}
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
                          topLeft: { borderRadius: 18, color: "#2D1935" },
                          topRight: { borderRadius: 18, color: "#2D1935" },
                          bottomLeft: { borderRadius: 18, color: "#2D1935" },
                        }}
                        color="#F66E7E"
                        renderCustomPieceItem={renderStylizedPiece}
                      />
                    </LinearGradient>
                  </View>
                </View>
              </View>

              <View style={styles.secretContainer}>
                <Text
                  style={[
                    styles.secretLabel,
                    {
                      color: themeColors.text.secondary,
                      fontSize: getFontSize("sm"),
                    },
                  ]}
                >
                  {getLocalizedText("twoFactor.manualEntryLabel")}
                </Text>
                <Text
                  style={[
                    styles.secretValue,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("base"),
                    },
                  ]}
                  selectable
                >
                  {secret}
                </Text>
                <TouchableOpacity
                  onPress={handleCopySecret}
                  activeOpacity={0.8}
                  style={[
                    styles.copyButton,
                    {
                      backgroundColor: themeColors.background.secondary,
                      borderColor: accentColor + "40",
                    },
                  ]}
                >
                  <Ionicons name="copy-outline" size={18} color={accentColor} />
                  <Text
                    style={[
                      styles.copyButtonText,
                      { color: accentColor, fontSize: getFontSize("base") },
                    ]}
                  >
                    {getLocalizedText("twoFactor.copySecret")}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.9}
                style={styles.nextButtonContainer}
              >
                <LinearGradient
                  colors={[themeColors.primary, themeColors.primary + "DD"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.nextButton,
                    Platform.select({
                      ios: {
                        shadowColor: themeColors.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                      },
                      android: { elevation: 6 },
                    }),
                  ]}
                >
                  <Text
                    style={[
                      styles.nextButtonText,
                      { color: "#FFFFFF", fontSize: getFontSize("base") },
                    ]}
                  >
                    {getLocalizedText("common.next")}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color="#FFFFFF"
                    style={{ marginLeft: 8 }}
                  />
                </LinearGradient>
              </TouchableOpacity>
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
  container: { flex: 1 },
  animatedContainer: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
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
      android: { elevation: 2 },
    }),
  },
  title: { fontWeight: "bold" },
  stepIndicator: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  stepText: { fontWeight: "500" },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 32,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoText: { flex: 1, lineHeight: 20 },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  errorContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 48,
    gap: 16,
  },
  errorText: { textAlign: "center", lineHeight: 22 },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  retryButtonText: { fontWeight: "500" },
  qrCard: {
    alignItems: "center",
    marginBottom: 24,
  },
  qrOuterFrame: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  qrInnerFrame: {
    borderRadius: 16,
    overflow: "hidden",
  },
  qrCanvas: {
    width: 210,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  secretContainer: {
    marginHorizontal: 20,
    marginBottom: 32,
    gap: 8,
  },
  secretLabel: { marginBottom: 4 },
  secretValue: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 2,
    textAlign: "center",
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  copyButtonText: { fontWeight: "500" },
  nextButtonContainer: { marginHorizontal: 20 },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
  },
  nextButtonText: { fontWeight: "600" },
});

export default TwoFactorSetupScreen;
