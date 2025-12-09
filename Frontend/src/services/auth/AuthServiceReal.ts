/**
 * AuthServiceReal - Version avec appels API réels
 * Utilisée pour tester avec le backend en production
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  IAuthService,
  PhoneNumber,
  VerificationCode,
  UserProfile,
  AuthResponse,
  VerificationRequestDto,
  VerificationConfirmDto,
  RegisterDto,
  LoginDto,
} from './types';

export class AuthServiceReal implements IAuthService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    console.log('[AuthReal] Initialized with baseUrl:', baseUrl);
  }

  /**
   * Formate le numéro de téléphone au format international
   */
  private formatPhoneNumber(phoneNumber: PhoneNumber): string {
    const cleanNumber = phoneNumber.number.replace(/\s/g, '');
    // Si le numéro commence par 0, on le remplace par le code pays
    const numberWithoutZero = cleanNumber.startsWith('0') ? cleanNumber.substring(1) : cleanNumber;
    return phoneNumber.countryCode + numberWithoutZero;
  }

  /**
   * Gère les erreurs API
   */
  private async handleApiError(response: Response): Promise<{ message: string }> {
    try {
      const errorData = await response.json();
      return {
        message: errorData.message || errorData.error?.message || `Erreur ${response.status}`,
      };
    } catch {
      return {
        message: `Erreur ${response.status}: ${response.statusText}`,
      };
    }
  }

  /**
   * Demande un code de vérification pour l'inscription
   * POST /auth/v1/register/verify/request
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

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const requestDto: VerificationRequestDto = {
        phoneNumber: formattedPhone,
      };

      console.log('[AuthReal] Requesting registration verification:', formattedPhone);

      const response = await fetch(`${this.baseUrl}/register/verify/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestDto),
      });

      if (!response.ok) {
        const error = await this.handleApiError(response);
        console.error('[AuthReal] Registration verification request failed:', error);
        return {
          success: false,
          message: error.message,
        };
      }

      const data = await response.json();
      console.log('[AuthReal] Registration verification requested:', data.verificationId);

      return {
        success: true,
        verificationId: data.verificationId,
        message: 'Code de vérification envoyé',
      };
    } catch (error: any) {
      console.error('[AuthReal] Erreur demande inscription:', error);
      return {
        success: false,
        message: error.message || "Erreur lors de l'envoi du code",
      };
    }
  }

  /**
   * Confirme le code de vérification pour l'inscription
   * POST /auth/v1/register/verify/confirm
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

      const requestDto: VerificationConfirmDto = {
        verificationId,
        code: code.code,
      };

      console.log('[AuthReal] Confirming registration verification:', verificationId);

      const response = await fetch(`${this.baseUrl}/register/verify/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestDto),
      });

      if (!response.ok) {
        const error = await this.handleApiError(response);
        console.error('[AuthReal] Registration verification confirm failed:', error);
        return {
          success: false,
          message: error.message,
        };
      }

      const data = await response.json();
      console.log('[AuthReal] Registration verification confirmed:', data.verified);

      return {
        success: data.verified || true,
        message: 'Code vérifié avec succès',
      };
    } catch (error: any) {
      console.error('[AuthReal] Erreur vérification inscription:', error);
      return {
        success: false,
        message: error.message || 'Erreur lors de la vérification',
      };
    }
  }

  /**
   * Finalise l'inscription
   * POST /auth/v1/register
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

      const requestDto: RegisterDto = {
        verificationId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        deviceName: deviceInfo?.name || 'Mobile Device',
        deviceType: deviceInfo?.type || 'mobile',
        publicKey: deviceInfo?.publicKey,
      };

      console.log('[AuthReal] Registering user:', profile.firstName, profile.lastName);

      const response = await fetch(`${this.baseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestDto),
      });

      if (!response.ok) {
        const error = await this.handleApiError(response);
        console.error('[AuthReal] Registration failed:', error);
        return {
          success: false,
          message: error.message,
        };
      }

      const data: AuthResponse = await response.json();
      console.log('[AuthReal] Registration completed:', data.user.id);

      // Sauvegarder les tokens
      await AsyncStorage.setItem('whispr.auth.token', data.accessToken);
      await AsyncStorage.setItem('whispr.auth.refreshToken', data.refreshToken);
      await AsyncStorage.setItem('whispr.auth.userId', data.user.id);

      return {
        success: true,
        data,
        message: 'Inscription réussie',
      };
    } catch (error: any) {
      console.error('[AuthReal] Erreur inscription:', error);
      return {
        success: false,
        message: error.message || "Erreur lors de l'inscription",
      };
    }
  }

  /**
   * Demande un code de vérification pour la connexion
   * POST /auth/v1/login/verify/request
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

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const requestDto: VerificationRequestDto = {
        phoneNumber: formattedPhone,
      };

      console.log('[AuthReal] Requesting login verification:', formattedPhone);

      const response = await fetch(`${this.baseUrl}/login/verify/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestDto),
      });

      if (!response.ok) {
        const error = await this.handleApiError(response);
        console.error('[AuthReal] Login verification request failed:', error);
        return {
          success: false,
          message: error.message,
        };
      }

      const data = await response.json();
      console.log('[AuthReal] Login verification requested:', data.verificationId);

      return {
        success: true,
        verificationId: data.verificationId,
        message: 'Code de vérification envoyé pour la connexion',
      };
    } catch (error: any) {
      console.error('[AuthReal] Erreur demande connexion:', error);
      return {
        success: false,
        message: error.message || 'Erreur lors de la demande de connexion',
      };
    }
  }

  /**
   * Confirme le code de vérification pour la connexion
   * POST /auth/v1/login/verify/confirm
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

      const requestDto: VerificationConfirmDto = {
        verificationId,
        code: code.code,
      };

      console.log('[AuthReal] Confirming login verification:', verificationId);

      const response = await fetch(`${this.baseUrl}/login/verify/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestDto),
      });

      if (!response.ok) {
        const error = await this.handleApiError(response);
        console.error('[AuthReal] Login verification confirm failed:', error);
        return {
          success: false,
          message: error.message,
        };
      }

      const data = await response.json();
      console.log('[AuthReal] Login verification confirmed:', data.verified);

      return {
        success: data.verified || true,
        message: 'Code vérifié avec succès',
      };
    } catch (error: any) {
      console.error('[AuthReal] Erreur vérification connexion:', error);
      return {
        success: false,
        message: error.message || 'Erreur lors de la vérification',
      };
    }
  }

  /**
   * Finalise la connexion
   * POST /auth/v1/login
   */
  async login(
    verificationId: string,
    deviceInfo?: any,
  ): Promise<{ success: boolean; data?: AuthResponse; message?: string }> {
    try {
      const requestDto: LoginDto = {
        verificationId,
        deviceName: deviceInfo?.name || 'Mobile Device',
        deviceType: deviceInfo?.type || 'mobile',
        publicKey: deviceInfo?.publicKey,
      };

      console.log('[AuthReal] Logging in user:', verificationId);

      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestDto),
      });

      if (!response.ok) {
        const error = await this.handleApiError(response);
        console.error('[AuthReal] Login failed:', error);
        return {
          success: false,
          message: error.message,
        };
      }

      const data: AuthResponse = await response.json();
      console.log('[AuthReal] Login completed:', data.user.id);

      // Sauvegarder les tokens
      await AsyncStorage.setItem('whispr.auth.token', data.accessToken);
      await AsyncStorage.setItem('whispr.auth.refreshToken', data.refreshToken);
      await AsyncStorage.setItem('whispr.auth.userId', data.user.id);

      return {
        success: true,
        data,
        message: 'Connexion réussie',
      };
    } catch (error: any) {
      console.error('[AuthReal] Erreur connexion:', error);
      return {
        success: false,
        message: error.message || 'Erreur lors de la connexion',
      };
    }
  }

  /**
   * Rafraîchit le token d'accès
   * POST /auth/v1/refresh
   */
  async refreshToken(
    refreshToken: string,
  ): Promise<{ success: boolean; data?: AuthResponse; message?: string }> {
    try {
      const requestDto = {
        refreshToken,
      };

      console.log('[AuthReal] Refreshing token');

      const response = await fetch(`${this.baseUrl}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestDto),
      });

      if (!response.ok) {
        const error = await this.handleApiError(response);
        console.error('[AuthReal] Refresh token failed:', error);
        return {
          success: false,
          message: error.message,
        };
      }

      const data: AuthResponse = await response.json();
      console.log('[AuthReal] Token refreshed');

      // Sauvegarder le nouveau token
      await AsyncStorage.setItem('whispr.auth.token', data.accessToken);

      return {
        success: true,
        data,
        message: 'Token rafraîchi avec succès',
      };
    } catch (error: any) {
      console.error('[AuthReal] Erreur refresh token:', error);
      return {
        success: false,
        message: error.message || 'Erreur lors du rafraîchissement du token',
      };
    }
  }

  /**
   * Déconnexion
   * POST /auth/v1/logout
   */
  async logout(): Promise<{ success: boolean; message?: string }> {
    try {
      // Récupérer le token
      const token = await AsyncStorage.getItem('whispr.auth.token');

      if (token) {
        console.log('[AuthReal] Logging out');

        const response = await fetch(`${this.baseUrl}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.warn('[AuthReal] Logout API call failed, but continuing with local cleanup');
        }
      }

      // Supprimer les tokens et données d'authentification
      await AsyncStorage.multiRemove([
        'whispr.auth.token',
        'whispr.auth.refreshToken',
        'whispr.auth.userId',
        'whispr.profile.v1',
      ]);

      console.log('[AuthReal] Logout completed');

      return {
        success: true,
        message: 'Déconnexion réussie',
      };
    } catch (error: any) {
      console.error('[AuthReal] Erreur déconnexion:', error);
      // Même en cas d'erreur, on nettoie localement
      try {
        await AsyncStorage.multiRemove([
          'whispr.auth.token',
          'whispr.auth.refreshToken',
          'whispr.auth.userId',
          'whispr.profile.v1',
        ]);
      } catch {}

      return {
        success: false,
        message: error.message || 'Erreur lors de la déconnexion',
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

