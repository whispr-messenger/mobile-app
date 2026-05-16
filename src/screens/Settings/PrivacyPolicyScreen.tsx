/**
 * PrivacyPolicyScreen — politique de confidentialite affichee in-app.
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
    title: "Donnees collectees",
    body: "Whispr collecte le numero de telephone necessaire a la creation du compte (stocke chiffre cote serveur), un profil minimal (pseudo, avatar optionnel) renseigne par vos soins, et des metadonnees techniques liees aux messages (horodatage, identifiants de conversation, statut de remise). Le contenu des messages texte est chiffre de bout en bout : nos serveurs n'y ont pas acces.",
  },
  {
    title: "Stockage",
    body: "Les messages sont chiffres bout-en-bout (Signal Protocol) et seul leur enveloppe metadata est conservee cote serveur le temps de la remise. Les medias passent par un stockage temporaire chiffre puis sont effaces apres telechargement par les destinataires. Les profils sont stockes en base de donnees sur notre infrastructure auto-hebergee (Kubernetes sur VPS dedie).",
  },
  {
    title: "Partage",
    body: "Whispr ne revend ni ne partage vos donnees avec des tiers. Aucun cookie publicitaire, aucun tracker analytics tiers. L'hebergement est assure par notre infrastructure k8s sur VPS personnel ; aucun fournisseur cloud commercial (AWS, GCP, Azure) ne reside dans le flux de donnees.",
  },
  {
    title: "Vos droits RGPD",
    body: "Vous disposez d'un droit d'acces, de rectification, de suppression et de portabilite sur vos donnees. La suppression de compte (via Reglages > Compte > Supprimer mon compte) efface profil, contacts, sanctions et invalide les sessions. Pour toute demande specifique RGPD ou question, utilisez le menu Signalement ou contactez l'equipe via la page A propos.",
  },
  {
    title: "Mineurs",
    body: "Whispr n'est pas destine aux mineurs de moins de 13 ans. Si nous detectons qu'un compte appartient a un mineur sans consentement parental, il sera supprime.",
  },
  {
    title: "Modifications",
    body: "Cette politique peut evoluer pour refleter des changements techniques ou legaux. La version a jour est toujours accessible depuis Reglages > A propos > Politique de confidentialite.",
  },
];

export const PrivacyPolicyScreen: React.FC = () => {
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
            {getLocalizedText("about.privacyPolicy")}
          </Text>
        </View>

        <Text style={[bodyStyle, styles.intro]}>
          Derniere mise a jour : mai 2026. Whispr est un projet etudiant Epitech
          : ce service est fourni en l'etat, sans garantie commerciale.
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

export default PrivacyPolicyScreen;
