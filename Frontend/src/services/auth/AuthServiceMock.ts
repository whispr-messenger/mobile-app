/**
 * AuthServiceMock - Version avec données mockées
 * Utilisée pour le développement sans backend
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  IAuthService,
  PhoneNumber,
  VerificationCode,
  UserProfile,
  AuthResponse,
} from './types';

export class AuthServiceMock implements IAuthService {
  // Store pour simuler les données
  private mockVerificationIds: Map<string, string> = new Map();

  /**
   * Demande un code de vérification pour l'inscription
   */
  async requestRegistrationVerification(
    phoneNumber: PhoneNumber,
  ): Promise<{ success: boolean; verificationId?: string; message?: string }> {
    try {
      // Validation
      const validation = this.validatePhoneNumber(phoneNumber);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error,
        };
      }

      // Simulation d'un délai réseau
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Générer un mock verificationId
      const mockVerificationId = `mock-verification-${Date.now()}`;
      const fullPhone = phoneNumber.countryCode + phoneNumber.number.replace(/\s/g, '');
      this.mockVerificationIds.set(mockVerificationId, fullPhone);

      console.log('[AuthMock] Registration verification requested:', fullPhone);

      return {
        success: true,
        verificationId: mockVerificationId,
        message: 'Code de vérification envoyé',
      };
    } catch (error) {
      console.error('[AuthMock] Erreur demande inscription:', error);
      return {
        success: false,
        message: "Erreur lors de l'envoi du code",
      };
    }
  }

  /**
   * Confirme le code de vérification pour l'inscription
   */
  async confirmRegistrationVerification(
    verificationId: string,
    code: VerificationCode,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Validation
      const validation = this.validateVerificationCode(code.code);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error,
        };
      }

      // Simulation d'un délai réseau
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Pour le développement, on accepte le code "123456"
      if (code.code === '123456' && this.mockVerificationIds.has(verificationId)) {
        console.log('[AuthMock] Registration verification confirmed:', verificationId);
        return {
          success: true,
          message: 'Code vérifié avec succès',
        };
      }

      return {
        success: false,
        message: 'Code incorrect',
      };
    } catch (error) {
      console.error('[AuthMock] Erreur vérification inscription:', error);
      return {
        success: false,
        message: 'Erreur lors de la vérification',
      };
    }
  }

  /**
   * Finalise l'inscription
   */
  async register(
    verificationId: string,
    profile: UserProfile,
    deviceInfo?: any,
  ): Promise<{ success: boolean; data?: AuthResponse; message?: string }> {
    try {
      // Validation
      const validation = this.validateProfile(profile);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error,
        };
      }

      // Vérifier que le verificationId existe
      if (!this.mockVerificationIds.has(verificationId)) {
        return {
          success: false,
          message: 'Code de vérification invalide ou expiré',
        };
      }

      // Simulation d'un délai réseau
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock response
      const mockAuthResponse: AuthResponse = {
        accessToken: `mock-access-token-${Date.now()}`,
        refreshToken: `mock-refresh-token-${Date.now()}`,
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: {
          id: `mock-user-${Date.now()}`,
          phoneNumber: this.mockVerificationIds.get(verificationId) || '',
          firstName: profile.firstName,
          lastName: profile.lastName,
          twoFactorEnabled: false,
        },
        device: {
          id: `mock-device-${Date.now()}`,
          deviceName: deviceInfo?.name || 'Mock Device',
          deviceType: deviceInfo?.type || 'mobile',
          isVerified: true,
        },
      };

      // Sauvegarder les tokens
      await AsyncStorage.setItem('whispr.auth.token', mockAuthResponse.accessToken);
      await AsyncStorage.setItem('whispr.auth.refreshToken', mockAuthResponse.refreshToken);
      await AsyncStorage.setItem('whispr.auth.userId', mockAuthResponse.user.id);

      console.log('[AuthMock] Registration completed:', mockAuthResponse.user.id);

      return {
        success: true,
        data: mockAuthResponse,
        message: 'Inscription réussie',
      };
    } catch (error) {
      console.error('[AuthMock] Erreur inscription:', error);
      return {
        success: false,
        message: "Erreur lors de l'inscription",
      };
    }
  }

  /**
   * Demande un code de vérification pour la connexion
   */
  async requestLoginVerification(
    phoneNumber: PhoneNumber,
  ): Promise<{ success: boolean; verificationId?: string; message?: string }> {
    try {
      // Validation
      const validation = this.validatePhoneNumber(phoneNumber);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error,
        };
      }

      // Simulation d'un délai réseau
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Générer un mock verificationId
      const mockVerificationId = `mock-login-verification-${Date.now()}`;
      const fullPhone = phoneNumber.countryCode + phoneNumber.number.replace(/\s/g, '');
      this.mockVerificationIds.set(mockVerificationId, fullPhone);

      console.log('[AuthMock] Login verification requested:', fullPhone);

      return {
        success: true,
        verificationId: mockVerificationId,
        message: 'Code de vérification envoyé pour la connexion',
      };
    } catch (error) {
      console.error('[AuthMock] Erreur demande connexion:', error);
      return {
        success: false,
        message: 'Erreur lors de la demande de connexion',
      };
    }
  }

  /**
   * Confirme le code de vérification pour la connexion
   */
  async confirmLoginVerification(
    verificationId: string,
    code: VerificationCode,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Validation
      const validation = this.validateVerificationCode(code.code);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error,
        };
      }

      // Simulation d'un délai réseau
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Pour le développement, on accepte le code "123456"
      if (code.code === '123456' && this.mockVerificationIds.has(verificationId)) {
        console.log('[AuthMock] Login verification confirmed:', verificationId);
        return {
          success: true,
          message: 'Code vérifié avec succès',
        };
      }

      return {
        success: false,
        message: 'Code incorrect',
      };
    } catch (error) {
      console.error('[AuthMock] Erreur vérification connexion:', error);
      return {
        success: false,
        message: 'Erreur lors de la vérification',
      };
    }
  }

  /**
   * Finalise la connexion
   */
  async login(
    verificationId: string,
    deviceInfo?: any,
  ): Promise<{ success: boolean; data?: AuthResponse; message?: string }> {
    try {
      // Vérifier que le verificationId existe
      if (!this.mockVerificationIds.has(verificationId)) {
        return {
          success: false,
          message: 'Code de vérification invalide ou expiré',
        };
      }

      // Simulation d'un délai réseau
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock response
      const mockAuthResponse: AuthResponse = {
        accessToken: `mock-access-token-${Date.now()}`,
        refreshToken: `mock-refresh-token-${Date.now()}`,
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: {
          id: 'mock-user-1',
          phoneNumber: this.mockVerificationIds.get(verificationId) || '',
          firstName: 'John',
          lastName: 'Doe',
          twoFactorEnabled: false,
        },
        device: {
          id: `mock-device-${Date.now()}`,
          deviceName: deviceInfo?.name || 'Mock Device',
          deviceType: deviceInfo?.type || 'mobile',
          isVerified: true,
        },
      };

      // Sauvegarder les tokens
      await AsyncStorage.setItem('whispr.auth.token', mockAuthResponse.accessToken);
      await AsyncStorage.setItem('whispr.auth.refreshToken', mockAuthResponse.refreshToken);
      await AsyncStorage.setItem('whispr.auth.userId', mockAuthResponse.user.id);

      console.log('[AuthMock] Login completed:', mockAuthResponse.user.id);

      return {
        success: true,
        data: mockAuthResponse,
        message: 'Connexion réussie',
      };
    } catch (error) {
      console.error('[AuthMock] Erreur connexion:', error);
      return {
        success: false,
        message: 'Erreur lors de la connexion',
      };
    }
  }

  /**
   * Rafraîchit le token d'accès
   */
  async refreshToken(
    refreshToken: string,
  ): Promise<{ success: boolean; data?: AuthResponse; message?: string }> {
    try {
      // Simulation d'un délai réseau
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock response
      const mockAuthResponse: AuthResponse = {
        accessToken: `mock-access-token-${Date.now()}`,
        refreshToken: refreshToken, // Garder le même refresh token
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: {
          id: 'mock-user-1',
          phoneNumber: '+33612345678',
          twoFactorEnabled: false,
        },
        device: {
          id: 'mock-device-1',
          deviceName: 'Mock Device',
          deviceType: 'mobile',
          isVerified: true,
        },
      };

      // Sauvegarder le nouveau token
      await AsyncStorage.setItem('whispr.auth.token', mockAuthResponse.accessToken);

      return {
        success: true,
        data: mockAuthResponse,
        message: 'Token rafraîchi avec succès',
      };
    } catch (error) {
      console.error('[AuthMock] Erreur refresh token:', error);
      return {
        success: false,
        message: 'Erreur lors du rafraîchissement du token',
      };
    }
  }

  /**
   * Déconnexion
   */
  async logout(): Promise<{ success: boolean; message?: string }> {
    try {
      // Supprimer les tokens et données d'authentification
      await AsyncStorage.multiRemove([
        'whispr.auth.token',
        'whispr.auth.refreshToken',
        'whispr.auth.userId',
        'whispr.profile.v1',
      ]);

      console.log('[AuthMock] Logout completed');

      return {
        success: true,
        message: 'Déconnexion réussie',
      };
    } catch (error) {
      console.error('[AuthMock] Erreur déconnexion:', error);
      return {
        success: false,
        message: 'Erreur lors de la déconnexion',
      };
    }
  }

  /**
   * Valide un numéro de téléphone
   */
  validatePhoneNumber(phoneNumber: PhoneNumber): { isValid: boolean; error?: string } {
    const { countryCode, number } = phoneNumber;

    if (!countryCode || !number) {
      return {
        isValid: false,
        error: 'Veuillez saisir un numéro de téléphone',
      };
    }

    // Validation basique du format
    const cleanNumber = number.replace(/\s/g, '');
    if (cleanNumber.length < 8) {
      return {
        isValid: false,
        error: 'Le numéro de téléphone est trop court',
      };
    }

    if (cleanNumber.length > 15) {
      return {
        isValid: false,
        error: 'Le numéro de téléphone est trop long',
      };
    }

    return { isValid: true };
  }

  /**
   * Valide un code de vérification
   */
  validateVerificationCode(code: string): { isValid: boolean; error?: string } {
    if (!code || code.length !== 6) {
      return {
        isValid: false,
        error: 'Le code doit contenir 6 chiffres',
      };
    }

    if (!/^\d{6}$/.test(code)) {
      return {
        isValid: false,
        error: 'Le code ne doit contenir que des chiffres',
      };
    }

    return { isValid: true };
  }

  /**
   * Valide un profil utilisateur
   */
  validateProfile(profile: UserProfile): { isValid: boolean; error?: string } {
    if (!profile.firstName || profile.firstName.trim().length < 2) {
      return {
        isValid: false,
        error: 'Le prénom doit contenir au moins 2 caractères',
      };
    }

    if (!profile.lastName || profile.lastName.trim().length < 2) {
      return {
        isValid: false,
        error: 'Le nom doit contenir au moins 2 caractères',
      };
    }

    return { isValid: true };
  }
}

