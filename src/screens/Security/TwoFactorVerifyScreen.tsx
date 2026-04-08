import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import * as Haptics from "expo-haptics";
import Toast from "../../components/Toast/Toast";
import { TwoFactorService } from "../../services/TwoFactorService";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";

export const TwoFactorVerifyScreen: React.FC = () => {
  const navigation =
    useNavigation<StackNavigationProp<AuthStackParamList, "TwoFactorVerify">>();
  const route = useRoute<RouteProp<AuthStackParamList, "TwoFactorVerify">>();
  const { secret } = route.params;

  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const accentColor = "#9692AC";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
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

  const triggerHaptic = (type: "light" | "heavy" | "success" = "light") => {
    if (Platform.OS === "ios") {
      try {
        if (type === "success") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.impactAsync(
            type === "heavy"
              ? Haptics.ImpactFeedbackStyle.Heavy
              : Haptics.ImpactFeedbackStyle.Light,
          );
        }
      } catch {}
    }
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
  }, []);

  const handleVerify = async () => {
    if (code.length < 6) {
      triggerHaptic("heavy");
      showToast(getLocalizedText("twoFactor.invalidCode"), "error");
      return;
    }
    setLoading(true);
    try {
      const { backupCodes } = await TwoFactorService.enable(code);
      triggerHaptic("success");
      navigation.navigate("TwoFactorBackupCodes", { codes: backupCodes });
    } catch (err) {
      triggerHaptic("heavy");
      const status = (err as { status?: number })?.status;
      const key =
        status === 400 || status === 401
          ? "twoFactor.invalidCode"
          : "twoFactor.setupError";
      showToast(getLocalizedText(key), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={themeColors.background.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  { backgroundColor: themeColors.background.secondary + "80" },
                ]}
                onPress={() => {
                  triggerHaptic("light");
                  navigation.pop(2);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close"
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
                {getLocalizedText("twoFactor.verifyTitle")}
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
                {getLocalizedText("twoFactor.step2of3")}
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
                <Ionicons
                  name="shield-checkmark"
                  size={22}
                  color={accentColor}
                />
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
                {getLocalizedText("twoFactor.verifyInfoMessage")}
              </Text>
            </View>

            <View style={styles.codeSection}>
              <Text
                style={[
                  styles.secretReminder,
                  {
                    color: themeColors.text.secondary,
                    fontSize: getFontSize("sm"),
                  },
                ]}
              >
                {getLocalizedText("twoFactor.secretReminder")}
              </Text>
              <Text
                style={[
                  styles.secretValue,
                  {
                    color: themeColors.text.primary,
                    fontSize: getFontSize("sm"),
                  },
                ]}
                selectable
              >
                {secret}
              </Text>

              <Text
                style={[
                  styles.inputLabel,
                  {
                    color: themeColors.text.secondary,
                    fontSize: getFontSize("sm"),
                    marginTop: 24,
                  },
                ]}
              >
                {getLocalizedText("twoFactor.enterVerificationCode")}
              </Text>
              <TextInput
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: themeColors.background.secondary,
                    color: themeColors.text.primary,
                    borderColor: accentColor + "40",
                    fontSize: getFontSize("xl"),
                  },
                ]}
                value={code}
                onChangeText={setCode}
                placeholder="000000"
                placeholderTextColor={themeColors.text.tertiary}
                maxLength={6}
                keyboardType="number-pad"
                autoFocus
              />

              <TouchableOpacity
                onPress={handleVerify}
                activeOpacity={0.9}
                disabled={loading}
                style={styles.verifyButtonContainer}
              >
                <LinearGradient
                  colors={[themeColors.primary, themeColors.primary + "DD"]}
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
                      android: { elevation: 6 },
                    }),
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.verifyButtonText,
                        { color: "#FFFFFF", fontSize: getFontSize("base") },
                      ]}
                    >
                      {getLocalizedText("twoFactor.verify")}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>

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
  keyboardAvoid: { flex: 1 },
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
  codeSection: {
    paddingHorizontal: 20,
  },
  secretReminder: { marginBottom: 4 },
  secretValue: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 2,
  },
  inputLabel: { marginBottom: 8 },
  codeInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    textAlign: "center",
    letterSpacing: 8,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 24,
  },
  verifyButtonContainer: { marginTop: 8 },
  verifyButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
  },
  verifyButtonText: { fontWeight: "600" },
});

export default TwoFactorVerifyScreen;
