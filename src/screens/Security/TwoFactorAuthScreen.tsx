/**
 * TwoFactorAuthScreen - WHISPR-653
 * Two-factor authentication management screen
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
  Switch,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import * as Haptics from "expo-haptics";
import Toast from "../../components/Toast/Toast";
import { TwoFactorService } from "../../services/TwoFactorService";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";

export const TwoFactorAuthScreen: React.FC = () => {
  const navigation =
    useNavigation<StackNavigationProp<AuthStackParamList, "TwoFactorAuth">>();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();
  const accentColor = "#9692AC";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDisableCard, setShowDisableCard] = useState(false);
  const [disableCode, setDisableCode] = useState("");
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

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      TwoFactorService.getStatus()
        .then(({ enabled }) => setTwoFactorEnabled(enabled))
        .catch(() =>
          showToast(getLocalizedText("twoFactor.loadError"), "error"),
        )
        .finally(() => setLoading(false));
    }, [getLocalizedText]),
  );

  const handleToggle2FA = (value: boolean) => {
    if (actionLoading || loading) return;
    triggerHaptic("light");
    if (value) {
      navigation.navigate("TwoFactorSetup");
    } else {
      setShowDisableCard(true);
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
      setDisableCode("");
      setShowDisableCard(false);
      triggerHaptic("medium");
      showToast(getLocalizedText("twoFactor.disabled"), "success");
    } catch {
      triggerHaptic("heavy");
      showToast(getLocalizedText("twoFactor.invalidCode"), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewBackupCodes = async () => {
    setActionLoading(true);
    try {
      const { codes } = await TwoFactorService.getBackupCodes();
      navigation.navigate("TwoFactorBackupCodes", { codes });
    } catch {
      showToast(getLocalizedText("twoFactor.setupError"), "error");
    } finally {
      setActionLoading(false);
    }
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
                  value={twoFactorEnabled}
                  onValueChange={handleToggle2FA}
                  trackColor={{
                    false: themeColors.text.tertiary,
                    true: themeColors.primary,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {showDisableCard && (
              <View
                style={[
                  styles.disableCard,
                  {
                    backgroundColor: themeColors.background.secondary,
                    borderColor: "#E53E3E40",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.disableCardTitle,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("base"),
                    },
                  ]}
                >
                  {getLocalizedText("twoFactor.disable")}
                </Text>
                <Text
                  style={[
                    styles.disableCardSubtitle,
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
                />
                <View style={styles.disableActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowDisableCard(false);
                      setDisableCode("");
                    }}
                    style={[
                      styles.disableActionButton,
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
                      styles.disableActionButton,
                      { backgroundColor: "#E53E3E" },
                    ]}
                    activeOpacity={0.8}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: getFontSize("base"),
                        }}
                      >
                        {getLocalizedText("twoFactor.disable")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {twoFactorEnabled && (
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
                onPress={handleViewBackupCodes}
                disabled={actionLoading}
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
                    {actionLoading ? (
                      <ActivityIndicator size="small" color={accentColor} />
                    ) : (
                      <Ionicons
                        name="key-outline"
                        size={24}
                        color={accentColor}
                      />
                    )}
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
                      {getLocalizedText("twoFactor.viewRecoveryCodesSubtitle")}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={themeColors.text.tertiary}
                  />
                </View>
              </TouchableOpacity>
            </View>
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
  section: { marginTop: 32, paddingHorizontal: 20 },
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
  sectionTitleContainer: { flex: 1 },
  sectionTitle: { fontWeight: "bold", marginBottom: 4 },
  sectionSubtitle: { lineHeight: 18 },
  toggleCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  toggleContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleInfo: { flex: 1 },
  toggleTitle: { fontWeight: "500", marginBottom: 4 },
  toggleSubtitle: { lineHeight: 18 },
  disableCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  disableCardTitle: { fontWeight: "600" },
  disableCardSubtitle: { lineHeight: 18 },
  codeInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    textAlign: "center",
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  disableActions: {
    flexDirection: "row",
    gap: 12,
  },
  disableActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionCardInfo: { flex: 1 },
  actionCardTitle: { fontWeight: "500", marginBottom: 2 },
  actionCardSubtitle: { lineHeight: 18 },
});

export default TwoFactorAuthScreen;
