/**
 * Whispr AuthService
 * Service pour gérer l'authentification
 */

export interface PhoneNumber {
  countryCode: string;
  number: string;
}

export interface VerificationCode {
  code: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Envoie un code de vérification par SMS
   */
  async sendVerificationCode(phoneNumber: PhoneNumber): Promise<{ success: boolean; message?: string }> {
    try {
      // TODO: Appel API réel vers auth-service
      console.log('📱 Envoi SMS vers:', phoneNumber);
      
      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Pour le développement, on simule toujours un succès
      return {
        success: true,
        message: 'Code de vérification envoyé'
      };
    } catch (error) {
      console.error('❌ Erreur envoi SMS:', error);
      return {
        success: false,
        message: 'Erreur lors de l\'envoi du code'
      };
    }
  }

  /**
   * Vérifie le code SMS
   */
  async verifyCode(phoneNumber: PhoneNumber, code: VerificationCode): Promise<{ success: boolean; message?: string }> {
    try {
      // TODO: Appel API réel vers auth-service
      console.log('🔐 Vérification code:', code.code, 'pour:', phoneNumber);
      
      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Pour le développement, on accepte le code "123456"
      if (code.code === '123456') {
        return {
          success: true,
          message: 'Code vérifié avec succès'
        };
      } else {
        return {
          success: false,
          message: 'Code incorrect'
        };
      }
    } catch (error) {
      console.error('❌ Erreur vérification:', error);
      return {
        success: false,
        message: 'Erreur lors de la vérification'
      };
    }
  }

  /**
   * Crée le profil utilisateur
   */
  async createProfile(phoneNumber: PhoneNumber, profile: UserProfile): Promise<{ success: boolean; message?: string }> {
    try {
      // TODO: Appel API réel vers user-service
      console.log('👤 Création profil:', profile, 'pour:', phoneNumber);
      
      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        message: 'Profil créé avec succès'
      };
    } catch (error) {
      console.error('❌ Erreur création profil:', error);
      return {
        success: false,
        message: 'Erreur lors de la création du profil'
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
        error: 'Veuillez saisir un numéro de téléphone'
      };
    }

    // Validation basique du format
    const cleanNumber = number.replace(/\s/g, '');
    if (cleanNumber.length < 8) {
      return {
        isValid: false,
        error: 'Le numéro de téléphone est trop court'
      };
    }

    if (cleanNumber.length > 15) {
      return {
        isValid: false,
        error: 'Le numéro de téléphone est trop long'
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
        error: 'Le code doit contenir 6 chiffres'
      };
    }

    if (!/^\d{6}$/.test(code)) {
      return {
        isValid: false,
        error: 'Le code ne doit contenir que des chiffres'
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
        error: 'Le prénom doit contenir au moins 2 caractères'
      };
    }

    if (!profile.lastName || profile.lastName.trim().length < 2) {
      return {
        isValid: false,
        error: 'Le nom doit contenir au moins 2 caractères'
      };
    }

    return { isValid: true };
  }
}

export default AuthService;
