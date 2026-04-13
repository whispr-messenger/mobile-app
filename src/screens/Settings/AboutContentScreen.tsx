/**
 * AboutContentScreen — contenu, sécurité, liens légaux et CTA signalement (WHISPR).
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { colors, withOpacity } from "../../theme/colors";

type Extra = {
  legalPrivacyUrl?: string;
  legalTermsUrl?: string;
};

function getLegalExtra(): Extra {
  const e = Constants.expoConfig?.extra as Extra | undefined;
  return e ?? {};
}

export const AboutContentScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();

  const openLegalUrl = useCallback(
    async (url: string | undefined) => {
      if (!url?.trim()) {
        Alert.alert(
          getLocalizedText("notif.error"),
          getLocalizedText("about.legalOpenError"),
        );
        return;
      }
      try {
        const supported = await Linking.canOpenURL(url);
        if (!supported) {
          Alert.alert(
            getLocalizedText("notif.error"),
            getLocalizedText("about.legalOpenError"),
          );
          return;
        }
        await Linking.openURL(url);
      } catch {
        Alert.alert(
          getLocalizedText("notif.error"),
          getLocalizedText("about.legalOpenError"),
        );
      }
    },
    [getLocalizedText],
  );

  const onReportPress = useCallback(() => {
    if (Platform.OS === "web") {
      window.alert(getLocalizedText("about.reportComingSoon"));
      return;
    }
    Alert.alert(
      getLocalizedText("about.reportContent"),
      getLocalizedText("about.reportComingSoon"),
      [{ text: getLocalizedText("common.ok") }],
    );
  }, [getLocalizedText]);

  const { legalPrivacyUrl, legalTermsUrl } = getLegalExtra();

  const bodyStyle = [
    styles.bodyText,
    {
      color: themeColors.text.secondary,
      fontSize: getFontSize("base"),
      lineHeight: Math.round(getFontSize("base") * 1.45),
    },
  ];

  return (
    <LinearGradient
      colors={themeColors.background.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 32 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={__DEV__}
      >
        <View style={[styles.header, { paddingTop: 56 + insets.top }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={getLocalizedText("settings.title")}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              {
                color: themeColors.text.primary,
                fontSize: getFontSize("xxl"),
              },
            ]}
          >
            {getLocalizedText("about.title")}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={themeColors.primary}
              style={styles.sectionIcon}
            />
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: themeColors.text.primary,
                  fontSize: getFontSize("sm"),
                  letterSpacing: 0.8,
                },
              ]}
            >
              {getLocalizedText("about.sectionContentSecurity").toUpperCase()}
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: withOpacity(colors.background.darkCard, 0.88),
                borderColor: withOpacity(colors.secondary.main, 0.32),
              },
            ]}
          >
            <Text style={bodyStyle}>{getLocalizedText("about.p1")}</Text>
            <Text style={[bodyStyle, styles.paragraphGap]}>
              {getLocalizedText("about.p2")}
            </Text>
            <Text style={[bodyStyle, styles.paragraphGap]}>
              {getLocalizedText("about.p3")}
            </Text>

            <View
              style={[
                styles.callout,
                {
                  backgroundColor: withOpacity(colors.secondary.darker, 0.65),
                  borderColor: withOpacity(colors.primary.main, 0.28),
                },
              ]}
            >
              <Text
                style={[
                  styles.calloutText,
                  {
                    color: themeColors.text.secondary,
                    fontSize: getFontSize("sm"),
                    lineHeight: Math.round(getFontSize("sm") * 1.45),
                  },
                ]}
              >
                {getLocalizedText("about.reportCallout")}
              </Text>
            </View>

            <Text style={[bodyStyle, styles.paragraphGap]}>
              {getLocalizedText("about.p4")}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.legalButton,
              {
                backgroundColor: withOpacity(colors.background.darkCard, 0.92),
                borderColor: withOpacity(colors.secondary.main, 0.4),
              },
            ]}
            onPress={() => openLegalUrl(legalPrivacyUrl)}
            accessibilityRole="button"
          >
            <Ionicons
              name="open-outline"
              size={20}
              color={themeColors.primary}
            />
            <Text
              style={[
                styles.legalButtonLabel,
                {
                  color: themeColors.text.primary,
                  fontSize: getFontSize("base"),
                },
              ]}
            >
              {getLocalizedText("about.privacyPolicy")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.legalButton,
              {
                backgroundColor: withOpacity(colors.background.darkCard, 0.92),
                borderColor: withOpacity(colors.secondary.main, 0.4),
              },
            ]}
            onPress={() => openLegalUrl(legalTermsUrl)}
            accessibilityRole="button"
          >
            <Ionicons
              name="open-outline"
              size={20}
              color={themeColors.primary}
            />
            <Text
              style={[
                styles.legalButtonLabel,
                {
                  color: themeColors.text.primary,
                  fontSize: getFontSize("base"),
                },
              ]}
            >
              {getLocalizedText("about.termsOfUse")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reportButtonWrap}
            onPress={onReportPress}
            accessibilityRole="button"
            accessibilityHint={getLocalizedText("about.reportComingSoon")}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[colors.primary.dark, colors.primary.main]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.reportButton}
            >
              <Ionicons name="flag-outline" size={22} color="#FFFFFF" />
              <Text
                style={[
                  styles.reportButtonLabel,
                  { fontSize: getFontSize("lg") },
                ]}
              >
                {getLocalizedText("about.reportContent")}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backButton: { marginRight: 12 },
  headerTitle: { fontWeight: "700", flex: 1 },
  section: { marginTop: 8 },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionIcon: { marginRight: 8 },
  sectionTitle: { fontWeight: "700" },
  card: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
  },
  bodyText: {},
  paragraphGap: { marginTop: 14 },
  callout: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  calloutText: { fontStyle: "italic" },
  actions: { marginTop: 24, gap: 12 },
  legalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  legalButtonLabel: { fontWeight: "600", flex: 1 },
  reportButtonWrap: {
    borderRadius: 14,
    marginTop: 4,
    overflow: "hidden",
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  reportButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

export default AboutContentScreen;
