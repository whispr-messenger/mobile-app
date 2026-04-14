import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { colors, withOpacity } from "../../theme/colors";
import {
  submitModerationAppeal,
  type AppealReason,
} from "../../services/moderation/appealApi";

type Nav = StackNavigationProp<AuthStackParamList, "ModerationAppealForm">;
type FormRoute = RouteProp<AuthStackParamList, "ModerationAppealForm">;

const SCREEN_GRADIENT = colors.background.gradient.app;
const REASONS: Array<{ label: string; value: AppealReason }> = [
  { label: "Contexte incomplet", value: "context_incomplete" },
  { label: "Erreur de classification", value: "misclassification" },
  { label: "Usurpation / faux signalement", value: "false_report" },
  { label: "Autre", value: "other" },
];

export const ModerationAppealFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<FormRoute>();
  const [reason, setReason] = useState<AppealReason>(REASONS[0].value);
  const [description, setDescription] = useState("");
  const [fakeAttachmentName, setFakeAttachmentName] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => description.trim().length >= 8 && !loading,
    [description, loading],
  );

  const onSubmit = async () => {
    if (!canSubmit) return;
    setErrorText(null);
    setLoading(true);
    try {
      const result = await submitModerationAppeal({
        decisionId: route.params.decisionId,
        reason,
        description,
        attachmentFileName: fakeAttachmentName ?? undefined,
      });
      navigation.navigate("ModerationAppealSubmitted", {
        appealId: result.appealId,
        decisionId: route.params.decisionId,
        status: result.status,
      });
    } catch (error) {
      const e = error as Error & { status?: number };
      if (e.status === 429) {
        setErrorText("Trop de tentatives. Merci de réessayer plus tard.");
      } else if (e.status === 400) {
        setErrorText("La contestation est invalide ou expirée.");
      } else {
        setErrorText("Impossible d'envoyer votre contestation.");
      }
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.headerTitle}>Contester la décision</Text>
          <Text style={styles.brand}>Whispr</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Nous sommes à l’écoute.</Text>
          <Text style={styles.subtitle}>
            Si vous estimez qu’une erreur a été commise, détaillez votre
            situation ci-dessous. Notre équipe examinera votre demande avec
            soin.
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>MOTIF DE LA CONTESTATION</Text>
            <TouchableOpacity style={styles.inputLike} activeOpacity={0.75}>
              <Text style={styles.inputLikeText}>
                {REASONS.find((item) => item.value === reason)?.label ??
                  "Autre"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={colors.primary.main}
              />
            </TouchableOpacity>
            <View style={styles.reasonChips}>
              {REASONS.map((item) => {
                const selected = item.value === reason;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.reasonChip,
                      selected && styles.reasonChipSelected,
                    ]}
                    onPress={() => setReason(item.value)}
                  >
                    <Text
                      style={[
                        styles.reasonChipText,
                        selected && styles.reasonChipTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>DESCRIPTION DÉTAILLÉE</Text>
            <TextInput
              multiline
              placeholder="Expliquez pourquoi vous pensez qu'il s'agit d'une erreur..."
              placeholderTextColor={withOpacity(colors.text.light, 0.42)}
              value={description}
              onChangeText={setDescription}
              style={styles.textArea}
              maxLength={1200}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>PIÈCE JOINTE (OPTIONNELLE)</Text>
            <TouchableOpacity
              style={styles.uploadBox}
              onPress={() =>
                setFakeAttachmentName((prev) =>
                  prev ? null : "capture-argumentation.png",
                )
              }
              activeOpacity={0.78}
            >
              <Ionicons
                name={
                  fakeAttachmentName
                    ? "document-attach"
                    : "cloud-upload-outline"
                }
                size={20}
                color={colors.primary.main}
              />
              <Text style={styles.uploadText}>
                {fakeAttachmentName ?? "Cliquez pour ajouter un fichier"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.delayInfo}>
            <View style={styles.delayIconWrap}>
              <Ionicons
                name="information-circle"
                size={22}
                color={colors.primary.main}
              />
            </View>
            <View style={styles.delayTextCol}>
              <Text style={styles.delayTitle}>Délai de traitement</Text>
              <Text style={styles.delayBody}>
                Les contestations sont généralement traitées sous 48 à 72 heures
                ouvrées par nos modérateurs humains.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {errorText ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={colors.ui.error} />
              <Text style={styles.errorText}>{errorText}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && { opacity: 0.5 }]}
            disabled={!canSubmit}
            onPress={onSubmit}
          >
            <LinearGradient
              colors={[colors.primary.light, colors.primary.main]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtnGrad}
            >
              {loading ? (
                <ActivityIndicator color="#0B1124" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  Envoyer la contestation
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryBtnText}>Retour</Text>
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
    marginBottom: 18,
  },
  iconBtn: { width: 28, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.text.light, fontSize: 15, fontWeight: "700" },
  brand: { color: colors.primary.main, fontSize: 16, fontWeight: "800" },
  scrollContent: { paddingBottom: 18, gap: 16 },
  title: {
    color: colors.text.light,
    fontSize: 36,
    lineHeight: 38,
    fontWeight: "900",
    maxWidth: "82%",
  },
  subtitle: {
    color: withOpacity(colors.text.light, 0.85),
    fontSize: 16,
    lineHeight: 24,
  },
  section: { gap: 8 },
  label: {
    color: withOpacity(colors.text.light, 0.56),
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "700",
  },
  inputLike: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withOpacity(colors.text.light, 0.1),
    backgroundColor: withOpacity("#0B1124", 0.5),
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputLikeText: { color: colors.text.light, fontSize: 15, fontWeight: "600" },
  reasonChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withOpacity(colors.text.light, 0.12),
    backgroundColor: withOpacity("#0B1124", 0.35),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reasonChipSelected: {
    borderColor: withOpacity(colors.primary.main, 0.46),
    backgroundColor: withOpacity(colors.primary.main, 0.16),
  },
  reasonChipText: { color: withOpacity(colors.text.light, 0.86), fontSize: 12 },
  reasonChipTextSelected: { color: colors.primary.light, fontWeight: "700" },
  textArea: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withOpacity(colors.text.light, 0.12),
    backgroundColor: withOpacity("#0B1124", 0.5),
    minHeight: 132,
    color: colors.text.light,
    paddingHorizontal: 14,
    paddingVertical: 14,
    textAlignVertical: "top",
    fontSize: 15,
    lineHeight: 21,
  },
  uploadBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withOpacity(colors.primary.main, 0.22),
    borderStyle: "dashed",
    backgroundColor: withOpacity("#0B1124", 0.42),
    minHeight: 94,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadText: { color: withOpacity(colors.text.light, 0.75), fontSize: 14 },
  delayInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withOpacity(colors.text.light, 0.1),
    backgroundColor: withOpacity("#0B1124", 0.55),
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  delayIconWrap: { paddingTop: 2 },
  delayTextCol: { flex: 1, gap: 6 },
  delayTitle: {
    color: colors.text.light,
    fontSize: 14,
    fontWeight: "700",
  },
  delayBody: {
    color: withOpacity(colors.text.light, 0.78),
    fontSize: 13,
    lineHeight: 19,
  },
  footer: { gap: 10, paddingTop: 8 },
  errorBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withOpacity(colors.ui.error, 0.45),
    backgroundColor: withOpacity(colors.ui.error, 0.12),
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    color: withOpacity(colors.text.light, 0.92),
    flex: 1,
    fontSize: 13,
  },
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

export default ModerationAppealFormScreen;
