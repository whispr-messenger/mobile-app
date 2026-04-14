import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { colors, withOpacity } from "../../theme/colors";

type Nav = StackNavigationProp<AuthStackParamList, "ModerationAppealSubmitted">;
type SubmittedRoute = RouteProp<
  AuthStackParamList,
  "ModerationAppealSubmitted"
>;

const SCREEN_GRADIENT = colors.background.gradient.app;

function formatAppealStatusFr(status?: string): string {
  if (!status) return "REÇUE";
  const s = status.toLowerCase();
  if (s === "received") return "REÇUE";
  return status.toUpperCase().replace(/_/g, " ");
}

export const ModerationAppealSubmittedScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<SubmittedRoute>();
  const statusLabel = formatAppealStatusFr(route.params.status);

  return (
    <LinearGradient
      colors={[
        SCREEN_GRADIENT[0],
        SCREEN_GRADIENT[1],
        withOpacity(SCREEN_GRADIENT[2], 0.84),
      ]}
      locations={[0, 0.62, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text.light} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contestations</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successWrap}>
            <View style={styles.successCircle}>
              <Ionicons
                name="checkmark"
                size={34}
                color={colors.primary.main}
              />
            </View>
            <Text style={styles.title}>Demande envoyée</Text>
            <Text style={styles.subtitle}>
              Votre demande n°{route.params.appealId} a été reçue. Nos
              modérateurs vous répondront sous 48 h.
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{statusLabel}</Text>
            </View>
          </View>

          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>SUIVI DU TRAITEMENT</Text>
            <View style={styles.timelineRow}>
              <View style={styles.stepCol}>
                <View style={[styles.stepDot, styles.stepDotActive]}>
                  <Ionicons name="checkmark" size={11} color="#0B1124" />
                </View>
                <Text style={[styles.stepLabel, styles.stepLabelActive]}>
                  REÇUE
                </Text>
              </View>
              <View style={styles.stepLine} />
              <View style={styles.stepCol}>
                <View style={styles.stepDot} />
                <Text style={styles.stepLabel}>EN COURS</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={styles.stepCol}>
                <View style={styles.stepDot} />
                <Text style={styles.stepLabel}>TRAITÉE</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              navigation.navigate("ModerationDecision", {
                decisionId: route.params.decisionId,
                reference: route.params.decisionId,
              })
            }
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.primary.light, colors.primary.main]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtnGrad}
            >
              <Text style={styles.primaryBtnText}>Suivre ma contestation</Text>
              <Ionicons name="arrow-forward" size={18} color="#0B1124" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate("ConversationsList")}
          >
            <Text style={styles.secondaryBtnText}>
              Retour à la conversation
            </Text>
          </TouchableOpacity>

          <Text style={styles.securityFooter}>
            WHISPR SECURITY PROTOCOLS © 2026
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 12, flexGrow: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  iconBtn: { width: 28, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.text.light, fontSize: 16, fontWeight: "700" },
  successWrap: { alignItems: "center", marginTop: 6, gap: 12 },
  successCircle: {
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 2,
    borderColor: withOpacity(colors.primary.main, 0.42),
    backgroundColor: withOpacity(colors.primary.main, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.text.light,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 4,
  },
  subtitle: {
    color: withOpacity(colors.text.light, 0.86),
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: "92%",
  },
  badge: {
    marginTop: 2,
    borderRadius: 999,
    backgroundColor: withOpacity(colors.primary.main, 0.14),
    borderWidth: 1,
    borderColor: withOpacity(colors.primary.main, 0.4),
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    color: colors.primary.light,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  timelineCard: {
    marginTop: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: withOpacity(colors.text.light, 0.1),
    backgroundColor: withOpacity("#0B1124", 0.48),
    padding: 16,
    gap: 18,
  },
  timelineTitle: {
    color: withOpacity(colors.text.light, 0.78),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.9,
  },
  timelineRow: { flexDirection: "row", alignItems: "center" },
  stepCol: { alignItems: "center", gap: 8 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: withOpacity(colors.text.light, 0.2),
    backgroundColor: withOpacity("#0B1124", 0.5),
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    borderColor: withOpacity(colors.primary.main, 0.65),
    backgroundColor: colors.primary.main,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: withOpacity(colors.primary.main, 0.36),
    marginHorizontal: 8,
  },
  stepLabel: {
    color: withOpacity(colors.text.light, 0.68),
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  stepLabelActive: { color: colors.primary.light },
  footer: { marginTop: "auto", gap: 10, paddingTop: 8 },
  securityFooter: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 10,
    letterSpacing: 0.6,
    fontWeight: "600",
    color: withOpacity(colors.text.light, 0.38),
  },
  primaryBtn: { borderRadius: 999, overflow: "hidden" },
  primaryBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
  },
  primaryBtnText: { color: "#0B1124", fontSize: 17, fontWeight: "800" },
  secondaryBtn: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withOpacity(colors.text.light, 0.12),
    paddingVertical: 13,
    backgroundColor: withOpacity("#0B1124", 0.34),
  },
  secondaryBtnText: {
    color: withOpacity(colors.text.light, 0.9),
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ModerationAppealSubmittedScreen;
