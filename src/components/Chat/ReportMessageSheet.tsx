/**
 * Wizard 2 étapes : signalement de message (WHISPR-174)
 * Palette Whispr + sheet animé (slide depuis le bas)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors, withOpacity } from "../../theme/colors";
import {
  submitContentReport,
  type ReportCategoryId,
} from "../../services/moderation/reportApi";
import type { MessageWithRelations } from "../../types/messaging";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.9;

/** Fond sheet : navy → violet (sans corail plein large — réservé aux CTA) */
const SHEET_GRADIENT = [
  colors.background.darkCard,
  colors.secondary.medium,
  colors.secondary.darker,
] as const;

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

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

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

  const animateOpen = useCallback(() => {
    slideY.setValue(SCREEN_H);
    backdropOp.setValue(0);
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }),
      Animated.timing(backdropOp, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideY, backdropOp]);

  const animateClose = useCallback(
    (done: () => void) => {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: SCREEN_H,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOp, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) done();
      });
    },
    [slideY, backdropOp],
  );

  useEffect(() => {
    if (visible && message) {
      animateOpen();
    }
  }, [visible, message?.id, animateOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- message id only

  const handleClose = useCallback(() => {
    animateClose(() => {
      reset();
      onClose();
    });
  }, [animateClose, reset, onClose]);

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

  const backdropStyle = {
    opacity: backdropOp.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.62],
    }),
  };

  if (!visible || !message) return null;

  return (
    <Modal
      visible={true}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdropTint, backdropStyle]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetOuter,
            {
              maxHeight: SHEET_MAX_H,
              paddingBottom: Math.max(insets.bottom, 12),
              transform: [{ translateY: slideY }],
            },
          ]}
        >
          <LinearGradient
            colors={[...SHEET_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={styles.sheetGradient}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
              style={styles.kav}
            >
              <View style={styles.handle} />
              {step === "success" ? (
                <View style={styles.centerBlock}>
                  <LinearGradient
                    colors={[colors.primary.light, colors.primary.main]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.successIconWrap}
                  >
                    <Ionicons name="checkmark" size={40} color="#0B1124" />
                  </LinearGradient>
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
                    <Ionicons
                      name="alert-circle"
                      size={18}
                      color={colors.ui.error}
                    />
                    <Text style={styles.errorBannerText}>
                      {getLocalizedText("report.errorBanner")}
                    </Text>
                  </View>
                  <View style={styles.errorIconWrap}>
                    <Ionicons
                      name="cloud-offline-outline"
                      size={36}
                      color={colors.secondary.light}
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
                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.textLink}
                  >
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
                  <Text
                    style={[
                      styles.stepBadge,
                      { color: colors.secondary.light },
                    ]}
                  >
                    {getLocalizedText("report.step1of2")}
                  </Text>
                  <Text
                    style={[
                      styles.labelSmall,
                      { color: colors.secondary.main },
                    ]}
                  >
                    {getLocalizedText("report.conversationLabel")} ·{" "}
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
                    keyboardShouldPersistTaps="handled"
                  >
                    {CATEGORY_ORDER.map((id) => {
                      const selected = category === id;
                      return (
                        <TouchableOpacity
                          key={id}
                          style={[
                            styles.catRow,
                            {
                              borderColor: selected
                                ? colors.primary.main
                                : withOpacity(colors.secondary.light, 0.35),
                              backgroundColor: selected
                                ? withOpacity(colors.primary.main, 0.14)
                                : withOpacity(colors.secondary.darker, 0.45),
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
                                : colors.secondary.light
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
                    style={styles.primaryBtn}
                  >
                    <LinearGradient
                      colors={
                        category
                          ? [colors.primary.main, colors.primary.dark]
                          : [
                              withOpacity(colors.secondary.medium, 0.55),
                              withOpacity(colors.secondary.dark, 0.75),
                            ]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.primaryBtnGrad}
                    >
                      <Text
                        style={[
                          styles.primaryBtnText,
                          !category && styles.primaryBtnTextMuted,
                        ]}
                      >
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
                  <Text
                    style={[
                      styles.stepBadge,
                      { color: colors.secondary.light },
                    ]}
                  >
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
                        backgroundColor: withOpacity(
                          colors.secondary.darker,
                          0.55,
                        ),
                        borderColor: withOpacity(colors.secondary.main, 0.4),
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
                    style={[
                      styles.attachBox,
                      {
                        borderColor: withOpacity(colors.primary.main, 0.4),
                        backgroundColor: withOpacity(
                          colors.secondary.darker,
                          0.35,
                        ),
                      },
                    ]}
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
                          <Ionicons
                            name="close-circle"
                            size={24}
                            color={colors.text.light}
                          />
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
                      <Text style={{ color: colors.secondary.light }}>
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
            </KeyboardAvoidingView>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropTint: {
    backgroundColor: "#0B1124",
  },
  sheetOuter: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
    marginHorizontal: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 24,
  },
  sheetGradient: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 6,
    minHeight: 300,
  },
  kav: { flexGrow: 0 },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: withOpacity(colors.secondary.light, 0.35),
    marginBottom: 14,
    marginTop: 4,
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
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: 0.3,
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
    marginBottom: 8,
    gap: 12,
  },
  catText: { flex: 1, fontSize: 16, fontWeight: "500" },
  disclaimer: {
    fontSize: 11,
    color: withOpacity(colors.text.light, 0.48),
    marginTop: 8,
    marginBottom: 12,
    lineHeight: 16,
  },
  primaryBtn: { borderRadius: 14, overflow: "hidden" },
  primaryBtnInline: { borderRadius: 14, overflow: "hidden", minWidth: 168 },
  primaryBtnGrad: {
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnGradSmall: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryBtnText: {
    color: "#0B1124",
    fontSize: 16,
    fontWeight: "700",
  },
  primaryBtnTextMuted: {
    color: withOpacity(colors.text.light, 0.72),
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: colors.primary.main,
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 10,
    backgroundColor: withOpacity(colors.ui.error, 0.16),
    borderWidth: 1,
    borderColor: withOpacity(colors.ui.error, 0.45),
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: colors.text.light,
    fontWeight: "600",
    flex: 1,
    fontSize: 14,
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: withOpacity(colors.secondary.main, 0.2),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  textLink: { marginTop: 12, padding: 8 },
});
