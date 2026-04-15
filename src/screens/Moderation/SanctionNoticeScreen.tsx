/**
 * SanctionNoticeScreen - Ecran de notification de sanction
 * Full-screen notice displayed when a user receives a sanction (warning/ban)
 */

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  useNavigation,
  useRoute,
  RouteProp,
  useFocusEffect,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import type { UserSanction, SanctionType } from "../../types/moderation";

type RouteParams = {
  SanctionNotice: { sanction: UserSanction };
};

interface SanctionConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  dismissible: boolean;
}

const SANCTION_CONFIG: Record<SanctionType, SanctionConfig> = {
  warning: {
    icon: "warning",
    color: "#F5A623",
    title: "Avertissement",
    dismissible: true,
  },
  temp_ban: {
    icon: "ban",
    color: "#FF3B30",
    title: "Suspension temporaire",
    dismissible: false,
  },
  perm_ban: {
    icon: "close-circle",
    color: "#FF3B30",
    title: "Bannissement permanent",
    dismissible: false,
  },
};

const formatExpiryInfo = (expiresAt: string | null): string => {
  if (!expiresAt) {
    return "Permanent";
  }

  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "Expiré";
  }

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffDays > 1) {
    return `Expire dans ${diffDays} jours`;
  }
  if (diffHours > 1) {
    return `Expire dans ${diffHours} heures`;
  }
  return "Expire bientôt";
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const SanctionNoticeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "SanctionNotice">>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { sanction } = route.params;

  const config = useMemo(
    () => SANCTION_CONFIG[sanction.type] || SANCTION_CONFIG.warning,
    [sanction.type],
  );
  const expiryText = useMemo(
    () => formatExpiryInfo(sanction.expiresAt),
    [sanction.expiresAt],
  );
  const isBan = sanction.type === "temp_ban" || sanction.type === "perm_ban";

  // Block hardware back button for bans
  useFocusEffect(
    React.useCallback(() => {
      if (!isBan) return;

      const onBackPress = () => {
        // Prevent going back when banned
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [isBan]),
  );

  const handleDismiss = () => {
    if (config.dismissible) {
      navigation.goBack();
    }
  };

  const handleContestDecision = () => {
    navigation.navigate("AppealForm", { sanction });
  };

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.content}>
          {/* Warning Icon */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: config.color + "20" },
            ]}
          >
            <Ionicons name={config.icon} size={64} color={config.color} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: config.color }]}>
            {config.title}
          </Text>

          {/* Sanction Details Card */}
          <View
            style={[
              styles.detailsCard,
              { backgroundColor: themeColors.background.secondary },
            ]}
          >
            {/* Reason */}
            <View style={styles.detailRow}>
              <Text
                style={[
                  styles.detailLabel,
                  { color: themeColors.text.tertiary },
                ]}
              >
                Raison
              </Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: themeColors.text.primary },
                ]}
              >
                {sanction.reason}
              </Text>
            </View>

            {/* Separator */}
            <View
              style={[
                styles.separator,
                { backgroundColor: themeColors.text.tertiary + "20" },
              ]}
            />

            {/* Date */}
            <View style={styles.detailRow}>
              <Text
                style={[
                  styles.detailLabel,
                  { color: themeColors.text.tertiary },
                ]}
              >
                Date
              </Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: themeColors.text.secondary },
                ]}
              >
                {formatDate(sanction.createdAt)}
              </Text>
            </View>

            {/* Separator */}
            <View
              style={[
                styles.separator,
                { backgroundColor: themeColors.text.tertiary + "20" },
              ]}
            />

            {/* Expiry */}
            <View style={styles.detailRow}>
              <Text
                style={[
                  styles.detailLabel,
                  { color: themeColors.text.tertiary },
                ]}
              >
                Durée
              </Text>
              <View style={styles.expiryRow}>
                <Ionicons
                  name={
                    sanction.expiresAt ? "timer-outline" : "infinite-outline"
                  }
                  size={16}
                  color={config.color}
                />
                <Text style={[styles.expiryText, { color: config.color }]}>
                  {expiryText}
                </Text>
              </View>
            </View>
          </View>

          {/* Info Text */}
          {isBan && (
            <View style={styles.infoBox}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={themeColors.text.tertiary}
              />
              <Text
                style={[styles.infoText, { color: themeColors.text.tertiary }]}
              >
                {sanction.type === "perm_ban"
                  ? "Votre compte a été définitivement suspendu. Vous pouvez contester cette décision."
                  : "Votre accès à l'application est temporairement restreint."}
              </Text>
            </View>
          )}

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Contest Button */}
          <TouchableOpacity
            style={[
              styles.contestButton,
              { backgroundColor: colors.primary.main },
            ]}
            onPress={handleContestDecision}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
            <Text style={styles.contestButtonText}>
              Contester cette décision
            </Text>
          </TouchableOpacity>

          {/* Dismiss Button (only for warnings) */}
          {config.dismissible && (
            <TouchableOpacity
              style={[
                styles.dismissButton,
                { borderColor: themeColors.text.tertiary + "40" },
              ]}
              onPress={handleDismiss}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dismissButtonText,
                  { color: themeColors.text.secondary },
                ]}
              >
                J'ai compris
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: "center",
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 24,
  },
  detailsCard: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  detailRow: {
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    lineHeight: 22,
  },
  separator: {
    height: 1,
    marginVertical: 4,
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  expiryText: {
    fontSize: 16,
    fontWeight: "600",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  contestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  contestButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  dismissButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 16,
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
