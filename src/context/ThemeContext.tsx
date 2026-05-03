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
  useRef,
  useCallback,
} from "react";
import { AppState, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { colors } from "../theme/colors";
import { detectImageFormatFromUri } from "../utils/imageCompression";
import { TokenService } from "../services/TokenService";
import { MediaService } from "../services/MediaService";
import {
  UserService,
  type UserProfile,
  type UserVisualPreferences,
} from "../services/UserService";
import { getApiBaseUrl } from "../services/apiBase";

// Types
export type Theme = "light" | "dark" | "auto";
export type Language = "fr" | "en";
export type FontSize = "small" | "medium" | "large";
export type BackgroundPreset =
  | "whispr"
  | "midnight"
  | "sunset"
  | "aurora"
  | "custom";

type BackgroundGradient = readonly [string, string, string];

export interface GlobalSettings {
  theme: Theme;
  language: Language;
  fontSize: FontSize;
  backgroundPreset: BackgroundPreset;
  customBackgroundUri?: string | null;
  customBackgroundVersion?: number;
  customBackgroundRemoteMediaId?: string | null;
  customBackgroundRemoteUrl?: string | null;
  remoteSyncUpdatedAt?: string | null;
}

interface ThemeContextType {
  settings: GlobalSettings;
  updateSettings: (
    newSettings: Partial<GlobalSettings>,
    options?: {
      skipRemoteSync?: boolean;
      preserveRemoteSyncTimestamp?: boolean;
    },
  ) => Promise<void>;
  saveCustomBackground: (sourceUri: string) => Promise<void>;
  clearCustomBackground: () => Promise<void>;
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
const VISUAL_CACHE_KEY = "whispr.globalSettings.visual-cache.v1";
const REMOTE_VISUAL_SYNC_DEBOUNCE_MS = 750;
const REMOTE_VISUAL_POLL_INTERVAL_MS = 60_000;
const REMOTE_VISUAL_FETCH_MIN_INTERVAL_MS = 15_000;

export const BACKGROUND_PRESET_GRADIENTS: Record<
  BackgroundPreset,
  BackgroundGradient
> = {
  whispr: ["#0B1124", "#3C2E7C", "#FE7A5C"],
  midnight: ["#050816", "#172554", "#312E81"],
  sunset: ["#1A102C", "#7C2D12", "#FE7A5C"],
  aurora: ["#06141F", "#0F766E", "#6774BD"],
  custom: [
    "rgba(6, 12, 24, 0.22)",
    "rgba(34, 28, 62, 0.14)",
    "rgba(254, 122, 92, 0.1)",
  ],
};

const CUSTOM_BACKGROUND_DIR = "whispr-backgrounds";
const CUSTOM_BACKGROUND_BASENAME = "current-background";
const CUSTOM_BACKGROUND_VARIANTS = [
  "jpg",
  "gif",
  "png",
  "webp",
  "heic",
  "heif",
];

function isBackgroundPreset(value: unknown): value is BackgroundPreset {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(BACKGROUND_PRESET_GRADIENTS, value)
  );
}

function normalizeSettings(
  stored: Partial<GlobalSettings> | null | undefined,
): GlobalSettings {
  const backgroundPreset = isBackgroundPreset(stored?.backgroundPreset)
    ? stored.backgroundPreset
    : defaultSettings.backgroundPreset;
  const customBackgroundUri =
    typeof stored?.customBackgroundUri === "string"
      ? stored.customBackgroundUri
      : null;
  const customBackgroundVersion =
    typeof stored?.customBackgroundVersion === "number"
      ? stored.customBackgroundVersion
      : 0;
  const remoteSyncUpdatedAt =
    typeof stored?.remoteSyncUpdatedAt === "string"
      ? stored.remoteSyncUpdatedAt
      : null;

  return {
    ...defaultSettings,
    ...(stored ?? {}),
    backgroundPreset:
      backgroundPreset === "custom" && !customBackgroundUri
        ? defaultSettings.backgroundPreset
        : backgroundPreset,
    customBackgroundUri,
    customBackgroundVersion,
    customBackgroundRemoteMediaId:
      typeof stored?.customBackgroundRemoteMediaId === "string"
        ? stored.customBackgroundRemoteMediaId
        : null,
    customBackgroundRemoteUrl:
      typeof stored?.customBackgroundRemoteUrl === "string"
        ? stored.customBackgroundRemoteUrl
        : null,
    remoteSyncUpdatedAt,
  };
}

function shouldPersistVisualCache(settings: GlobalSettings) {
  return (
    settings.theme !== defaultSettings.theme ||
    settings.backgroundPreset !== defaultSettings.backgroundPreset ||
    !!settings.customBackgroundUri
  );
}

function buildVisualCachePayload(
  settings: GlobalSettings,
): Partial<GlobalSettings> {
  return {
    theme: settings.theme,
    backgroundPreset: settings.backgroundPreset,
    customBackgroundUri: settings.customBackgroundUri ?? null,
    customBackgroundVersion: settings.customBackgroundVersion ?? 0,
    customBackgroundRemoteMediaId:
      settings.customBackgroundRemoteMediaId ?? null,
    customBackgroundRemoteUrl: settings.customBackgroundRemoteUrl ?? null,
    remoteSyncUpdatedAt: settings.remoteSyncUpdatedAt ?? null,
  };
}

export function shouldSyncVisualPreferences(
  settings: GlobalSettings,
  updates: Partial<GlobalSettings>,
) {
  const touchesVisualPreference =
    updates.theme !== undefined ||
    updates.language !== undefined ||
    updates.fontSize !== undefined ||
    updates.backgroundPreset !== undefined;

  if (!touchesVisualPreference) {
    return false;
  }

  if (
    settings.backgroundPreset === "custom" &&
    !settings.customBackgroundRemoteMediaId &&
    !settings.customBackgroundRemoteUrl
  ) {
    return false;
  }

  return true;
}

async function persistSettingsCaches(settings: GlobalSettings) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  if (shouldPersistVisualCache(settings)) {
    await AsyncStorage.setItem(
      VISUAL_CACHE_KEY,
      JSON.stringify(buildVisualCachePayload(settings)),
    );
    return;
  }
  await AsyncStorage.removeItem(VISUAL_CACHE_KEY).catch(() => {});
}

