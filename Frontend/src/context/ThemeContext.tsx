/**
 * ThemeContext - Global Theme, Language, and Font Size Management
 * Provides centralized theme, language, and font size management across the app
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export type Theme = 'light' | 'dark' | 'auto';
export type Language = 'fr' | 'en';
export type FontSize = 'small' | 'medium' | 'large';

export interface GlobalSettings {
  theme: Theme;
  language: Language;
  fontSize: FontSize;
}

interface ThemeContextType {
  settings: GlobalSettings;
  updateSettings: (newSettings: Partial<GlobalSettings>) => Promise<void>;
  getThemeColors: () => ThemeColors;
  getFontSize: (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'xxl' | 'xxxl') => number;
  getLocalizedText: (key: string) => string;
}

interface ThemeColors {
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    gradient: string[];
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

const STORAGE_KEY = 'whispr.globalSettings.v1';

// Default settings
const defaultSettings: GlobalSettings = {
  theme: 'dark',
  language: 'fr',
  fontSize: 'medium',
};

// Localized texts
const localizedTexts: Record<Language, Record<string, string>> = {
  fr: {
    // Navigation
    'nav.profile': 'Profil',
    'nav.settings': 'Paramètres',
    'nav.logout': 'Déconnexion',
    
    // Auth
    'auth.login': 'Connexion',
    'auth.register': 'Inscription',
    'auth.phone': 'Numéro de téléphone',
    'auth.password': 'Mot de passe',
    'auth.verify': 'Vérifier',
    'auth.resend': 'Renvoyer le code',
    'auth.continue': 'Continuer',
    'auth.seConnecter': 'Se connecter',
    'auth.creerCompte': 'Créer un compte',
    'auth.dejaCompte': 'Déjà un compte ?',
    'auth.pasEncoreCompte': 'Pas encore de compte ?',
    'auth.tagline': 'Sécurisé. Privé. Simple.',
    'auth.smsCode': 'Nous vous enverrons un code de vérification par SMS',
    'auth.searchCountry': 'Rechercher un pays...',
    'auth.noCountryFound': 'Aucun pays trouvé',
    'auth.enterPhone': 'Veuillez entrer votre numéro de téléphone',
    'auth.phoneMinLength': 'Le numéro de téléphone doit contenir au moins 10 chiffres',
    'auth.phoneInvalidFormat': 'Format de numéro invalide (ex: 07 12 34 56 78)',
    'auth.errorConnection': 'Une erreur est survenue lors de la connexion',
    'auth.errorSendCode': 'Impossible d\'envoyer le code de vérification',
    'auth.verificationTitle': 'Vérification',
    'auth.verificationSubtitle': 'Entrez le code envoyé à',
    'auth.resendIn': 'Renvoyer dans',
    'auth.resendCode': 'Renvoyer le code',
    'auth.codeIncorrect': 'Code incorrect',
    'auth.loginSuccess': 'Connexion réussie ! ✅',
    'auth.welcome': 'Bienvenue sur Whispr',
    'auth.codeVerified': 'Code vérifié ! ✅',
    'auth.phoneVerified': 'Votre numéro est maintenant vérifié',
    'auth.profileSetup': 'Configuration du profil',
    'auth.profileSetupSubtitle': 'Complétez votre profil pour commencer',
    'auth.firstName': 'Prénom',
    'auth.lastName': 'Nom',
    'auth.profilePhoto': 'Photo de profil',
    'auth.selectPhoto': 'Sélectionner une photo',
    'auth.takePhoto': 'Prendre une photo',
    'auth.chooseFromLibrary': 'Choisir depuis la bibliothèque',
    'auth.cancel': 'Annuler',
    
    // Profile
    'profile.title': 'Profil',
    'profile.edit': 'Modifier',
    'profile.save': 'Enregistrer',
    'profile.cancel': 'Annuler',
    'profile.firstName': 'Prénom',
    'profile.lastName': 'Nom',
    'profile.username': 'Nom d\'utilisateur',
    'profile.phone': 'Téléphone',
    'profile.bio': 'Biographie',
    'profile.online': 'En ligne',
    'profile.offline': 'Hors ligne',
    
    // Settings
    'settings.title': 'Paramètres',
    'settings.privacy': 'Confidentialité',
    'settings.notifications': 'Notifications',
    'settings.messaging': 'Messagerie',
    'settings.application': 'Application',
    'settings.security': 'Sécurité',
    'settings.account': 'Compte',
    'settings.theme': 'Thème',
    'settings.language': 'Langue',
    'settings.fontSize': 'Taille de police',
    'settings.logout': 'Déconnexion',
    'settings.deleteAccount': 'Supprimer le compte',
    'settings.theme.light': 'Clair',
    'settings.theme.dark': 'Sombre',
    'settings.theme.auto': 'Automatique',
    'settings.language.fr': 'Français',
    'settings.language.en': 'Anglais',
    'settings.fontSize.small': 'Petit',
    'settings.fontSize.medium': 'Moyen',
    'settings.fontSize.large': 'Grand',
    
    // Notifications
    'notif.success': 'Succès',
    'notif.error': 'Erreur',
    'notif.profileSaved': 'Profil enregistré avec succès',
    'notif.logoutSuccess': 'Déconnexion réussie',
    'notif.deleteAccountSuccess': 'Compte supprimé avec succès',
    'notif.logoutConfirm': 'Êtes-vous sûr de vouloir vous déconnecter ?',
    'notif.deleteAccountConfirm': 'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
    
    // Security
    'security.title': 'Clés de sécurité',
    'security.connectedDevices': 'Appareils connectés',
    'security.connectedDevicesSubtitle': 'Gérez les appareils connectés à votre compte',
    'security.securityKeys': 'Clés de sécurité',
    'security.securityKeysSubtitle': 'Vérifiez et gérez vos clés de chiffrement',
    'security.currentDevice': 'Appareil actuel',
    'security.disconnectDevice': 'Déconnecter l\'appareil',
    'security.disconnectDeviceMessage': 'Voulez-vous déconnecter',
    'security.disconnect': 'Déconnecter',
    'security.cannotDisconnectCurrent': 'Impossible de déconnecter',
    'security.cannotDisconnectCurrentMessage': 'Vous ne pouvez pas déconnecter l\'appareil actuel',
    'security.deviceDisconnected': 'Appareil déconnecté avec succès',
    'security.viewSecurityCode': 'Voir le code de sécurité',
    'security.securityCode': 'Code de sécurité',
    'security.verifyCode': 'Vérifier le code',
    'security.enterCode': 'Entrez le code',
    'security.verify': 'Vérifier',
    'security.codeVerified': 'Code vérifié avec succès',
    'security.invalidCode': 'Code invalide',
    'security.codeCopied': 'Code copié dans le presse-papiers',
    'security.scanQRCode': 'Scanner le code QR',
    'security.qrScannerComingSoon': 'Le scanner QR sera disponible prochainement',
    'security.createdOn': 'Créé le',
    'security.infoMessage': 'Ces clés permettent de vérifier l\'identité de vos appareils et de sécuriser vos conversations.',
    'security.showSecurityKeys': 'Afficher les clés de sécurité',
    'security.hideSecurityKeys': 'Masquer les clés de sécurité',
    
    // Two Factor Authentication
    'twoFactor.title': 'Authentification à deux facteurs',
    'twoFactor.infoMessage': 'Ajoutez une couche de sécurité supplémentaire à votre compte en activant l\'authentification à deux facteurs.',
    'twoFactor.authentication': 'Authentification à deux facteurs',
    'twoFactor.authenticationSubtitle': 'Protégez votre compte avec une couche de sécurité supplémentaire',
    'twoFactor.enable2FA': 'Activer l\'authentification à deux facteurs',
    'twoFactor.enable2FASubtitle': 'Exiger un code de vérification en plus de votre mot de passe',
    'twoFactor.disable': 'Désactiver',
    'twoFactor.disableConfirm': 'Êtes-vous sûr de vouloir désactiver l\'authentification à deux facteurs ? Cela rendra votre compte moins sécurisé.',
    'twoFactor.enabled': 'Authentification à deux facteurs activée avec succès',
    'twoFactor.disabled': 'Authentification à deux facteurs désactivée',
    'twoFactor.qrCode': 'Code QR',
    'twoFactor.qrCodeSubtitle': 'Scannez ce code avec votre application d\'authentification',
    'twoFactor.viewQRCode': 'Voir le code QR',
    'twoFactor.viewQRCodeSubtitle': 'Scanner avec votre application d\'authentification',
    'twoFactor.setupQRCode': 'Configurer le code QR',
    'twoFactor.scanQRCode': 'Scanner le code QR',
    'twoFactor.qrScannerComingSoon': 'Le scanner QR sera disponible prochainement',
    'twoFactor.enterVerificationCode': 'Entrez le code de vérification de votre application d\'authentification',
    'twoFactor.enterCode': 'Entrez le code',
    'twoFactor.verify': 'Vérifier',
    'twoFactor.invalidCode': 'Code de vérification invalide',
    'twoFactor.recoveryCodes': 'Codes de récupération',
    'twoFactor.recoveryCodesSubtitle': 'Utilisez ces codes si vous perdez l\'accès à votre application d\'authentification',
    'twoFactor.viewRecoveryCodes': 'Voir les codes de récupération',
    'twoFactor.viewRecoveryCodesSubtitle': 'Enregistrez ces codes dans un endroit sûr',
    'twoFactor.recoveryCodesInfo': 'Enregistrez ces codes dans un endroit sûr. Vous pouvez les utiliser pour accéder à votre compte si vous perdez votre appareil.',
    'twoFactor.codeCopied': 'Code copié dans le presse-papiers',
    
    // Common
    'common.confirm': 'Confirmer',
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.delete': 'Supprimer',
    'common.yes': 'Oui',
    'common.no': 'Non',
    'common.ok': 'OK',
  },
  en: {
    // Navigation
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    
    // Auth
    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.phone': 'Phone number',
    'auth.password': 'Password',
    'auth.verify': 'Verify',
    'auth.resend': 'Resend code',
    'auth.continue': 'Continue',
    'auth.seConnecter': 'Log in',
    'auth.creerCompte': 'Create account',
    'auth.dejaCompte': 'Already have an account?',
    'auth.pasEncoreCompte': 'No account yet?',
    'auth.tagline': 'Secure. Private. Simple.',
    'auth.smsCode': 'We will send you a verification code by SMS',
    'auth.searchCountry': 'Search for a country...',
    'auth.noCountryFound': 'No country found',
    'auth.enterPhone': 'Please enter your phone number',
    'auth.phoneMinLength': 'Phone number must contain at least 10 digits',
    'auth.phoneInvalidFormat': 'Invalid phone format (e.g.: 07 12 34 56 78)',
    'auth.errorConnection': 'An error occurred during connection',
    'auth.errorSendCode': 'Unable to send verification code',
    'auth.verificationTitle': 'Verification',
    'auth.verificationSubtitle': 'Enter the code sent to',
    'auth.resendIn': 'Resend in',
    'auth.resendCode': 'Resend code',
    'auth.codeIncorrect': 'Incorrect code',
    'auth.loginSuccess': 'Login successful! ✅',
    'auth.welcome': 'Welcome to Whispr',
    'auth.codeVerified': 'Code verified! ✅',
    'auth.phoneVerified': 'Your number is now verified',
    'auth.profileSetup': 'Profile Setup',
    'auth.profileSetupSubtitle': 'Complete your profile to get started',
    'auth.firstName': 'First name',
    'auth.lastName': 'Last name',
    'auth.profilePhoto': 'Profile photo',
    'auth.selectPhoto': 'Select a photo',
    'auth.takePhoto': 'Take a photo',
    'auth.chooseFromLibrary': 'Choose from library',
    'auth.cancel': 'Cancel',
    
    // Profile
    'profile.title': 'Profile',
    'profile.edit': 'Edit',
    'profile.save': 'Save',
    'profile.cancel': 'Cancel',
    'profile.firstName': 'First name',
    'profile.lastName': 'Last name',
    'profile.username': 'Username',
    'profile.phone': 'Phone',
    'profile.bio': 'Biography',
    'profile.online': 'Online',
    'profile.offline': 'Offline',
    
    // Settings
    'settings.title': 'Settings',
    'settings.privacy': 'Privacy',
    'settings.notifications': 'Notifications',
    'settings.messaging': 'Messaging',
    'settings.application': 'Application',
    'settings.security': 'Security',
    'settings.account': 'Account',
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'settings.fontSize': 'Font size',
    'settings.logout': 'Logout',
    'settings.deleteAccount': 'Delete account',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.theme.auto': 'Auto',
    'settings.language.fr': 'French',
    'settings.language.en': 'English',
    'settings.fontSize.small': 'Small',
    'settings.fontSize.medium': 'Medium',
    'settings.fontSize.large': 'Large',
    
    // Notifications
    'notif.success': 'Success',
    'notif.error': 'Error',
    'notif.profileSaved': 'Profile saved successfully',
    'notif.logoutSuccess': 'Logout successful',
    'notif.deleteAccountSuccess': 'Account deleted successfully',
    'notif.logoutConfirm': 'Are you sure you want to log out?',
    'notif.deleteAccountConfirm': 'Are you sure you want to delete your account? This action is irreversible.',
    
    // Security
    'security.title': 'Security Keys',
    'security.connectedDevices': 'Connected Devices',
    'security.connectedDevicesSubtitle': 'Manage devices connected to your account',
    'security.securityKeys': 'Security Keys',
    'security.securityKeysSubtitle': 'Verify and manage your encryption keys',
    'security.currentDevice': 'Current device',
    'security.disconnectDevice': 'Disconnect Device',
    'security.disconnectDeviceMessage': 'Do you want to disconnect',
    'security.disconnect': 'Disconnect',
    'security.cannotDisconnectCurrent': 'Cannot disconnect',
    'security.cannotDisconnectCurrentMessage': 'You cannot disconnect the current device',
    'security.deviceDisconnected': 'Device disconnected successfully',
    'security.viewSecurityCode': 'View Security Code',
    'security.securityCode': 'Security Code',
    'security.verifyCode': 'Verify Code',
    'security.enterCode': 'Enter code',
    'security.verify': 'Verify',
    'security.codeVerified': 'Code verified successfully',
    'security.invalidCode': 'Invalid code',
    'security.codeCopied': 'Code copied to clipboard',
    'security.scanQRCode': 'Scan QR Code',
    'security.qrScannerComingSoon': 'QR scanner will be available soon',
    'security.createdOn': 'Created on',
    'security.infoMessage': 'These keys allow you to verify your devices\' identity and secure your conversations.',
    'security.showSecurityKeys': 'Show security keys',
    'security.hideSecurityKeys': 'Hide security keys',
    
    // Two Factor Authentication
    'twoFactor.title': 'Two-Factor Authentication',
    'twoFactor.infoMessage': 'Add an extra layer of security to your account by enabling two-factor authentication.',
    'twoFactor.authentication': 'Two-Factor Authentication',
    'twoFactor.authenticationSubtitle': 'Protect your account with an additional security layer',
    'twoFactor.enable2FA': 'Enable Two-Factor Authentication',
    'twoFactor.enable2FASubtitle': 'Require a verification code in addition to your password',
    'twoFactor.disable': 'Disable',
    'twoFactor.disableConfirm': 'Are you sure you want to disable two-factor authentication? This will make your account less secure.',
    'twoFactor.enabled': 'Two-factor authentication enabled successfully',
    'twoFactor.disabled': 'Two-factor authentication disabled',
    'twoFactor.qrCode': 'QR Code',
    'twoFactor.qrCodeSubtitle': 'Scan this code with your authenticator app',
    'twoFactor.viewQRCode': 'View QR Code',
    'twoFactor.viewQRCodeSubtitle': 'Scan with your authenticator app',
    'twoFactor.setupQRCode': 'Setup QR Code',
    'twoFactor.scanQRCode': 'Scan QR Code',
    'twoFactor.qrScannerComingSoon': 'QR scanner will be available soon',
    'twoFactor.enterVerificationCode': 'Enter the verification code from your authenticator app',
    'twoFactor.enterCode': 'Enter code',
    'twoFactor.verify': 'Verify',
    'twoFactor.invalidCode': 'Invalid verification code',
    'twoFactor.recoveryCodes': 'Recovery Codes',
    'twoFactor.recoveryCodesSubtitle': 'Use these codes if you lose access to your authenticator app',
    'twoFactor.viewRecoveryCodes': 'View Recovery Codes',
    'twoFactor.viewRecoveryCodesSubtitle': 'Save these codes in a safe place',
    'twoFactor.recoveryCodesInfo': 'Save these codes in a safe place. You can use them to access your account if you lose your device.',
    'twoFactor.codeCopied': 'Code copied to clipboard',
    
    // Common
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.ok': 'OK',
  },
};

// Theme color palettes
const lightThemeColors: ThemeColors = {
  background: {
    primary: '#FFFFFF',
    secondary: '#F6F6F6',
    tertiary: '#ABABAB',
    gradient: ['#FFFFFF', '#F6F6F6'],
  },
  text: {
    primary: '#000000',
    secondary: '#545458',
    tertiary: '#767680',
  },
  primary: '#FE7A5C',
  secondary: '#6774BD',
  error: '#FF3B30',
  success: '#21C004',
  warning: '#F04882',
  info: '#6774BD',
};

const darkThemeColors: ThemeColors = {
  background: {
    primary: '#0B1124', // Dark navy from gradient
    secondary: '#1A1F3A', // Dark card color
    tertiary: '#212135', // Dark tertiary
    gradient: ['#0B1124', '#3C2E7C', '#FE7A5C'],
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#ABABAB',
    tertiary: '#8E8E93',
  },
  primary: '#FE7A5C',
  secondary: '#6774BD',
  error: '#FF3B30',
  success: '#21C004',
  warning: '#F04882',
  info: '#6774BD',
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

// Context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<GlobalSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

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
        console.error('❌ Error loading settings:', error);
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
      console.log('✅ Settings updated:', updated);
    } catch (error) {
      console.error('❌ Error saving settings:', error);
    }
  };

  // Get theme colors based on current theme
  const getThemeColors = (): ThemeColors => {
    if (settings.theme === 'light') {
      return lightThemeColors;
    } else if (settings.theme === 'dark') {
      return darkThemeColors;
    } else {
      // Auto: use dark for now (could be system-based)
      return darkThemeColors;
    }
  };

  // Get font size with multiplier
  const getFontSize = (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'xxl' | 'xxxl'): number => {
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

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Hook
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

