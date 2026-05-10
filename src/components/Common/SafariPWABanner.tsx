/**
 * SafariPWABanner - Banner non-intrusif pour Safari iOS PWA (WHISPR-1437).
 *
 * Detecte Safari iOS en mode web et affiche un banner "Install l'app native"
 * pour remedier a l'absence de web push notifications.
 * Dismissible avec TTL 7 jours en AsyncStorage.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { colors, withOpacity } from "../../theme/colors";

const DISMISSED_KEY = "@whispr/dismissed_pwa_install";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

/** Detecte Safari iOS (iPhone/iPad, Safari, pas Chrome iOS ni Firefox iOS) */
function isSafariIOS(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

async function shouldShowBanner(): Promise<boolean> {
  if (!isSafariIOS()) return false;
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    if (!raw) return true;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return true;
    return Date.now() - ts > DISMISS_TTL_MS;
  } catch {
    return true;
  }
}

async function dismissBanner(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // silencieux
  }
}

// --- Instructions sheet ---

interface InstructionsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const InstructionsSheet: React.FC<InstructionsSheetProps> = ({
  visible,
  onClose,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    statusBarTranslucent
    onRequestClose={onClose}
  >
    <View style={sheet.root}>
      <Pressable style={sheet.backdrop} onPress={onClose} />
      <View style={sheet.container}>
        <View style={sheet.handle} />
        <Text style={sheet.title}>Installer Whispr sur iPhone</Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sheet.stepsContainer}
        >
          {STEPS.map((step, i) => (
            <View key={i} style={sheet.step}>
              <View style={sheet.stepNumber}>
                <Text style={sheet.stepNumberText}>{i + 1}</Text>
              </View>
              <View style={sheet.stepTextWrap}>
                <Text style={sheet.stepText}>{step.text}</Text>
                {step.icon && (
                  <Ionicons
                    name={step.icon}
                    size={18}
                    color={colors.primary.main}
                    style={sheet.stepIcon}
                  />
                )}
              </View>
            </View>
          ))}
          <View style={sheet.tip}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={withOpacity(colors.text.light, 0.5)}
            />
            <Text style={sheet.tipText}>
              Une fois installe, tu recevras les notifications en temps reel
              depuis l'app native.
            </Text>
          </View>
        </ScrollView>
        <TouchableOpacity style={sheet.closeBtn} onPress={onClose}>
          <Text style={sheet.closeBtnText}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const STEPS: Array<{
  text: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}> = [
  {
    text: "Appuie sur le bouton Partager en bas de Safari",
    icon: "share-outline",
  },
  {
    text: "Fais defiler et choisis \"Sur l'ecran d'accueil\"",
    icon: "add-square-outline",
  },
  {
    text: 'Appuie sur "Ajouter" en haut a droite',
  },
  {
    text: "Lance Whispr depuis ton ecran d'accueil",
    icon: "rocket-outline",
  },
];

// --- Main banner ---

export const SafariPWABanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    shouldShowBanner().then((show) => {
      if (!cancelled) setVisible(show);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = useCallback(async () => {
    setVisible(false);
    await dismissBanner();
  }, []);

  const handleCTA = useCallback(() => {
    setSheetOpen(true);
  }, []);

  if (!visible) return null;

  return (
    <>
      <View style={styles.banner}>
        <Ionicons
          name="notifications-outline"
          size={18}
          color={colors.primary.main}
          style={styles.bellIcon}
        />
        <Text style={styles.bannerText} numberOfLines={2}>
          Recois tes notifications en temps reel — installe l'app native sur ton
          iPhone.
        </Text>
        <TouchableOpacity
          onPress={handleCTA}
          style={styles.ctaButton}
          accessibilityRole="button"
          accessibilityLabel="Voir comment installer l'app"
        >
          <Text style={styles.ctaText}>Installer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.dismissButton}
          accessibilityRole="button"
          accessibilityLabel="Fermer le banner"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="close-outline"
            size={18}
            color={withOpacity(colors.text.light, 0.5)}
          />
        </TouchableOpacity>
      </View>
      <InstructionsSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 25, 50, 0.95)",
    borderTopWidth: 1,
    borderTopColor: withOpacity(colors.primary.main, 0.3),
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  bellIcon: {
    flexShrink: 0,
  },
  bannerText: {
    flex: 1,
    color: withOpacity(colors.text.light, 0.85),
    fontSize: 12,
    lineHeight: 16,
  },
  ctaButton: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary.main,
    flexShrink: 0,
  },
  ctaText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: "700",
  },
  dismissButton: {
    flexShrink: 0,
    marginLeft: 2,
  },
});

const sheet = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 17, 36, 0.6)",
  },
  container: {
    backgroundColor: "rgba(20, 25, 50, 0.98)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: withOpacity(colors.text.light, 0.2),
    marginTop: 8,
    marginBottom: 4,
  },
  title: {
    color: colors.text.light,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginVertical: 16,
    paddingHorizontal: 24,
  },
  stepsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 16,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: withOpacity(colors.primary.main, 0.2),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumberText: {
    color: colors.primary.main,
    fontSize: 13,
    fontWeight: "700",
  },
  stepTextWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  stepText: {
    color: withOpacity(colors.text.light, 0.85),
    fontSize: 14,
    lineHeight: 20,
  },
  stepIcon: {
    marginLeft: 4,
  },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: withOpacity(colors.text.light, 0.05),
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  tipText: {
    flex: 1,
    color: withOpacity(colors.text.light, 0.5),
    fontSize: 12,
    lineHeight: 17,
  },
  closeBtn: {
    marginHorizontal: 24,
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: withOpacity(colors.text.light, 0.08),
    alignItems: "center",
  },
  closeBtnText: {
    color: withOpacity(colors.text.light, 0.7),
    fontSize: 15,
    fontWeight: "600",
  },
});