function applyRuntimeBackgroundGradient(gradient: BackgroundGradient) {
  const appGradient = colors.background.gradient.app as unknown as string[];
  const authGradient = colors.background.gradient.auth as unknown as string[];
  appGradient.splice(0, appGradient.length, ...gradient);
  authGradient.splice(0, authGradient.length, ...gradient);
}

function getCustomBackgroundTargetUri(extension = "jpg") {
  const root = FileSystem.documentDirectory as string | undefined;
  if (!root) {
    throw new Error("No persistent file-system directory available");
  }
  return `${root}${CUSTOM_BACKGROUND_DIR}/${CUSTOM_BACKGROUND_BASENAME}.${extension}`;
}

async function deleteAllCustomBackgroundVariants() {
  await Promise.all(
    CUSTOM_BACKGROUND_VARIANTS.map((ext) =>
      FileSystem.deleteAsync(getCustomBackgroundTargetUri(ext), {
        idempotent: true,
      }).catch(() => {}),
    ),
  );
}

async function findExistingCustomBackgroundUri(): Promise<string | null> {
  for (const ext of CUSTOM_BACKGROUND_VARIANTS) {
    const candidate = getCustomBackgroundTargetUri(ext);
    try {
      const info = await FileSystem.getInfoAsync(candidate);
      if (info.exists) return candidate;
    } catch {
      // Ignore a single variant probe and keep scanning the others.
    }
  }
  return null;
}

