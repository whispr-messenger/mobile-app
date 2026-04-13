/**
 * Wizard 2 étapes : signalement de message (WHISPR-174)
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import {
  submitContentReport,
  type ReportCategoryId,
} from "../../services/moderation/reportApi";
import type { MessageWithRelations } from "../../types/messaging";

const SHEET_MAX_H = Dimensions.get("window").height * 0.92;

const CATEGORY_ORDER: ReportCategoryId[] = [
  "offensive",
  "spam",
  "nudity",
  "violence",
  "harassment",
  "other",
];

const CATEGORY_ICONS: Record<
  ReportCategoryId,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  offensive: "sad-outline",
  spam: "warning-outline",
  nudity: "eye-off-outline",
  violence: "hammer-outline",
  harassment: "person-remove-outline",
  other: "ellipsis-horizontal-circle-outline",
};

type WizardStep = 1 | 2 | "success" | "error";

export interface ReportMessageSheetProps {
  visible: boolean;
  message: MessageWithRelations | null;
  conversationId: string;
  conversationTitle: string;
  onClose: () => void;
}

export const ReportMessageSheet: React.FC<ReportMessageSheetProps> = ({
  visible,
  message,
  conversationId,
  conversationTitle,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { getThemeColors, getLocalizedText, getFontSize } = useTheme();
  const themeColors = getThemeColors();

  const [step, setStep] = useState<WizardStep>(1);
  const [category, setCategory] = useState<ReportCategoryId | null>(null);
  const [description, setDescription] = useState("");
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setCategory(null);
    setDescription("");
    setAttachmentUri(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) reset();
  }, [visible, message?.id, reset]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setAttachmentUri(result.assets[0].uri);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!message || !category) return;
    setLoading(true);
    try {
      /* Pièce jointe (attachmentUri): prévisualisation locale — envoi multipart à brancher côté API. */
      const res = await submitContentReport({
        conversationId,
        messageId: message.id,
        category,
        description: description.trim() || undefined,
      });
      if (res.ok) {
        setStep("success");
      } else {
        setStep("error");
      }
    } catch {
      setStep("error");
    } finally {
      setLoading(false);
    }
  }, [message, category, conversationId, description]);

  const catLabel = (id: ReportCategoryId) =>
    getLocalizedText(`report.category.${id}`);

  if (!visible || !message) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View
          style={[
            styles.sheetWrap,
            { maxHeight: SHEET_MAX_H, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(26, 31, 58, 0.98)",
              colors.secondary.darker,
              "rgba(17, 31, 75, 0.99)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheet}
          >
            <View style={styles.handle} />
            {step === "success" ? (
              <View style={styles.centerBlock}>
                <View style={styles.successIconWrap}>
                  <Ionicons name="checkmark" size={40} color="#0B1124" />
                </View>
                <Text
                  style={[
                    styles.title,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("xl"),
                    },
                  ]}
                >
                  {getLocalizedText("report.successTitle")}
                </Text>
                <Text
                  style={[styles.body, { color: themeColors.text.secondary }]}
                >
                  {getLocalizedText("report.successBody")}
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleClose}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[colors.primary.main, colors.primary.dark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryBtnGrad}
                  >
                    <Text style={styles.primaryBtnText}>
                      {getLocalizedText("common.ok")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : step === "error" ? (
              <View style={styles.centerBlock}>
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={18} color="#fff" />
                  <Text style={styles.errorBannerText}>
                    {getLocalizedText("report.errorBanner")}
                  </Text>
                </View>
                <View style={styles.errorIconWrap}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={36}
                    color={colors.primary.main}
                  />
                </View>
                <Text
                  style={[
                    styles.title,
                    {
                      color: themeColors.text.primary,
                      fontSize: getFontSize("xl"),
                    },
                  ]}
                >
                  {getLocalizedText("report.errorTitle")}
                </Text>
                <Text
                  style={[styles.body, { color: themeColors.text.secondary }]}
                >
                  {getLocalizedText("report.errorBody")}
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => setStep(2)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[colors.primary.main, colors.primary.dark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryBtnGrad}
                  >
                    <Text style={styles.primaryBtnText}>
                      {getLocalizedText("common.retry")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClose} style={styles.textLink}>
                  <Text style={{ color: themeColors.text.tertiary }}>
                    {getLocalizedText("common.cancel")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : step === 1 ? (
              <>
                <View style={styles.headerRow}>
                  <TouchableOpacity onPress={handleClose} hitSlop={12}>
                    <Ionicons
                      name="close"
                      size={26}
                      color={themeColors.text.secondary}
                    />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.headerTitle,
                      { color: themeColors.text.primary },
                    ]}
                  >
                    {getLocalizedText("report.sheetTitle")}
                  </Text>
                  <View style={{ width: 26 }} />
                </View>
                <Text style={styles.stepBadge}>
                  {getLocalizedText("report.step1of2")}
                </Text>
                <Text
                  style={[styles.labelSmall, { color: colors.primary.main }]}
                >
                  {getLocalizedText("report.conversationLabel")}{" "}
                  {conversationTitle}
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    { color: themeColors.text.secondary },
                  ]}
                >
                  {getLocalizedText("report.step1Subtitle")}
                </Text>
                <ScrollView
                  style={styles.scroll}
                  showsVerticalScrollIndicator={false}
                >
                  {CATEGORY_ORDER.map((id) => {
                    const selected = category === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[
                          styles.catRow,
                          selected && {
                            borderColor: colors.primary.main,
                            backgroundColor: "rgba(254, 122, 92, 0.12)",
                          },
                        ]}
                        onPress={() => setCategory(id)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={CATEGORY_ICONS[id]}
                          size={22}
                          color={
                            selected
                              ? colors.primary.main
                              : themeColors.text.secondary
                          }
                        />
                        <Text
                          style={[
                            styles.catText,
                            { color: themeColors.text.primary },
                          ]}
                        >
                          {catLabel(id)}
                        </Text>
                        {selected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={colors.primary.main}
                          />
                        ) : (
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={themeColors.text.tertiary}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={styles.disclaimer}>
                  {getLocalizedText("report.disclaimer")}
                </Text>
                <TouchableOpacity
                  disabled={!category}
                  onPress={() => setStep(2)}
                  activeOpacity={0.85}
                  style={[styles.primaryBtn, !category && styles.btnDisabled]}
                >
                  <LinearGradient
                    colors={
                      category
                        ? [colors.primary.main, colors.primary.dark]
                        : ["#555", "#444"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryBtnGrad}
                  >
                    <Text style={styles.primaryBtnText}>
                      {getLocalizedText("report.continue")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.headerRow}>
                  <TouchableOpacity onPress={() => setStep(1)} hitSlop={12}>
                    <Ionicons
                      name="arrow-back"
                      size={24}
                      color={themeColors.text.secondary}
                    />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.headerTitle,
                      { color: themeColors.text.primary },
                    ]}
                  >
                    {getLocalizedText("report.step2Header")}
                  </Text>
                  <TouchableOpacity onPress={handleClose} hitSlop={12}>
                    <Ionicons
                      name="close"
                      size={26}
                      color={themeColors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.stepBadge}>
                  {getLocalizedText("report.step2of2")}
                </Text>
                <Text
                  style={[
                    styles.fieldLabel,
                    { color: themeColors.text.tertiary },
                  ]}
                >
                  {getLocalizedText("report.additionalDetails")}
                </Text>
                <TextInput
                  style={[
                    styles.textArea,
                    {
                      color: themeColors.text.primary,
                      borderColor: "rgba(255,255,255,0.12)",
                    },
                  ]}
                  placeholder={getLocalizedText("report.placeholder")}
                  placeholderTextColor={themeColors.text.tertiary}
                  multiline
                  value={description}
                  onChangeText={setDescription}
                  maxLength={2000}
                />
                <Text
                  style={[
                    styles.fieldLabel,
                    { color: themeColors.text.tertiary, marginTop: 12 },
                  ]}
                >
                  {getLocalizedText("report.attachOptional")}
                </Text>
                <TouchableOpacity
                  style={styles.attachBox}
                  onPress={pickImage}
                  activeOpacity={0.75}
                >
                  {attachmentUri ? (
                    <View style={styles.attachPreview}>
                      <Image
                        source={{ uri: attachmentUri }}
                        style={styles.attachThumb}
                      />
                      <TouchableOpacity
                        style={styles.removeAttach}
                        onPress={() => setAttachmentUri(null)}
                      >
                        <Ionicons name="close-circle" size={24} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Ionicons
                        name="image-outline"
                        size={28}
                        color={colors.primary.main}
                      />
                      <Text
                        style={{
                          color: themeColors.text.secondary,
                          marginTop: 6,
                        }}
                      >
                        {getLocalizedText("report.attachHint")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => setStep(1)}>
                    <Text style={{ color: themeColors.text.tertiary }}>
                      {getLocalizedText("report.back")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtnInline}
                    onPress={submit}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[colors.primary.main, colors.primary.dark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.primaryBtnGradSmall}
                    >
                      {loading ? (
                        <ActivityIndicator color="#0B1124" />
                      ) : (
                        <Text style={styles.primaryBtnText}>
                          {getLocalizedText("report.send")}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheetWrap: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    marginTop: "auto",
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    minHeight: 320,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  stepBadge: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.primary.main,
    marginBottom: 6,
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 12,
  },
  scroll: { maxHeight: 280 },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
    gap: 12,
  },
  catText: { flex: 1, fontSize: 16, fontWeight: "500" },
  disclaimer: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    marginTop: 8,
    marginBottom: 12,
  },
  primaryBtn: { borderRadius: 14, overflow: "hidden" },
  primaryBtnInline: { borderRadius: 14, overflow: "hidden", minWidth: 160 },
  btnDisabled: { opacity: 0.5 },
  primaryBtnGrad: {
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnGradSmall: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#0B1124",
    fontSize: 16,
    fontWeight: "700",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
  attachBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(254, 122, 92, 0.45)",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  attachPreview: { position: "relative" },
  attachThumb: { width: 120, height: 120, borderRadius: 8 },
  removeAttach: {
    position: "absolute",
    top: -8,
    right: -8,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
  },
  centerBlock: { paddingVertical: 16, alignItems: "center" },
  title: { fontWeight: "700", textAlign: "center", marginBottom: 8 },
  body: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 20 },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary.main,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: colors.primary.main,
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 8,
    backgroundColor: "rgba(255, 59, 48, 0.9)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorBannerText: { color: "#fff", fontWeight: "600", flex: 1 },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  textLink: { marginTop: 12, padding: 8 },
});
