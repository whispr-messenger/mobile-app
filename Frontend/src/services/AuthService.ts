import { Platform } from 'react-native';
import { normalizePhoneToE164 } from '../utils/phoneUtils';

const API_BASE_URL =
  Platform.OS === 'web'
    ? 'http://localhost:4000/api/v1'
    : 'https://api.whispr.local/api/v1';

export class AuthService {
  private static instance: AuthService;
  private currentUserId: string | null = null;
  private currentUsername: string | null = null;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async updateCurrentUserPhone(newPhone: string): Promise<{ success: boolean; message?: string }> {
    try {
      if (!this.currentUserId || !this.currentUsername) {
        return {
          success: false,
          message: 'Utilisateur non connecté'
        };
      }

      const trimmed = newPhone.trim();
      if (!trimmed) {
        return {
          success: false,
          message: 'Le numéro de téléphone est obligatoire'
        };
      }

      const phoneE164 = normalizePhoneToE164(trimmed);

      return {
        success: true,
        message: 'Numéro de téléphone mis à jour'
      };
    } catch (error) {
      console.error('Erreur mise à jour téléphone:', error);
      return {
        success: false,
        message: 'Erreur lors de la mise à jour du numéro'
      };
    }
  }

  async register(credentials: { username: string; password: string; phone: string }): Promise<{ success: boolean; message?: string }> {
    try {
      const username = credentials.username.trim();
      const password = credentials.password.trim();
      const phone = credentials.phone.trim();

      if (!username || !password || !phone) {
        return {
          success: false,
          message: 'Identifiants invalides'
        };
      }

      const phoneE164 = normalizePhoneToE164(phone);

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          phone: phoneE164,
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || data.success !== true) {
        const messageKey = data?.message;
        let message = 'Erreur lors de l\'inscription';

        if (messageKey === 'username_taken') {
          message = 'Nom d’utilisateur déjà utilisé';
        } else if (messageKey === 'phone_taken') {
          message = 'Numéro de téléphone déjà utilisé';
        } else if (messageKey === 'invalid_payload') {
          message = 'Identifiants invalides';
        }

        return {
          success: false,
          message,
        };
      }

      return {
        success: true,
        message: 'Inscription réussie'
      };
    } catch (error) {
      console.error('Erreur inscription:', error);
      return {
        success: false,
        message: 'Erreur lors de l\'inscription'
      };
    }
  }

  async login(identifier: string, password: string): Promise<{ success: boolean; message?: string }> {
    try {
      const trimmedIdentifier = identifier.trim();
      const trimmedPassword = password.trim();

      if (!trimmedIdentifier || !trimmedPassword) {
        return {
          success: false,
          message: 'Identifiants invalides'
        };
      }

      const hasLetter = /[a-zA-Z]/.test(trimmedIdentifier);
      let identifierForApi = trimmedIdentifier;

      if (hasLetter) {
      } else {
        identifierForApi = normalizePhoneToE164(trimmedIdentifier);
      }

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: identifierForApi,
          password: trimmedPassword,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || data.success !== true || !data.user_id) {
        return {
          success: false,
          message: 'Identifiants invalides'
        };
      }

      this.currentUserId = data.user_id;
      this.currentUsername = data.username || trimmedIdentifier;
      return {
        success: true,
        message: 'Connexion réussie'
      };
    } catch (error) {
      console.error('Erreur connexion:', error);
      return {
        success: false,
        message: 'Erreur lors de la connexion'
      };
    }
  }

  getCurrentUser(): { userId: string; username: string } | null {
    if (!this.currentUserId || !this.currentUsername) {
      return null;
    }
    return {
      userId: this.currentUserId,
      username: this.currentUsername,
    };
  }

  /**
   * Déconnexion de l'utilisateur
   */
  async logout(): Promise<{ success: boolean; message?: string }> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;

      // Supprimer les tokens et données d'authentification
      await AsyncStorage.multiRemove([
        'whispr.auth.token',
        'whispr.auth.refreshToken',
        'whispr.auth.userId',
        'whispr.profile.v1',
      ]);

      return {
        success: true,
        message: 'Déconnexion réussie'
      };
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      return {
        success: false,
        message: 'Erreur lors de la déconnexion'
      };
    }
  }

  /**
   * Suppression du compte utilisateur
   */
  async deleteAccount(): Promise<{ success: boolean; message?: string }> {
    try {
      // TODO: Appel API réel vers user-service pour supprimer le compte
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;

      // Supprimer toutes les données locales
      await AsyncStorage.clear();

      return {
        success: true,
        message: 'Compte supprimé avec succès'
      };
    } catch (error) {
      console.error('Erreur suppression compte:', error);
      return {
        success: false,
        message: 'Erreur lors de la suppression du compte'
      };
    }
  }
}

export default AuthService;