async function resolvePersistedSettings(
  rawSettings: Partial<GlobalSettings> | null | undefined,
): Promise<GlobalSettings> {
  const normalized = normalizeSettings(rawSettings);
  if (normalized.backgroundPreset !== "custom") {
    return normalized;
  }

  const targetUri = normalized.customBackgroundUri;
  if (!targetUri) {
    const fallbackUri = await findExistingCustomBackgroundUri();
    if (fallbackUri) {
      return {
        ...normalized,
        backgroundPreset: "custom",
        customBackgroundUri: fallbackUri,
      };
    }
    return {
      ...normalized,
      backgroundPreset: defaultSettings.backgroundPreset,
      customBackgroundUri: null,
      customBackgroundVersion: 0,
      customBackgroundRemoteMediaId: normalized.customBackgroundRemoteMediaId,
      customBackgroundRemoteUrl: normalized.customBackgroundRemoteUrl,
    };
  }
  try {
    const info = await FileSystem.getInfoAsync(targetUri);
    if (info.exists) {
      return {
        ...normalized,
        customBackgroundUri: targetUri,
      };
    }
  } catch (error) {
    console.warn("Failed to inspect persisted custom background", error);
  }

  const fallbackUri = await findExistingCustomBackgroundUri();
  if (fallbackUri) {
    return {
      ...normalized,
      backgroundPreset: "custom",
      customBackgroundUri: fallbackUri,
    };
  }

  return {
    ...normalized,
    backgroundPreset: defaultSettings.backgroundPreset,
    customBackgroundUri: null,
    customBackgroundVersion: 0,
    customBackgroundRemoteMediaId: normalized.customBackgroundRemoteMediaId,
    customBackgroundRemoteUrl: normalized.customBackgroundRemoteUrl,
  };
}

function getFileMimeType(uri: string) {
  const format = detectImageFormatFromUri(uri);
  switch (format) {
    case "gif":
      return "image/gif";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    default:
      return "image/jpeg";
  }
}

function buildRemoteBackgroundBlobUrl(mediaId: string) {
  return `${getApiBaseUrl()}/media/v1/${encodeURIComponent(mediaId)}/blob`;
}

