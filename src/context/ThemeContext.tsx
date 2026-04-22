/**
 * ThemeContext - Global Theme, Language, and Font Size Management
 * Provides centralized theme, language, and font size management across the app
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Types
export type Theme = "light" | "dark" | "auto";
export type Language = "fr" | "en";
export type FontSize = "small" | "medium" | "large";

export interface GlobalSettings {
  theme: Theme;
  language: Language;
  fontSize: FontSize;
}

interface ThemeContextType {
  settings: GlobalSettings;
  updateSettings: (newSettings: Partial<GlobalSettings>) => Promise<void>;
  getThemeColors: () => ThemeColors;
  getFontSize: (
    size: "xs" | "sm" | "base" | "lg" | "xl" | "xxl" | "xxxl",
  ) => number;
  getLocalizedText: (key: string) => string;
}

interface ThemeColors {
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    gradient: readonly [string, string, ...string[]];
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  primary: string;
  secondary: string;
  error: string;
  success: string;
  warning: string;
  info: string;
}

const STORAGE_KEY = "whispr.globalSettings.v1";

// Default settings
const defaultSettings: GlobalSettings = {
  theme: "dark",
  language: "fr",
  fontSize: "medium",
};

// Localized texts
const localizedTexts: Record<Language, Record<string, string>> = {
  fr: {
    // Navigation
    "nav.profile": "Profil",
    "nav.settings": "Paramètres",
    "nav.logout": "Déconnexion",

    // Auth
    "auth.login": "Connexion",
    "auth.register": "Inscription",
    "auth.phone": "Numéro de téléphone",
    "auth.password": "Mot de passe",
    "auth.verify": "Vérifier",
    "auth.resend": "Renvoyer le code",
    "auth.continue": "Continuer",
    "auth.seConnecter": "Se connecter",
    "auth.creerCompte": "Créer un compte",
    "auth.dejaCompte": "Déjà un compte ?",
    "auth.pasEncoreCompte": "Pas encore de compte ?",
    "auth.tagline": "Sécurisé. Privé. Simple.",
    "auth.smsCode": "Nous vous enverrons un code de vérification par SMS",
    "auth.searchCountry": "Rechercher un pays...",
    "auth.noCountryFound": "Aucun pays trouvé",
    "auth.enterPhone": "Veuillez entrer votre numéro de téléphone",
    "auth.phoneMinLength":
      "Le numéro de téléphone doit contenir au moins 10 chiffres",
    "auth.phoneInvalidFormat": "Format de numéro invalide (ex: 07 12 34 56 78)",
    "auth.errorConnection": "Une erreur est survenue lors de la connexion",
    "auth.errorSendCode": "Impossible d'envoyer le code de vérification",
    "settings.blockedUsers": "Utilisateurs bloqués",
    "settings.blockedUsersSubtitle":
      "Voir et débloquer les utilisateurs que vous avez bloqués",
    "devices.title": "Mes appareils",
    "devices.subtitle": "Voir et déconnecter les sessions actives",
    "devices.currentBadge": "Cet appareil",
    "devices.lastActive": "Dernière activité il y a",
    "devices.revokeAction": "Révoquer",
    "devices.revokeTitle": "Révoquer l'appareil",
    "devices.revokeConfirm":
      "Cet appareil sera déconnecté. Il devra se reconnecter avec un code SMS.",
    "devices.revokeConfirmAction": "Révoquer",
    "devices.revokeError": "Impossible de révoquer cet appareil.",
    "devices.empty": "Aucun appareil actif sur votre compte.",
    "auth.permissionDeniedGallery":
      "Permission refusée pour accéder à la galerie.",
    "auth.fillAllRequiredFields":
      "Veuillez remplir tous les champs obligatoires.",
    "chat.requestSentTitle": "Demande envoyée",
    "chat.requestSentMessage": "Votre demande de contact a été envoyée.",
    "chat.errorEditMessage": "Impossible de modifier le message",
    "chat.errorScheduleMessage": "Impossible de programmer le message.",
    "chat.errorDeleteMessage": "Impossible de supprimer le message",
    "auth.noAccountFound":
      "Aucun compte trouvé pour ce numéro. Voulez-vous vous inscrire ?",
    "auth.accountAlreadyExists":
      "Un compte existe déjà avec ce numéro. Voulez-vous vous connecter ?",
    "auth.verificationTitle": "Vérification",
    "auth.verificationSubtitle": "Entrez le code envoyé à",
    "auth.resendIn": "Renvoyer dans",
    "auth.resendCode": "Renvoyer le code",
    "auth.codeIncorrect": "Code incorrect",
    "auth.loginSuccess": "Connexion réussie ! ✅",
    "auth.welcome": "Bienvenue sur Whispr",
    "auth.codeVerified": "Code vérifié ! ✅",
    "auth.phoneVerified": "Votre numéro est maintenant vérifié",
    "auth.profileSetup": "Configuration du profil",
    "auth.profileSetupSubtitle": "Complétez votre profil pour commencer",
    "auth.firstName": "Prénom",
    "auth.lastName": "Nom",
    "auth.profilePhoto": "Photo de profil",
    "auth.selectPhoto": "Sélectionner une photo",
    "auth.takePhoto": "Prendre une photo",
    "auth.chooseFromLibrary": "Choisir depuis la bibliothèque",
    "auth.cancel": "Annuler",

    // Profile
    "profile.title": "Profil",
    "profile.edit": "Modifier",
    "profile.save": "Enregistrer",
    "profile.cancel": "Annuler",
    "profile.firstName": "Prénom",
    "profile.lastName": "Nom",
    "profile.username": "Nom d'utilisateur",
    "profile.phone": "Téléphone",
    "profile.bio": "Biographie",
    "profile.online": "En ligne",
    "profile.offline": "Hors ligne",

    // Settings
    "settings.title": "Paramètres",
    "settings.privacy": "Confidentialité",
    "settings.notifications": "Notifications",
    "settings.messaging": "Messagerie",
    "settings.application": "Application",
    "settings.security": "Sécurité",
    "settings.account": "Compte",
    "settings.theme": "Thème",
    "settings.language": "Langue",
    "settings.fontSize": "Taille de police",
    "settings.myProfile": "Mon profil",
    "settings.myProfileSubtitle": "Modifier vos informations personnelles",
    "settings.logout": "Déconnexion",
    "settings.deleteAccount": "Supprimer le compte",
    "settings.theme.light": "Clair",
    "settings.theme.dark": "Sombre",
    "settings.theme.auto": "Automatique",
    "settings.language.fr": "Français",
    "settings.language.en": "Anglais",
    "settings.fontSize.small": "Petit",
    "settings.fontSize.medium": "Moyen",
    "settings.fontSize.large": "Grand",
    "settings.modalPickHint":
      "Touchez une option — le changement est appliqué tout de suite. La sélection active est surlignée en bleu.",
    "settings.aboutWhispr": "À propos",
    "settings.aboutWhisprSubtitle": "Contenu, sécurité et informations légales",
    "settings.aboutSection": "Légal & contenu",

    // Moderation settings
    "settings.moderation": "Modération",
    "settings.myReports": "Mes signalements",
    "settings.myReportsSubtitle": "Historique de vos signalements",
    "settings.mySanctions": "Mes sanctions",
    "settings.mySanctionsSubtitle": "Voir vos sanctions",
    "settings.moderationDashboard": "Tableau de bord",
    "settings.moderationDashboardSubtitle": "Gestion de la modération",

    // About — contenu & sécurité (WHISPR)
    "about.title": "À propos",
    "about.sectionContentSecurity": "Contenu et sécurité",
    "about.p1":
      "Pour contribuer à la sécurité tout en limitant l'exposition de vos médias, certaines images peuvent être analysées directement sur votre appareil avant l'envoi.",
    "about.p2":
      "Cette technologie a des limites : des faux positifs ou des détections manquées sont possibles. Elle ne remplace pas votre vigilance.",
    "about.p3":
      "Pour plus de détails sur le traitement de vos données, consultez notre politique de confidentialité.",
    "about.reportCallout":
      "Vous pouvez signaler un abus ou un contenu problématique depuis le menu d'un message, dans une conversation.",
    "about.p4":
      "Une modération automatique côté serveur peut également être appliquée pour protéger l'intégrité du réseau ; cela ne garantit pas une intervention humaine pour chaque signalement.",
    "about.privacyPolicy": "Politique de confidentialité",
    "about.termsOfUse": "Conditions d'utilisation",
    "about.reportContent": "Signaler un contenu",
    "about.reportComingSoon":
      "Le flux de signalement sera bientôt disponible. En attendant, utilisez le menu du message lorsque l'option sera proposée.",
    "about.legalOpenError":
      "Impossible d'ouvrir le lien. Vérifiez votre connexion ou l'URL configurée.",

    // Notifications
    "notif.success": "Succès",
    "notif.error": "Erreur",
    "notif.profileSaved": "Profil enregistré avec succès",
    "notif.logoutSuccess": "Déconnexion réussie",
    "notif.deleteAccountSuccess": "Compte supprimé avec succès",
    "notif.logoutConfirm": "Êtes-vous sûr de vouloir vous déconnecter ?",
    "notif.deleteAccountConfirm":
      "Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.",

    // Security
    "security.title": "Clés de sécurité",
    "security.connectedDevices": "Appareils connectés",
    "security.connectedDevicesSubtitle":
      "Gérez les appareils connectés à votre compte",
    "security.securityKeys": "Clés de sécurité",
    "security.securityKeysSubtitle":
      "Vérifiez et gérez vos clés de chiffrement",
    "security.currentDevice": "Appareil actuel",
    "security.disconnectDevice": "Déconnecter l'appareil",
    "security.disconnectDeviceMessage": "Voulez-vous déconnecter",
    "security.disconnect": "Déconnecter",
    "security.cannotDisconnectCurrent": "Impossible de déconnecter",
    "security.cannotDisconnectCurrentMessage":
      "Vous ne pouvez pas déconnecter l'appareil actuel",
    "security.deviceDisconnected": "Appareil déconnecté avec succès",
    "security.viewSecurityCode": "Voir le code de sécurité",
    "security.securityCode": "Code de sécurité",
    "security.verifyCode": "Vérifier le code",
    "security.enterCode": "Entrez le code",
    "security.verify": "Vérifier",
    "security.codeVerified": "Code vérifié avec succès",
    "security.invalidCode": "Code invalide",
    "security.codeCopied": "Code copié dans le presse-papiers",
    "security.scanQRCode": "Scanner le code QR",
    "security.qrScannerComingSoon":
      "Le scanner QR sera disponible prochainement",
    "security.createdOn": "Créé le",
    "security.infoMessage":
      "Ces clés permettent de vérifier l'identité de vos appareils et de sécuriser vos conversations.",
    "security.showSecurityKeys": "Afficher les clés de sécurité",
    "security.hideSecurityKeys": "Masquer les clés de sécurité",

    // Two Factor Authentication
    "twoFactor.title": "Authentification à deux facteurs",
    "twoFactor.infoMessage":
      "Ajoutez une couche de sécurité supplémentaire à votre compte en activant l'authentification à deux facteurs.",
    "twoFactor.authentication": "Authentification à deux facteurs",
    "twoFactor.authenticationSubtitle":
      "Protégez votre compte avec une couche de sécurité supplémentaire",
    "twoFactor.enable2FA": "Activer l'authentification à deux facteurs",
    "twoFactor.enable2FASubtitle":
      "Exiger un code de vérification en plus de votre mot de passe",
    "twoFactor.disable": "Désactiver",
    "twoFactor.disableConfirm":
      "Êtes-vous sûr de vouloir désactiver l'authentification à deux facteurs ? Cela rendra votre compte moins sécurisé.",
    "twoFactor.enabled": "Authentification à deux facteurs activée avec succès",
    "twoFactor.disabled": "Authentification à deux facteurs désactivée",
    "twoFactor.qrCode": "Code QR",
    "twoFactor.qrCodeSubtitle":
      "Scannez ce code avec votre application d'authentification",
    "twoFactor.viewQRCode": "Voir le code QR",
    "twoFactor.viewQRCodeSubtitle":
      "Scanner avec votre application d'authentification",
    "twoFactor.setupQRCode": "Configurer le code QR",
    "twoFactor.scanQRCode": "Scanner le code QR",
    "twoFactor.qrScannerComingSoon":
      "Le scanner QR sera disponible prochainement",
    "twoFactor.enterVerificationCode":
      "Entrez le code de vérification de votre application d'authentification",
    "twoFactor.enterCode": "Entrez le code",
    "twoFactor.verify": "Vérifier",
    "twoFactor.invalidCode": "Code de vérification invalide",
    "twoFactor.recoveryCodes": "Codes de récupération",
    "twoFactor.recoveryCodesSubtitle":
      "Utilisez ces codes si vous perdez l'accès à votre application d'authentification",
    "twoFactor.viewRecoveryCodes": "Voir les codes de récupération",
    "twoFactor.viewRecoveryCodesSubtitle":
      "Enregistrez ces codes dans un endroit sûr",
    "twoFactor.recoveryCodesInfo":
      "Enregistrez ces codes dans un endroit sûr. Vous pouvez les utiliser pour accéder à votre compte si vous perdez votre appareil.",
    "twoFactor.codeCopied": "Code copié dans le presse-papiers",
    "twoFactor.setupError":
      "Impossible de démarrer la configuration. Réessayez.",
    "twoFactor.loadError": "Impossible de charger le statut 2FA.",
    "twoFactor.setupTitle": "Configurer l'authentificateur",
    "twoFactor.step1of3": "Étape 1 sur 3",
    "twoFactor.step2of3": "Étape 2 sur 3",
    "twoFactor.step3of3": "Étape 3 sur 3",
    "twoFactor.setupInfoMessage":
      "Ouvrez votre application d'authentification et scannez le code QR ci-dessous.",
    "twoFactor.manualEntryLabel": "Ou saisissez ce code manuellement",
    "twoFactor.copySecret": "Copier le secret",
    "twoFactor.secretCopied": "Secret copié dans le presse-papiers",
    "twoFactor.secretReminder": "Secret de l'étape précédente",
    "twoFactor.verifyTitle": "Vérifier le code",
    "twoFactor.verifyInfoMessage":
      "Entrez le code à 6 chiffres affiché dans votre application d'authentification.",
    "twoFactor.backupCodesTitle": "Sauvegarder vos codes",
    "twoFactor.backupCodesWarning":
      "Ces codes ne seront plus affichés. Conservez-les dans un endroit sûr.",
    "twoFactor.copyAll": "Tout copier",
    "twoFactor.allCodesCopied": "Tous les codes copiés",
    "twoFactor.confirmSaved": "J'ai sauvegardé mes codes de secours",
    "twoFactor.confirmSavedFirst":
      "Veuillez cocher la case de confirmation avant de continuer.",
    "twoFactor.completeSetup": "Terminer la configuration",
    "twoFactor.regenerateCodes": "Régénérer les codes",
    "twoFactor.regenerateTitle": "Régénérer les codes de secours",
    "twoFactor.regenerateConfirm":
      "Cette action va générer de nouveaux codes et invalider les précédents. Vos anciens codes ne fonctionneront plus.",
    "twoFactor.codesRegenerated": "Codes de récupération régénérés",
    "twoFactor.remainingCodes": "{count} codes de secours restants",

    // Report message (WHISPR-174)
    "report.menuAction": "Signaler",
    "report.sheetTitle": "Signaler un contenu",
    "report.step1of2": "ÉTAPE 1 / 2",
    "report.step2of2": "ÉTAPE 2 / 2",
    "report.conversationLabel": "CONVERSATION",
    "report.step1Subtitle": "Pourquoi signalez-vous ce message ?",
    "report.step2Header": "Précisez votre signalement",
    "report.category.offensive": "Contenu offensant",
    "report.category.spam": "Spam / arnaque",
    "report.category.nudity": "Nudité ou contenu sexuel",
    "report.category.violence": "Violence",
    "report.category.harassment": "Harcèlement",
    "report.category.other": "Autre",
    "report.disclaimer":
      "Votre signalement est traité de manière confidentielle. L'autre personne n'est pas notifiée automatiquement.",
    "report.continue": "Continuer",
    "report.additionalDetails": "INFORMATIONS COMPLÉMENTAIRES",
    "report.placeholder": "Décrivez le problème (recommandé)",
    "report.attachOptional": "PIÈCE JOINTE (OPTIONNEL)",
    "report.attachHint": "Ajouter une photo",
    "report.back": "Retour",
    "report.send": "Envoyer le signalement",
    "report.successTitle": "Signalement envoyé",
    "report.successBody":
      "Merci, votre signalement a bien été reçu. Nos modérateurs vont l'examiner dans les plus brefs délais.",
    "report.errorBanner": "Une erreur est survenue",
    "report.errorTitle": "Impossible d'envoyer",
    "report.errorBody":
      "Veuillez vérifier votre connexion internet et réessayer l'envoi de votre signalement.",

    // Common
    "common.confirm": "Confirmer",
    "common.cancel": "Annuler",
    "common.save": "Enregistrer",
    "common.delete": "Supprimer",
    "common.yes": "Oui",
    "common.no": "Non",
    "common.ok": "OK",
    "common.next": "Suivant",
    "common.retry": "Réessayer",
    "common.copyError": "Impossible de copier dans le presse-papiers.",
  },
  en: {
    // Navigation
    "nav.profile": "Profile",
    "nav.settings": "Settings",
    "nav.logout": "Logout",

    // Auth
    "auth.login": "Login",
    "auth.register": "Register",
    "auth.phone": "Phone number",
    "auth.password": "Password",
    "auth.verify": "Verify",
    "auth.resend": "Resend code",
    "auth.continue": "Continue",
    "auth.seConnecter": "Log in",
    "auth.creerCompte": "Create account",
    "auth.dejaCompte": "Already have an account?",
    "auth.pasEncoreCompte": "No account yet?",
    "auth.tagline": "Secure. Private. Simple.",
    "auth.smsCode": "We will send you a verification code by SMS",
    "auth.searchCountry": "Search for a country...",
    "auth.noCountryFound": "No country found",
    "auth.enterPhone": "Please enter your phone number",
    "auth.phoneMinLength": "Phone number must contain at least 10 digits",
    "auth.phoneInvalidFormat": "Invalid phone format (e.g.: 07 12 34 56 78)",
    "auth.errorConnection": "An error occurred during connection",
    "auth.errorSendCode": "Unable to send verification code",
    "settings.blockedUsers": "Blocked users",
    "settings.blockedUsersSubtitle": "View and unblock users you've blocked",
    "devices.title": "My devices",
    "devices.subtitle": "View and sign out active sessions",
    "devices.currentBadge": "This device",
    "devices.lastActive": "Last active",
    "devices.revokeAction": "Revoke",
    "devices.revokeTitle": "Revoke device",
    "devices.revokeConfirm":
      "This device will be signed out and will need to re-authenticate with an SMS code.",
    "devices.revokeConfirmAction": "Revoke",
    "devices.revokeError": "Could not revoke this device.",
    "devices.empty": "No active devices on your account.",
    "auth.permissionDeniedGallery": "Permission denied to access the gallery.",
    "auth.fillAllRequiredFields": "Please fill in all required fields.",
    "chat.requestSentTitle": "Request sent",
    "chat.requestSentMessage": "Your contact request has been sent.",
    "chat.errorEditMessage": "Could not edit the message",
    "chat.errorScheduleMessage": "Could not schedule the message.",
    "chat.errorDeleteMessage": "Could not delete the message",
    "auth.noAccountFound":
      "No account found for this number. Would you like to register?",
    "auth.accountAlreadyExists":
      "An account already exists with this number. Would you like to log in?",
    "auth.verificationTitle": "Verification",
    "auth.verificationSubtitle": "Enter the code sent to",
    "auth.resendIn": "Resend in",
    "auth.resendCode": "Resend code",
    "auth.codeIncorrect": "Incorrect code",
    "auth.loginSuccess": "Login successful! ✅",
    "auth.welcome": "Welcome to Whispr",
    "auth.codeVerified": "Code verified! ✅",
    "auth.phoneVerified": "Your number is now verified",
    "auth.profileSetup": "Profile Setup",
    "auth.profileSetupSubtitle": "Complete your profile to get started",
    "auth.firstName": "First name",
    "auth.lastName": "Last name",
    "auth.profilePhoto": "Profile photo",
    "auth.selectPhoto": "Select a photo",
    "auth.takePhoto": "Take a photo",
    "auth.chooseFromLibrary": "Choose from library",
    "auth.cancel": "Cancel",

    // Profile
    "profile.title": "Profile",
    "profile.edit": "Edit",
    "profile.save": "Save",
    "profile.cancel": "Cancel",
    "profile.firstName": "First name",
    "profile.lastName": "Last name",
    "profile.username": "Username",
    "profile.phone": "Phone",
    "profile.bio": "Biography",
    "profile.online": "Online",
    "profile.offline": "Offline",

    // Settings
    "settings.title": "Settings",
    "settings.privacy": "Privacy",
    "settings.notifications": "Notifications",
    "settings.messaging": "Messaging",
    "settings.application": "Application",
    "settings.security": "Security",
    "settings.account": "Account",
    "settings.theme": "Theme",
    "settings.language": "Language",
    "settings.fontSize": "Font size",
    "settings.myProfile": "My profile",
    "settings.myProfileSubtitle": "Edit your personal information",
    "settings.logout": "Logout",
    "settings.deleteAccount": "Delete account",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.theme.auto": "Auto",
    "settings.language.fr": "French",
    "settings.language.en": "English",
    "settings.fontSize.small": "Small",
    "settings.fontSize.medium": "Medium",
    "settings.fontSize.large": "Large",
    "settings.modalPickHint":
      "Tap an option — it applies instantly. The active choice is highlighted in blue.",
    "settings.aboutWhispr": "About",
    "settings.aboutWhisprSubtitle": "Content, security, and legal information",
    "settings.aboutSection": "Legal & content",

    // Moderation settings
    "settings.moderation": "Moderation",
    "settings.myReports": "My Reports",
    "settings.myReportsSubtitle": "History of your reports",
    "settings.mySanctions": "My Sanctions",
    "settings.mySanctionsSubtitle": "View your sanctions",
    "settings.moderationDashboard": "Dashboard",
    "settings.moderationDashboardSubtitle": "Moderation management",

    // About — content & security (WHISPR)
    "about.title": "About",
    "about.sectionContentSecurity": "Content & security",
    "about.p1":
      "To improve safety while limiting exposure of your media, some images may be analyzed on your device before they are sent.",
    "about.p2":
      "This technology has limits: false positives or missed detections can happen. It does not replace your own judgment.",
    "about.p3": "For more on how we process your data, see our privacy policy.",
    "about.reportCallout":
      "You can report abuse or problematic content from a message's menu inside a conversation.",
    "about.p4":
      "Automatic server-side moderation may also be used to protect the network; this does not guarantee human review for every report.",
    "about.privacyPolicy": "Privacy policy",
    "about.termsOfUse": "Terms of use",
    "about.reportContent": "Report content",
    "about.reportComingSoon":
      "The reporting flow is coming soon. Until then, use the message menu when the option is available.",
    "about.legalOpenError":
      "Could not open the link. Check your connection or the configured URL.",

    // Notifications
    "notif.success": "Success",
    "notif.error": "Error",
    "notif.profileSaved": "Profile saved successfully",
    "notif.logoutSuccess": "Logout successful",
    "notif.deleteAccountSuccess": "Account deleted successfully",
    "notif.logoutConfirm": "Are you sure you want to log out?",
    "notif.deleteAccountConfirm":
      "Are you sure you want to delete your account? This action is irreversible.",

    // Security
    "security.title": "Security Keys",
    "security.connectedDevices": "Connected Devices",
    "security.connectedDevicesSubtitle":
      "Manage devices connected to your account",
    "security.securityKeys": "Security Keys",
    "security.securityKeysSubtitle": "Verify and manage your encryption keys",
    "security.currentDevice": "Current device",
    "security.disconnectDevice": "Disconnect Device",
    "security.disconnectDeviceMessage": "Do you want to disconnect",
    "security.disconnect": "Disconnect",
    "security.cannotDisconnectCurrent": "Cannot disconnect",
    "security.cannotDisconnectCurrentMessage":
      "You cannot disconnect the current device",
    "security.deviceDisconnected": "Device disconnected successfully",
    "security.viewSecurityCode": "View Security Code",
    "security.securityCode": "Security Code",
    "security.verifyCode": "Verify Code",
    "security.enterCode": "Enter code",
    "security.verify": "Verify",
    "security.codeVerified": "Code verified successfully",
    "security.invalidCode": "Invalid code",
    "security.codeCopied": "Code copied to clipboard",
    "security.scanQRCode": "Scan QR Code",
    "security.qrScannerComingSoon": "QR scanner will be available soon",
    "security.createdOn": "Created on",
    "security.infoMessage":
      "These keys allow you to verify your devices' identity and secure your conversations.",
    "security.showSecurityKeys": "Show security keys",
    "security.hideSecurityKeys": "Hide security keys",

    // Two Factor Authentication
    "twoFactor.title": "Two-Factor Authentication",
    "twoFactor.infoMessage":
      "Add an extra layer of security to your account by enabling two-factor authentication.",
    "twoFactor.authentication": "Two-Factor Authentication",
    "twoFactor.authenticationSubtitle":
      "Protect your account with an additional security layer",
    "twoFactor.enable2FA": "Enable Two-Factor Authentication",
    "twoFactor.enable2FASubtitle":
      "Require a verification code in addition to your password",
    "twoFactor.disable": "Disable",
    "twoFactor.disableConfirm":
      "Are you sure you want to disable two-factor authentication? This will make your account less secure.",
    "twoFactor.enabled": "Two-factor authentication enabled successfully",
    "twoFactor.disabled": "Two-factor authentication disabled",
    "twoFactor.qrCode": "QR Code",
    "twoFactor.qrCodeSubtitle": "Scan this code with your authenticator app",
    "twoFactor.viewQRCode": "View QR Code",
    "twoFactor.viewQRCodeSubtitle": "Scan with your authenticator app",
    "twoFactor.setupQRCode": "Setup QR Code",
    "twoFactor.scanQRCode": "Scan QR Code",
    "twoFactor.qrScannerComingSoon": "QR scanner will be available soon",
    "twoFactor.enterVerificationCode":
      "Enter the verification code from your authenticator app",
    "twoFactor.enterCode": "Enter code",
    "twoFactor.verify": "Verify",
    "twoFactor.invalidCode": "Invalid verification code",
    "twoFactor.recoveryCodes": "Recovery Codes",
    "twoFactor.recoveryCodesSubtitle":
      "Use these codes if you lose access to your authenticator app",
    "twoFactor.viewRecoveryCodes": "View Recovery Codes",
    "twoFactor.viewRecoveryCodesSubtitle": "Save these codes in a safe place",
    "twoFactor.recoveryCodesInfo":
      "Save these codes in a safe place. You can use them to access your account if you lose your device.",
    "twoFactor.codeCopied": "Code copied to clipboard",
    "twoFactor.setupError": "Unable to start setup. Please try again.",
    "twoFactor.loadError": "Unable to load 2FA status.",
    "twoFactor.setupTitle": "Set Up Authenticator",
    "twoFactor.step1of3": "Step 1 of 3",
    "twoFactor.step2of3": "Step 2 of 3",
    "twoFactor.step3of3": "Step 3 of 3",
    "twoFactor.setupInfoMessage":
      "Open your authenticator app and scan the QR code below.",
    "twoFactor.manualEntryLabel": "Or enter this code manually",
    "twoFactor.copySecret": "Copy Secret",
    "twoFactor.secretCopied": "Secret copied to clipboard",
    "twoFactor.secretReminder": "Secret from the previous step",
    "twoFactor.verifyTitle": "Verify Code",
    "twoFactor.verifyInfoMessage":
      "Enter the 6-digit code shown in your authenticator app.",
    "twoFactor.backupCodesTitle": "Save Your Codes",
    "twoFactor.backupCodesWarning":
      "These codes will not be shown again. Store them somewhere safe.",
    "twoFactor.copyAll": "Copy All",
    "twoFactor.allCodesCopied": "All codes copied",
    "twoFactor.confirmSaved": "I have saved my backup codes",
    "twoFactor.confirmSavedFirst":
      "Please check the confirmation box before continuing.",
    "twoFactor.completeSetup": "Complete Setup",
    "twoFactor.regenerateCodes": "Regenerate Codes",
    "twoFactor.regenerateTitle": "Regenerate Backup Codes",
    "twoFactor.regenerateConfirm":
      "This will generate new codes and invalidate your previous ones. Your old codes will no longer work.",
    "twoFactor.codesRegenerated": "Recovery codes regenerated",
    "twoFactor.remainingCodes": "{count} backup codes remaining",

    // Report message (WHISPR-174)
    "report.menuAction": "Report",
    "report.sheetTitle": "Report content",
    "report.step1of2": "STEP 1 / 2",
    "report.step2of2": "STEP 2 / 2",
    "report.conversationLabel": "CONVERSATION",
    "report.step1Subtitle": "Why are you reporting this message?",
    "report.step2Header": "Add details",
    "report.category.offensive": "Offensive content",
    "report.category.spam": "Spam or scam",
    "report.category.nudity": "Nudity or sexual content",
    "report.category.violence": "Violence",
    "report.category.harassment": "Harassment",
    "report.category.other": "Other",
    "report.disclaimer":
      "Your report is handled confidentially. The other person is not notified automatically.",
    "report.continue": "Continue",
    "report.additionalDetails": "ADDITIONAL DETAILS",
    "report.placeholder": "Describe the issue (recommended)",
    "report.attachOptional": "ATTACHMENT (OPTIONAL)",
    "report.attachHint": "Add a photo",
    "report.back": "Back",
    "report.send": "Submit report",
    "report.successTitle": "Report sent",
    "report.successBody":
      "Thank you. Your report has been received. Our moderators will review it as soon as possible.",
    "report.errorBanner": "Something went wrong",
    "report.errorTitle": "Could not send",
    "report.errorBody":
      "Please check your internet connection and try sending your report again.",

    // Common
    "common.confirm": "Confirm",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.yes": "Yes",
    "common.no": "No",
    "common.ok": "OK",
    "common.next": "Next",
    "common.retry": "Retry",
    "common.copyError": "Unable to copy to clipboard.",
  },
};

// Theme color palettes
const lightThemeColors: ThemeColors = {
  background: {
    primary: "#FFFFFF",
    secondary: "#F6F6F6",
    tertiary: "#ABABAB",
    gradient: ["#FFFFFF", "#F6F6F6"] as const,
  },
  text: {
    primary: "#000000",
    secondary: "#545458",
    tertiary: "#767680",
  },
  primary: "#FE7A5C",
  secondary: "#6774BD",
  error: "#FF3B30",
  success: "#21C004",
  warning: "#F04882",
  info: "#6774BD",
};

const darkThemeColors: ThemeColors = {
  background: {
    primary: "#0B1124", // Dark navy from gradient
    secondary: "#1A1F3A", // Dark card color
    tertiary: "#212135", // Dark tertiary
    gradient: ["#0B1124", "#3C2E7C", "#FE7A5C"] as const,
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#ABABAB",
    tertiary: "#8E8E93",
  },
  primary: "#FE7A5C",
  secondary: "#6774BD",
  error: "#FF3B30",
  success: "#21C004",
  warning: "#F04882",
  info: "#6774BD",
};

// Font size multipliers
const fontSizeMultipliers: Record<FontSize, number> = {
  small: 0.9,
  medium: 1.0,
  large: 1.1,
};

// Base font sizes
const baseFontSizes = {
  xs: 10,
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// WHISPR-1072: exported so the resolution logic can be covered by unit tests
// without mounting a full React Native renderer (useColorScheme needs the
// native event loop, which the Jest RN preset flakes on).
export const resolveThemeColors = (
  theme: Theme,
  systemColorScheme: "light" | "dark" | null | undefined,
): ThemeColors => {
  if (theme === "light") return lightThemeColors;
  if (theme === "dark") return darkThemeColors;
  // theme === "auto"
  return systemColorScheme === "light" ? lightThemeColors : darkThemeColors;
};

// Context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<GlobalSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  // WHISPR-1072: watch the OS-level color scheme so "auto" actually follows
  // the system preference instead of silently defaulting to dark.
  const systemColorScheme = useColorScheme();

  // Load settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as GlobalSettings;
          setSettings(parsed);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  // Update settings
  const updateSettings = async (newSettings: Partial<GlobalSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  // Get theme colors based on current theme (delegates to the pure helper
  // so the resolution logic can be unit-tested without mounting RN).
  const getThemeColors = (): ThemeColors =>
    resolveThemeColors(settings.theme, systemColorScheme);

  // Get font size with multiplier
  const getFontSize = (
    size: "xs" | "sm" | "base" | "lg" | "xl" | "xxl" | "xxxl",
  ): number => {
    const base = baseFontSizes[size];
    const multiplier = fontSizeMultipliers[settings.fontSize];
    return base * multiplier;
  };

  // Get localized text
  const getLocalizedText = (key: string): string => {
    return localizedTexts[settings.language][key] || key;
  };

  const value: ThemeContextType = {
    settings,
    updateSettings,
    getThemeColors,
    getFontSize,
    getLocalizedText,
  };

  if (!isLoaded) {
    return null; // Or a loading screen
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

// Hook
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
