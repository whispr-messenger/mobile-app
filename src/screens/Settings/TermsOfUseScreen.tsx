/**
 * TermsOfUseScreen — conditions d'utilisation affichees in-app.
 * Pattern visuel aligne sur AboutContentScreen (gradient + header + cards).
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";

type Section = {
  title: string;
  body: string;
};

const SECTIONS_FR: Section[] = [
  {
    title: "Acceptation",
    body: "En creant un compte Whispr et en utilisant l'application, vous acceptez ces conditions. Si vous n'etes pas d'accord avec un point, n'utilisez pas le service. L'inscription vaut acceptation.",
  },
  {
    title: "Compte utilisateur",
    body: "Un compte est associe a un numero de telephone unique, valide par code OTP. Vous etes responsable de la confiance de vos appareils lies et de la confidentialite de votre cle de recuperation 2FA si activee. Le partage de compte est interdit.",
  },
  {
    title: "Comportement attendu",
    body: "Sont interdits : spam, harcelement, contenu illegal (notamment CSAM, incitation a la haine, menaces), usurpation d'identite, diffusion non consentie de donnees personnelles. La moderation cote serveur peut analyser les signalements et appliquer des sanctions automatiques ou manuelles.",
  },
  {
    title: "Suspension",
    body: "Une violation des regles peut entrainer un avertissement, une suspension temporaire, ou une suppression definitive du compte. Vous pouvez contester une sanction via Reglages > Modes & moderation > Mes sanctions, qui ouvre un dossier d'appel revu par l'equipe.",
  },
  {
    title: "Responsabilite",
    body: 'Whispr est un projet etudiant Epitech fourni en l\'etat ("as is"), sans garantie de disponibilite ni de continuite de service. Nous declinons toute responsabilite pour les pertes de donnees, dommages indirects, ou utilisation faite des messages par leurs destinataires. Vous restez seul responsable du contenu que vous envoyez.',
  },
  {
    title: "Modifications",
    body: "Ces conditions peuvent etre mises a jour. La version courante est toujours accessible via Reglages > A propos > Conditions d'utilisation. La poursuite d'utilisation apres modification vaut acceptation de la nouvelle version.",
  },
];

export const TermsOfUseScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const { getThemeColors, getFontSize, getLocalizedText } = useTheme();
  const themeColors = getThemeColors();

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
            {getLocalizedText("about.termsOfUse")}
          </Text>
        </View>

        <Text style={[bodyStyle, styles.intro]}>
          Derniere mise a jour : mai 2026. Projet etudiant Epitech, service
          fourni en l'etat.
        </Text>

        {SECTIONS_FR.map((section) => (
          <View key={section.title} style={styles.section}>
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
              {section.title.toUpperCase()}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: themeColors.background.secondary },
              ]}
            >
              <Text style={bodyStyle}>{section.body}</Text>
            </View>
          </View>
        ))}
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
    marginBottom: 16,
  },
  backButton: { marginRight: 12 },
  headerTitle: { fontWeight: "700", flex: 1 },
  intro: { marginBottom: 20, fontStyle: "italic" },
  section: { marginTop: 16 },
  sectionTitle: { fontWeight: "700", marginBottom: 8 },
  card: {
    borderRadius: 14,
    padding: 18,
  },
  bodyText: {},
});

export default TermsOfUseScreen;
