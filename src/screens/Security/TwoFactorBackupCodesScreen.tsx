import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import * as Haptics from "expo-haptics";
import Toast from "../../components/Toast/Toast";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";

const copyToClipboard = (text: string): boolean => {
  try {
    Clipboard.setString(text);
    return true;
  } catch {
    return false;
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const TwoFactorBackupCodesScreen: React.FC = () => {
  const navigation =
    useNavigation<
      StackNavigationProp<AuthStackParamList, "TwoFactorBackupCodes">
    >();
  const route =
    useRoute<RouteProp<AuthStackParamList, "TwoFactorBackupCodes">>();
  const { codes } = route.params;

  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const accentColor = "#9692AC";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [confirmed, setConfirmed] = useState(false);
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

  const handleCopyCode = (code: string) => {
    triggerHaptic("light");
    const success = copyToClipboard(code);
    if (success) {
      triggerHaptic("success");
      showToast(getLocalizedText("twoFactor.codeCopied"), "success");
    }
  };

  const handleCopyAll = () => {
    triggerHaptic("light");
    const success = copyToClipboard(codes.join("\n"));
    if (success) {
      triggerHaptic("success");
      showToast(getLocalizedText("twoFactor.allCodesCopied"), "success");
    }
  };

  useEffect(() => {
    return navigation.addListener("beforeRemove", (e) => {
      if (confirmed) return;
      e.preventDefault();
      showToast(getLocalizedText("twoFactor.confirmSavedFirst"), "warning");
    });
  }, [confirmed, navigation, getLocalizedText]);

  const handleComplete = () => {
    triggerHaptic("success");
    navigation.popToTop();
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
            <Text
              style={[
                styles.title,
                {
                  color: themeColors.text.primary,
                  fontSize: getFontSize("xxxl"),
                },
              ]}
            >
              {getLocalizedText("twoFactor.backupCodesTitle")}
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
              {getLocalizedText("twoFactor.step3of3")}
            </Text>
          </View>

          <View
            style={[
              styles.warningBanner,
              { backgroundColor: "#E53E3E20", borderColor: "#E53E3E40" },
            ]}
          >
            <View
              style={[
                styles.warningIconContainer,
                { backgroundColor: "#E53E3E20" },
              ]}
            >
              <Ionicons name="warning" size={22} color="#E53E3E" />
            </View>
            <Text
              style={[
                styles.warningText,
                {
                  color: themeColors.text.primary,
                  fontSize: getFontSize("sm"),
                },
              ]}
            >
              {getLocalizedText("twoFactor.backupCodesWarning")}
            </Text>
          </View>

          <View style={styles.codesGrid}>
            {codes.map((code, index) => (
              <View
                key={index}
                style={[
                  styles.codeCard,
                  {
                    backgroundColor: themeColors.background.secondary,
                    borderColor: accentColor + "30",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.codeText,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("base"),
                    },
                  ]}
                >
                  {code}
                </Text>
                <TouchableOpacity
                  onPress={() => handleCopyCode(code)}
                  style={[
                    styles.copyCodeButton,
                    { backgroundColor: accentColor + "20" },
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="copy" size={16} color={accentColor} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleCopyAll}
            activeOpacity={0.8}
            style={[
              styles.copyAllButton,
              {
                backgroundColor: themeColors.background.secondary,
                borderColor: accentColor + "40",
              },
            ]}
          >
            <Ionicons name="copy-outline" size={20} color={accentColor} />
            <Text
              style={[
                styles.copyAllText,
                { color: accentColor, fontSize: getFontSize("base") },
              ]}
            >
              {getLocalizedText("twoFactor.copyAll")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              triggerHaptic("light");
              setConfirmed(!confirmed);
            }}
            activeOpacity={0.8}
            style={styles.checkboxRow}
          >
            <Ionicons
              name={confirmed ? "checkbox" : "square-outline"}
              size={24}
              color={
                confirmed ? themeColors.primary : themeColors.text.tertiary
              }
            />
            <Text
              style={[
                styles.checkboxLabel,
                {
                  color: confirmed
                    ? themeColors.text.primary
                    : themeColors.text.secondary,
                  fontSize: getFontSize("base"),
                },
              ]}
            >
              {getLocalizedText("twoFactor.confirmSaved")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleComplete}
            activeOpacity={confirmed ? 0.9 : 1}
            disabled={!confirmed}
            style={styles.completeButtonContainer}
          >
            <LinearGradient
              colors={
                confirmed
                  ? [themeColors.primary, themeColors.primary + "DD"]
                  : [themeColors.text.tertiary, themeColors.text.tertiary]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.completeButton,
                confirmed
                  ? Platform.select({
                      ios: {
                        shadowColor: themeColors.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                      },
                      android: { elevation: 6 },
                    })
                  : undefined,
              ]}
            >
              <Text
                style={[
                  styles.completeButtonText,
                  { color: "#FFFFFF", fontSize: getFontSize("base") },
                ]}
              >
                {getLocalizedText("twoFactor.completeSetup")}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
  },
  title: { fontWeight: "bold" },
  stepIndicator: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  stepText: { fontWeight: "500" },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 32,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  warningText: { flex: 1, lineHeight: 20 },
  codesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    width: (SCREEN_WIDTH - 52) / 2,
    minWidth: 140,
  },
  codeText: {
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
    marginLeft: 8,
  },
  copyAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 24,
  },
  copyAllText: { fontWeight: "500" },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  checkboxLabel: { flex: 1, lineHeight: 20 },
  completeButtonContainer: { marginHorizontal: 20 },
  completeButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
  },
  completeButtonText: { fontWeight: "600" },
});

export default TwoFactorBackupCodesScreen;