async function downloadRemoteBackgroundToLocal(
  mediaId: string | null | undefined,
  remoteUrl: string | null | undefined,
): Promise<string | null> {
  const sourceUrl =
    remoteUrl || (mediaId ? buildRemoteBackgroundBlobUrl(mediaId) : null);
  if (!sourceUrl) return null;

  const extension =
    detectImageFormatFromUri(remoteUrl || mediaId || "") ||
    (mediaId ? "jpg" : "jpg");
  const targetUri = getCustomBackgroundTargetUri(extension);
  const token = await TokenService.getAccessToken().catch(() => null);
  const targetDir = targetUri.slice(0, targetUri.lastIndexOf("/"));

  await FileSystem.makeDirectoryAsync(targetDir, {
    intermediates: true,
  }).catch(() => {});
  await deleteAllCustomBackgroundVariants();

  try {
    await FileSystem.downloadAsync(sourceUrl, targetUri, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return targetUri;
  } catch (error) {
    console.warn(
      "Failed to restore custom background from remote media",
      error,
    );
    return null;
  }
}

function parseVisualTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildVisualPreferencesPayload(
  settings: GlobalSettings,
): UserVisualPreferences {
  const hasRemoteCustomBackground =
    settings.backgroundPreset === "custom" &&
    !!(
      settings.customBackgroundRemoteMediaId ||
      settings.customBackgroundRemoteUrl
    );

  return {
    theme: settings.theme,
    language: settings.language,
    fontSize: settings.fontSize,
    backgroundPreset: settings.backgroundPreset,
    backgroundMediaId: hasRemoteCustomBackground
      ? (settings.customBackgroundRemoteMediaId ?? null)
      : null,
    backgroundMediaUrl: hasRemoteCustomBackground
      ? (settings.customBackgroundRemoteUrl ?? null)
      : null,
    updatedAt: settings.remoteSyncUpdatedAt ?? null,
  };
}

export function extractProfileVisualPreferences(
  profile: UserProfile | null | undefined,
): UserVisualPreferences | null {
  if (!profile) return null;
  const visual = profile.visualPreferences;
  if (visual && Object.keys(visual).length > 0) {
    return {
      theme: visual.theme,
      language: visual.language,
      fontSize: visual.fontSize,
      backgroundPreset: visual.backgroundPreset,
      backgroundMediaId:
        typeof visual.backgroundMediaId === "string"
          ? visual.backgroundMediaId
          : visual.backgroundMediaId === null
            ? null
            : null,
      backgroundMediaUrl:
        typeof visual.backgroundMediaUrl === "string"
          ? visual.backgroundMediaUrl
          : visual.backgroundMediaUrl === null
            ? null
            : null,
      updatedAt:
        typeof visual.updatedAt === "string"
          ? visual.updatedAt
          : visual.updatedAt === null
            ? null
            : null,
    };
  }

  if (!profile.backgroundMediaId && !profile.backgroundMediaUrl) {
    return null;
  }

  return {
    backgroundPreset: "custom",
    backgroundMediaId: profile.backgroundMediaId ?? null,
    backgroundMediaUrl: profile.backgroundMediaUrl ?? null,
    updatedAt: profile.updatedAt ?? null,
  };
}

export function shouldApplyRemoteVisualPreferences(
  current: GlobalSettings,
  remote: UserVisualPreferences | null | undefined,
) {
  if (!remote) return false;
  const remoteUpdatedAt = parseVisualTimestamp(remote.updatedAt);
  const localUpdatedAt = parseVisualTimestamp(current.remoteSyncUpdatedAt);

  if (remoteUpdatedAt && remoteUpdatedAt > localUpdatedAt) {
    return true;
  }

  if (!localUpdatedAt) {
    return Boolean(
      remote.theme ||
      remote.language ||
      remote.fontSize ||
      remote.backgroundPreset ||
      remote.backgroundMediaId ||
      remote.backgroundMediaUrl,
    );
  }

  if (
    current.backgroundPreset === "custom" &&
    remote.backgroundPreset === "custom" &&
    (current.customBackgroundRemoteMediaId ?? null) !==
      (remote.backgroundMediaId ?? null)
  ) {
    return true;
  }

  return false;
}

async function hydrateRemoteVisualPreferences(
  current: GlobalSettings,
  profile?: UserProfile | null,
): Promise<GlobalSettings> {
  const remoteVisualPreferences = extractProfileVisualPreferences(
    profile ?? null,
  ) ?? {
    backgroundPreset:
      current.customBackgroundRemoteMediaId || current.customBackgroundRemoteUrl
        ? "custom"
        : undefined,
    backgroundMediaId: current.customBackgroundRemoteMediaId ?? null,
    backgroundMediaUrl: current.customBackgroundRemoteUrl ?? null,
    updatedAt: current.remoteSyncUpdatedAt ?? null,
  };
  const remoteMediaId =
    remoteVisualPreferences.backgroundMediaId ??
    current.customBackgroundRemoteMediaId;
  const remoteUrl =
    remoteVisualPreferences.backgroundMediaUrl ??
    current.customBackgroundRemoteUrl;

  if (remoteMediaId || remoteUrl) {
    const restoredUri = await downloadRemoteBackgroundToLocal(
      remoteMediaId,
      remoteUrl,
    );
    if (restoredUri) {
      return {
        ...current,
        backgroundPreset: "custom",
        customBackgroundUri: restoredUri,
        customBackgroundVersion: Date.now(),
        customBackgroundRemoteMediaId: remoteMediaId ?? null,
        customBackgroundRemoteUrl: remoteUrl ?? null,
        remoteSyncUpdatedAt:
          remoteVisualPreferences.updatedAt ??
          current.remoteSyncUpdatedAt ??
          null,
      };
    }
  }

  return {
    ...current,
    customBackgroundRemoteMediaId: remoteMediaId ?? null,
    customBackgroundRemoteUrl: remoteUrl ?? null,
    remoteSyncUpdatedAt:
      remoteVisualPreferences.updatedAt ?? current.remoteSyncUpdatedAt ?? null,
  };
}

async function mergeRemoteVisualPreferencesIntoSettings(
  current: GlobalSettings,
  remote: UserVisualPreferences,
): Promise<GlobalSettings> {
  const nextBase: GlobalSettings = normalizeSettings({
    ...current,
    theme: remote.theme ?? current.theme,
    language: remote.language ?? current.language,
    fontSize: remote.fontSize ?? current.fontSize,
    backgroundPreset:
      remote.backgroundPreset ??
      (remote.backgroundMediaId || remote.backgroundMediaUrl
        ? "custom"
        : current.backgroundPreset),
    customBackgroundRemoteMediaId:
      remote.backgroundMediaId ?? current.customBackgroundRemoteMediaId ?? null,
    customBackgroundRemoteUrl:
      remote.backgroundMediaUrl ?? current.customBackgroundRemoteUrl ?? null,
    remoteSyncUpdatedAt:
      remote.updatedAt ?? current.remoteSyncUpdatedAt ?? null,
  });

  if (
    (remote.backgroundPreset &&
      remote.backgroundPreset !== "custom" &&
      remote.backgroundPreset !== current.backgroundPreset) ||
    (remote.backgroundPreset &&
      remote.backgroundPreset !== "custom" &&
      current.backgroundPreset === "custom")
  ) {
    return {
      ...nextBase,
      customBackgroundUri: null,
      customBackgroundVersion: 0,
      customBackgroundRemoteMediaId: null,
      customBackgroundRemoteUrl: null,
    };
  }

  if (
    nextBase.backgroundPreset === "custom" ||
    remote.backgroundMediaId ||
    remote.backgroundMediaUrl
  ) {
    return hydrateRemoteVisualPreferences(nextBase);
  }

  return nextBase;
}

async function hydrateRemoteBackgroundFallback(
  current: GlobalSettings,
): Promise<GlobalSettings> {
  const token = await TokenService.getAccessToken().catch(() => null);
  if (!token) {
    return current;
  }

  try {
    const result = await UserService.getInstance().getProfile();
    if (!result.success || !result.profile) {
      return current;
    }

    const remoteVisualPreferences = extractProfileVisualPreferences(
      result.profile,
    );
    if (!shouldApplyRemoteVisualPreferences(current, remoteVisualPreferences)) {
      return current;
    }

    return mergeRemoteVisualPreferencesIntoSettings(
      current,
      remoteVisualPreferences as UserVisualPreferences,
    );
  } catch (error) {
    console.warn("Failed to hydrate visual preferences from backend", error);
    return current;
  }
}

// Default settings
const defaultSettings: GlobalSettings = {
  theme: "dark",
  language: "fr",
  fontSize: "medium",
  backgroundPreset: "whispr",
  customBackgroundUri: null,
  customBackgroundVersion: 0,
  customBackgroundRemoteMediaId: null,
  customBackgroundRemoteUrl: null,
  remoteSyncUpdatedAt: null,
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
    "auth.skip": "Passer",
    "auth.linkedAccount": "Compte associé :",

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
    "settings.background": "Arrière-plan",
    "settings.language": "Langue",
    "settings.fontSize": "Taille de police",
    "settings.myProfile": "Mon profil",
    "settings.myProfileSubtitle": "Modifier vos informations personnelles",
    "settings.logout": "Déconnexion",
    "settings.deleteAccount": "Supprimer le compte",
    "settings.theme.light": "Clair",
    "settings.theme.dark": "Sombre",
    "settings.theme.auto": "Automatique",
    "settings.background.whispr": "Whispr",
    "settings.background.midnight": "Minuit",
    "settings.background.sunset": "Sunset",
    "settings.background.aurora": "Aurora",
    "settings.background.custom": "Photo personnalisée",
    "settings.background.upload": "Choisir une photo",
    "settings.background.remove": "Retirer la photo",
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
    "common.optional": "optionnel",
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
    "auth.skip": "Skip",
    "auth.linkedAccount": "Linked account:",

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
    "settings.background": "Background",
    "settings.language": "Language",
    "settings.fontSize": "Font size",
    "settings.myProfile": "My profile",
    "settings.myProfileSubtitle": "Edit your personal information",
    "settings.logout": "Logout",
    "settings.deleteAccount": "Delete account",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.theme.auto": "Auto",
    "settings.background.whispr": "Whispr",
    "settings.background.midnight": "Midnight",
    "settings.background.sunset": "Sunset",
    "settings.background.aurora": "Aurora",
    "settings.background.custom": "Custom photo",
    "settings.background.upload": "Choose a photo",
    "settings.background.remove": "Remove photo",
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
    "common.optional": "optional",
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
  const settingsRef = useRef<GlobalSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const pendingRemoteVisualSyncRef = useRef<GlobalSettings | null>(null);
  const remoteVisualSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastRemoteVisualFetchAtRef = useRef(0);
  // WHISPR-1072: watch the OS-level color scheme so "auto" actually follows
  // the system preference instead of silently defaulting to dark.
  const systemColorScheme = useColorScheme();

  const applySettingsLocally = useCallback(
    async (nextSettings: GlobalSettings) => {
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      applyRuntimeBackgroundGradient(
        BACKGROUND_PRESET_GRADIENTS[nextSettings.backgroundPreset],
      );
      await persistSettingsCaches(nextSettings);
    },
    [],
  );

  const flushPendingRemoteVisualSync = useCallback(async () => {
    const pendingSettings = pendingRemoteVisualSyncRef.current;
    if (!pendingSettings) {
      return;
    }

    pendingRemoteVisualSyncRef.current = null;

    try {
      const response = await UserService.getInstance().updateVisualPreferences(
        buildVisualPreferencesPayload(pendingSettings),
      );

      if (!response.success) {
        pendingRemoteVisualSyncRef.current = pendingSettings;
        return;
      }

      const remoteVisualPreferences = extractProfileVisualPreferences(
        response.profile,
      );
      if (!remoteVisualPreferences) {
        return;
      }

      const merged = await mergeRemoteVisualPreferencesIntoSettings(
        settingsRef.current,
        remoteVisualPreferences,
      );
      await applySettingsLocally(merged);
    } catch (error) {
      pendingRemoteVisualSyncRef.current = pendingSettings;
      console.warn("Failed to sync visual preferences to backend", error);
    }
  }, [applySettingsLocally]);

  const scheduleRemoteVisualSync = useCallback(
    (nextSettings: GlobalSettings) => {
      pendingRemoteVisualSyncRef.current = nextSettings;
      if (remoteVisualSyncTimerRef.current) {
        clearTimeout(remoteVisualSyncTimerRef.current);
      }

      remoteVisualSyncTimerRef.current = setTimeout(() => {
        remoteVisualSyncTimerRef.current = null;
        flushPendingRemoteVisualSync().catch(() => {});
      }, REMOTE_VISUAL_SYNC_DEBOUNCE_MS);
    },
    [flushPendingRemoteVisualSync],
  );

  const syncRemoteVisualPreferences = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (
        !force &&
        now - lastRemoteVisualFetchAtRef.current <
          REMOTE_VISUAL_FETCH_MIN_INTERVAL_MS
      ) {
        return;
      }

      lastRemoteVisualFetchAtRef.current = now;

      const token = await TokenService.getAccessToken().catch(() => null);
      if (!token) {
        return;
      }

      try {
        const result = await UserService.getInstance().getProfile();
        if (!result.success || !result.profile) {
          return;
        }

        const remoteVisualPreferences = extractProfileVisualPreferences(
          result.profile,
        );
        if (
          !shouldApplyRemoteVisualPreferences(
            settingsRef.current,
            remoteVisualPreferences,
          )
        ) {
          return;
        }

        const merged = await mergeRemoteVisualPreferencesIntoSettings(
          settingsRef.current,
          remoteVisualPreferences as UserVisualPreferences,
        );
        await applySettingsLocally(merged);
      } catch (error) {
        console.warn("Failed to fetch remote visual preferences", error);
      }
    },
    [applySettingsLocally],
  );

  // Load settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [[, visualCached], [, stored]] = await AsyncStorage.multiGet([
          VISUAL_CACHE_KEY,
          STORAGE_KEY,
        ]);
        const preferredSnapshot = visualCached || stored;
        if (preferredSnapshot) {
          let parsed = await resolvePersistedSettings(
            JSON.parse(preferredSnapshot) as Partial<GlobalSettings>,
          );
          parsed = await hydrateRemoteBackgroundFallback(parsed);
          applyRuntimeBackgroundGradient(
            BACKGROUND_PRESET_GRADIENTS[parsed.backgroundPreset],
          );
          await applySettingsLocally(parsed);
        } else {
          const hydrated =
            await hydrateRemoteBackgroundFallback(defaultSettings);
          applyRuntimeBackgroundGradient(
            BACKGROUND_PRESET_GRADIENTS[hydrated.backgroundPreset],
          );
          await applySettingsLocally(hydrated);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        applyRuntimeBackgroundGradient(
          BACKGROUND_PRESET_GRADIENTS[defaultSettings.backgroundPreset],
        );
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, [applySettingsLocally]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const syncActiveDevice = async (force = false) => {
      await flushPendingRemoteVisualSync();
      await syncRemoteVisualPreferences(force);
    };

    syncActiveDevice(true).catch(() => {});

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncActiveDevice(true).catch(() => {});
      }
    });

    const pollId = setInterval(() => {
      if (AppState.currentState === "active") {
        syncActiveDevice(false).catch(() => {});
      }
    }, REMOTE_VISUAL_POLL_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(pollId);
    };
  }, [flushPendingRemoteVisualSync, isLoaded, syncRemoteVisualPreferences]);

  useEffect(() => {
    return () => {
      if (remoteVisualSyncTimerRef.current) {
        clearTimeout(remoteVisualSyncTimerRef.current);
      }
    };
  }, []);

  // Update settings
  const updateSettings = useCallback(
    async (
      newSettings: Partial<GlobalSettings>,
      options?: {
        skipRemoteSync?: boolean;
        preserveRemoteSyncTimestamp?: boolean;
      },
    ) => {
      const baseUpdated = normalizeSettings({
        ...settingsRef.current,
        ...newSettings,
      });
      const shouldQueueRemoteSync =
        !options?.skipRemoteSync &&
        shouldSyncVisualPreferences(baseUpdated, newSettings);
      const updated = shouldQueueRemoteSync
        ? {
            ...baseUpdated,
            remoteSyncUpdatedAt:
              options?.preserveRemoteSyncTimestamp &&
              baseUpdated.remoteSyncUpdatedAt
                ? baseUpdated.remoteSyncUpdatedAt
                : new Date().toISOString(),
          }
        : baseUpdated;

      try {
        await applySettingsLocally(updated);
        if (shouldQueueRemoteSync) {
          scheduleRemoteVisualSync(updated);
        }
      } catch (error) {
        console.error("Error saving settings:", error);
      }
    },
    [applySettingsLocally, scheduleRemoteVisualSync],
  );

  const saveCustomBackground = async (sourceUri: string) => {
    const format = detectImageFormatFromUri(sourceUri);
    const preserveAnimatedGif = format === "gif";
    const targetUri = getCustomBackgroundTargetUri(
      preserveAnimatedGif ? "gif" : "jpg",
    );
    const targetDir = targetUri.slice(0, targetUri.lastIndexOf("/"));

    await FileSystem.makeDirectoryAsync(targetDir, {
      intermediates: true,
    }).catch(() => {});
    await deleteAllCustomBackgroundVariants();

    let renderedUri = sourceUri;
    if (!preserveAnimatedGif) {
      const rendered = await ImageManipulator.manipulateAsync(sourceUri, [], {
        compress: 0.92,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      renderedUri = rendered.uri;
    }

    await FileSystem.copyAsync({
      from: renderedUri,
      to: targetUri,
    });
    if (renderedUri !== sourceUri) {
      await FileSystem.deleteAsync(renderedUri, {
        idempotent: true,
      }).catch(() => {});
    }

    await updateSettings(
      {
        backgroundPreset: "custom",
        customBackgroundUri: targetUri,
        customBackgroundVersion: Date.now(),
      },
      { skipRemoteSync: true },
    );

    try {
      const tokenPayload = TokenService.decodeAccessToken(
        (await TokenService.getAccessToken()) || "",
      );
      const ownerId = tokenPayload?.sub;
      if (!ownerId) return;

      const fileName =
        sourceUri.split("/").pop() ||
        `background.${preserveAnimatedGif ? "gif" : "jpg"}`;
      const uploadResult = await MediaService.uploadMedia(
        {
          uri: targetUri,
          name: fileName,
          type: getFileMimeType(targetUri),
        },
        undefined,
        {
          context: "message",
          ownerId,
        },
      );

      const remoteSettings: Partial<GlobalSettings> = {
        customBackgroundRemoteMediaId: uploadResult.id,
        customBackgroundRemoteUrl: uploadResult.url ?? null,
      };

      await updateSettings(remoteSettings, { skipRemoteSync: true });

      const response = await UserService.getInstance().updateProfileBackground(
        uploadResult.id,
        uploadResult.url ?? null,
      );
      const remoteVisualPreferences = extractProfileVisualPreferences(
        response.profile,
      );
      if (response.success && remoteVisualPreferences) {
        const merged = await mergeRemoteVisualPreferencesIntoSettings(
          settingsRef.current,
          remoteVisualPreferences,
        );
        await applySettingsLocally(merged);
      }
    } catch (error) {
      console.warn("Failed to sync custom background to backend", error);
    }
  };

  const clearCustomBackground = async () => {
    await deleteAllCustomBackgroundVariants();

    await updateSettings(
      {
        backgroundPreset: defaultSettings.backgroundPreset,
        customBackgroundUri: null,
        customBackgroundVersion: 0,
        customBackgroundRemoteMediaId: null,
        customBackgroundRemoteUrl: null,
      },
      { skipRemoteSync: true },
    );

    const response = await UserService.getInstance().updateProfileBackground(
      null,
      null,
    );
    const remoteVisualPreferences = extractProfileVisualPreferences(
      response.profile,
    );
    if (response.success && remoteVisualPreferences) {
      const merged = await mergeRemoteVisualPreferencesIntoSettings(
        settingsRef.current,
        remoteVisualPreferences,
      );
      await applySettingsLocally(merged);
    }
  };

  // Get theme colors based on current theme (delegates to the pure helper
  // so the resolution logic can be unit-tested without mounting RN).
  const getThemeColors = (): ThemeColors => {
    const resolved = resolveThemeColors(settings.theme, systemColorScheme);
    return {
      ...resolved,
      background: {
        ...resolved.background,
        gradient: BACKGROUND_PRESET_GRADIENTS[settings.backgroundPreset],
      },
    };
  };

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
    saveCustomBackground,
    clearCustomBackground,
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
