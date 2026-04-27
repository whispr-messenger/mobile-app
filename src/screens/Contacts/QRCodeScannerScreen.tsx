/**
 * Scanner QR — ajout contact (WHISPR-215)
 */

import React, { useState, useEffect, useRef } from "react";
import { formatUsername } from "../../utils";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { qrCodeService } from "../../services/qrCode/qrCodeService";
import { contactsAPI } from "../../services/contacts/api";

// Lazy-load the web QR scanner so native bundles don't pull in browser-only deps.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let WebScanner: any = null;
if (Platform.OS === "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebScanner = require("@yudiel/react-qr-scanner").Scanner;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCAN_AREA_SIZE = Math.min(SCREEN_WIDTH - 64, 280);

export const QRCodeScannerScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList>>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (permission?.granted) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

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

  const handleBarCodeScanned = async ({
    data,
  }: {
    data: string;
    type?: string;
  }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);

    try {
      const qrData = qrCodeService.parseQRCodeData(data);
      if (!qrData || qrData.type !== "contact") {
        Alert.alert(
          "QR code invalide",
          "Ce QR code n'est pas un code de contact Whispr.",
          [
            {
              text: "Réessayer",
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
          ],
        );
        return;
      }

      const userId = qrData.userId;
      const currentUserId = await qrCodeService.getCurrentUserId();
      if (userId === currentUserId) {
        Alert.alert(
          "QR code personnel",
          "Vous ne pouvez pas vous ajouter vous-même comme contact.",
          [
            {
              text: "OK",
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
          ],
        );
        return;
      }

      const userResult = await contactsAPI.getUserPreviewById(userId);
      if (!userResult) {
        Alert.alert(
          "Utilisateur introuvable",
          "Cet utilisateur n'existe pas ou n'est pas disponible.",
          [
            {
              text: "OK",
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
          ],
        );
        return;
      }

      if (userResult.is_blocked) {
        Alert.alert(
          "Contact bloqué",
          "Cet utilisateur est bloqué. Vous ne pouvez pas l'ajouter comme contact.",
          [
            {
              text: "OK",
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              },
            },
          ],
        );
        return;
      }

      const u = userResult.user;
      const displayName = u.first_name
        ? `${u.first_name} ${u.last_name || ""}`.trim()
        : u.username;

      Alert.alert(
        "Ajouter le contact",
        `Voulez-vous ajouter ${displayName} (${formatUsername(u.username)}) à vos contacts ?`,
        [
          {
            text: "Annuler",
            style: "cancel",
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            },
          },
          {
            text: "Ajouter",
            onPress: async () => {
              try {
                await contactsAPI.sendContactRequest(userId);
                Alert.alert(
                  "Succès",
                  "Demande de contact envoyée. En attente d'acceptation.",
                  [
                    {
                      text: "OK",
                      onPress: () => navigation.goBack(),
                    },
                  ],
                );
              } catch (error: unknown) {
                const status =
                  typeof error === "object" &&
                  error !== null &&
                  "status" in error
                    ? Number((error as { status?: number }).status)
                    : undefined;
                const msg = error instanceof Error ? error.message : "";
                const isAlreadyPendingOrContact =
                  status === 409 ||
                  msg.toLowerCase().includes("already") ||
                  msg.toLowerCase().includes("pending");

                if (isAlreadyPendingOrContact) {
                  Alert.alert(
                    "Info",
                    "Une demande est deja en attente ou ce contact est deja ajoute.",
                    [
                      {
                        text: "OK",
                        onPress: () => navigation.goBack(),
                      },
                    ],
                  );
                  return;
                }

                Alert.alert("Erreur", msg, [
                  {
                    text: "OK",
                    onPress: () => {
                      setScanned(false);
                      setProcessing(false);
                    },
                  },
                ]);
              }
            },
          },
        ],
      );
    } catch {
      Alert.alert("Erreur", "Impossible de traiter le QR code", [
        {
          text: "Réessayer",
          onPress: () => {
            setScanned(false);
            setProcessing(false);
          },
        },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  if (Platform.OS === "web" && WebScanner) {
    return (
      <LinearGradient
        colors={colors.background.gradient.app}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.container} edges={["top"]}>
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
            <Text
              style={[
                styles.headerTitle,
                { color: themeColors.text.primary || colors.text.light },
              ]}
            >
              Scanner QR code
            </Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.cameraContainer}>
            <WebScanner
              onScan={(results: { rawValue: string }[]) => {
                if (results && results[0]) {
                  void handleBarCodeScanned({ data: results[0].rawValue });
                }
              }}
              onError={(err: Error) => {
                console.warn("QR scan error", err);
              }}
              constraints={{ facingMode: "environment" }}
              styles={{
                container: { width: "100%", height: "100%" },
                video: { width: "100%", height: "100%" },
              }}
            />
            <View style={styles.overlayBottom}>
              <Text style={styles.instructionText}>
                Positionnez le QR code dans le cadre
              </Text>
              {processing ? (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="small" color={colors.primary.main} />
                  <Text style={styles.processingText}>Traitement...</Text>
                </View>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!permission) {
    return (
      <LinearGradient
        colors={colors.background.gradient.app}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.container} edges={["top"]}>
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
        <SafeAreaView style={styles.container} edges={["top"]}>
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
            <Text
              style={[
                styles.headerTitle,
                { color: themeColors.text.primary || colors.text.light },
              ]}
            >
              Scanner QR code
            </Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.permissionContainer}>
            <Ionicons
              name="camera-outline"
              size={64}
              color={colors.text.light}
              style={{ opacity: 0.7 }}
            />
            <Text
              style={[styles.permissionTitle, { color: colors.text.light }]}
            >
              Accès à la caméra requis
            </Text>
            <Text
              style={[
                styles.permissionText,
                { color: colors.text.light, opacity: 0.8 },
              ]}
            >
              Pour scanner un QR code, Whispr a besoin d&apos;accéder à votre
              caméra.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={() => void requestPermission()}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionButtonText}>
                Autoriser l&apos;accès
              </Text>
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
      <SafeAreaView style={styles.container} edges={["top"]}>
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
          <Text
            style={[
              styles.headerTitle,
              { color: themeColors.text.primary || colors.text.light },
            ]}
          >
            Scanner QR code
          </Text>
          <View style={styles.placeholder} />
        </View>

        <Animated.View style={[styles.cameraContainer, { opacity: fadeAnim }]}>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.overlayTop} />
              <View style={styles.overlayMiddle}>
                <View style={styles.overlaySide} />
                <View style={styles.scanArea}>
                  <View style={[styles.corner, styles.cornerTopLeft]} />
                  <View style={[styles.corner, styles.cornerTopRight]} />
                  <View style={[styles.corner, styles.cornerBottomLeft]} />
                  <View style={[styles.corner, styles.cornerBottomRight]} />
                  {!scanned ? (
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
                  ) : null}
                </View>
                <View style={styles.overlaySide} />
              </View>
              <View style={styles.overlayBottom}>
                <Text style={styles.instructionText}>
                  Positionnez le QR code dans le cadre
                </Text>
                {processing ? (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator
                      size="small"
                      color={colors.primary.main}
                    />
                    <Text style={styles.processingText}>Traitement...</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </CameraView>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 10,
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  placeholder: { width: 32 },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "transparent" },
  overlayTop: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.6)" },
  overlayMiddle: {
    flexDirection: "row",
    height: SCAN_AREA_SIZE + 32,
  },
  overlaySide: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.6)" },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    marginVertical: 16,
    position: "relative",
  },
  corner: {
    position: "absolute",
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
    position: "absolute",
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
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  instructionText: {
    color: colors.text.light,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  processingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  processingText: {
    color: colors.text.light,
    fontSize: 14,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 24,
    marginBottom: 12,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 16,
    textAlign: "center",
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
    fontWeight: "600",
  },
});

export default QRCodeScannerScreen;
