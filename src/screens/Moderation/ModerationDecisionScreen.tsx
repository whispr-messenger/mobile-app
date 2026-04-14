import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { colors, withOpacity } from "../../theme/colors";

type Nav = StackNavigationProp<AuthStackParamList, "ModerationDecision">;
type DecisionRoute = RouteProp<AuthStackParamList, "ModerationDecision">;

const SCREEN_GRADIENT = colors.background.gradient.app;

export const ModerationDecisionScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DecisionRoute>();
  const details = {
    decisionId: route.params?.decisionId ?? "WH-8902",
    sanctionType: route.params?.sanctionType ?? "Avertissement",
    reasonLabel: route.params?.reasonLabel ?? "Spam",
    incidentDate: route.params?.incidentDate ?? "12 Octobre 2023",
    deadlineDate: route.params?.deadlineDate ?? "26 Octobre 2023",
    reference: route.params?.reference ?? "WH-8902",
  };

  return (
    <LinearGradient
      colors={[
        SCREEN_GRADIENT[0],
        SCREEN_GRADIENT[1],
        withOpacity(SCREEN_GRADIENT[2], 0.86),
      ]}
      locations={[0, 0.55, 1]}
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

        <Text style={styles.pageTitle}>Decision de moderation</Text>

        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>ACTION REQUISE</Text>
            </View>
            <Text style={styles.refText}>REF #{details.reference}</Text>
          </View>

          <View style={styles.twoCols}>
            <View style={styles.col}>
              <Text style={styles.label}>TYPE DE SANCTION</Text>
              <Text style={styles.value}>{details.sanctionType}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>MOTIF</Text>
              <Text style={styles.value}>{details.reasonLabel}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={colors.primary.main}
            />
            <View>
              <Text style={styles.label}>DATE DE L'INCIDENT</Text>
              <Text style={styles.valueSmall}>{details.incidentDate}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Ionicons
              name="time-outline"
              size={16}
              color={colors.primary.main}
            />
            <View>
              <Text style={styles.label}>ECHEANCE CONTESTATION</Text>
              <Text style={styles.valueSmall}>{details.deadlineDate}</Text>
            </View>
          </View>

          <Text style={styles.hint}>
            Vous pouvez contester cette decision jusqu'au {details.deadlineDate}{" "}
            si vous estimez qu'il s'agit d'une erreur.
          </Text>
        </View>

        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              navigation.navigate("ModerationAppealForm", {
                decisionId: details.decisionId,
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
              <Text style={styles.primaryBtnText}>Contester</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  iconBtn: { width: 28, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    color: colors.text.light,
    fontSize: 15,
    fontWeight: "700",
  },
  pageTitle: {
    color: colors.text.light,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    marginBottom: 16,
  },
  card: {
    backgroundColor: withOpacity("#0B1124", 0.52),
    borderWidth: 1,
    borderColor: withOpacity("#FFFFFF", 0.08),
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    borderRadius: 999,
    backgroundColor: withOpacity(colors.primary.main, 0.14),
    borderWidth: 1,
    borderColor: withOpacity(colors.primary.main, 0.38),
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: colors.primary.light, fontSize: 10, fontWeight: "700" },
  refText: {
    color: withOpacity(colors.text.light, 0.75),
    fontSize: 11,
    fontWeight: "600",
  },
  twoCols: { flexDirection: "row", gap: 14 },
  col: { flex: 1, gap: 4 },
  label: {
    color: withOpacity(colors.text.light, 0.55),
    fontSize: 10,
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  value: { color: colors.text.light, fontSize: 16, fontWeight: "700" },
  valueSmall: { color: colors.text.light, fontSize: 14, fontWeight: "600" },
  metaRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  hint: {
    color: withOpacity(colors.text.light, 0.74),
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  footerActions: { marginTop: "auto", paddingTop: 16, gap: 10 },
  primaryBtn: { borderRadius: 999, overflow: "hidden" },
  primaryBtnGrad: { alignItems: "center", paddingVertical: 15 },
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

export default ModerationDecisionScreen;
