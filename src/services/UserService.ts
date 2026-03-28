/**
 * UserService - User Profile Management
 * Handles all user-related API calls
 */

import { Alert } from 'react-native';

// Types
export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  biography: string;
  profilePicture?: string;
  isOnline: boolean;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  username?: string;
  biography?: string;
  profilePicture?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  message?: string;
  profile?: UserProfile;
}

export interface PrivacySettings {
  profilePictureVisibility: 'everyone' | 'contacts' | 'nobody';
  firstNameVisibility: 'everyone' | 'contacts' | 'nobody';
  lastNameVisibility: 'everyone' | 'contacts' | 'nobody';
  biographyVisibility: 'everyone' | 'contacts' | 'nobody';
  searchVisibility: boolean;
  phoneNumberSearch: 'everyone' | 'contacts' | 'nobody';
}

export class UserService {
  private static instance: UserService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = `${process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://whispr-api.roadmvn.com'}/user/v1`;
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<{ success: boolean; profile?: UserProfile; message?: string }> {
    try {
      return {
        success: false,
        message: 'Profil non disponible (API non implémentée)',
      };
    } catch (error) {
      console.error('Erreur récupération profil:', error);
      return {
        success: false,
        message: 'Impossible de récupérer le profil',
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    try {
      console.log('📝 Mise à jour du profil:', profileData);
      
      // Validation
      const validation = this.validateProfileData(profileData);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error,
        };
      }

      // TODO: Real API call
      // const response = await fetch(`${this.baseUrl}/users/me`, {
      //   method: 'PUT',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(profileData),
      // });

      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 1500));

      return {
        success: true,
        message: 'Profil mis à jour avec succès',
      };
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      return {
        success: false,
        message: 'Impossible de mettre à jour le profil',
      };
    }
  }

  /**
   * Update profile picture
   */
  async updateProfilePicture(imageUri: string): Promise<UpdateProfileResponse> {
    try {
      console.log('📸 Mise à jour de la photo de profil:', imageUri);
      
      // TODO: Real API call with FormData
      // const formData = new FormData();
      // formData.append('picture', {
      //   uri: imageUri,
      //   type: 'image/jpeg',
      //   name: 'profile-picture.jpg',
      // });

      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        success: true,
        message: 'Photo de profil mise à jour avec succès',
      };
    } catch (error) {
      console.error('Erreur mise à jour photo:', error);
      return {
        success: false,
        message: 'Impossible de mettre à jour la photo de profil',
      };
    }
  }

  /**
   * Update username
   */
  async updateUsername(username: string): Promise<UpdateProfileResponse> {
    try {
      
      // Validation username
      const validation = this.validateUsername(username);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error,
        };
      }

      // TODO: Real API call
      // const response = await fetch(`${this.baseUrl}/users/me/username`, {
      //   method: 'PUT',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ username }),
      // });

      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        success: true,
        message: 'Nom d\'utilisateur mis à jour avec succès',
      };
    } catch (error) {
      console.error('Erreur mise à jour username:', error);
      return {
        success: false,
        message: 'Impossible de mettre à jour le nom d\'utilisateur',
      };
    }
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(settings: PrivacySettings): Promise<UpdateProfileResponse> {
    try {
      console.log('🔒 Mise à jour des paramètres de confidentialité:', settings);
      
      // TODO: Real API call
      // const response = await fetch(`${this.baseUrl}/users/me/privacy`, {
      //   method: 'PUT',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(settings),
      // });

      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        success: true,
        message: 'Paramètres de confidentialité mis à jour avec succès',
      };
    } catch (error) {
      console.error('Erreur mise à jour confidentialité:', error);
      return {
        success: false,
        message: 'Impossible de mettre à jour les paramètres de confidentialité',
      };
    }
  }

  /**
   * Change phone number
   */
  async changePhoneNumber(newPhoneNumber: string): Promise<UpdateProfileResponse> {
    try {
      
      // Validation phone number
      const validation = this.validatePhoneNumber(newPhoneNumber);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error,
        };
      }

      // TODO: Real API call
      // const response = await fetch(`${this.baseUrl}/auth/phone`, {
      //   method: 'PUT',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ phoneNumber: newPhoneNumber }),
      // });

      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        success: true,
        message: 'Numéro de téléphone mis à jour avec succès',
      };
    } catch (error) {
      console.error('Erreur changement numéro:', error);
      return {
        success: false,
        message: 'Impossible de changer le numéro de téléphone',
      };
    }
  }

  /**
   * Validate profile data
   */
  private validateProfileData(data: UpdateProfileRequest): { isValid: boolean; error?: string } {
    if (data.firstName && data.firstName.trim().length < 2) {
      return {
        isValid: false,
        error: 'Le prénom doit contenir au moins 2 caractères',
      };
    }

    if (data.lastName && data.lastName.trim().length < 2) {
      return {
        isValid: false,
        error: 'Le nom doit contenir au moins 2 caractères',
      };
    }

    if (data.biography && data.biography.length > 500) {
      return {
        isValid: false,
        error: 'La biographie ne peut pas dépasser 500 caractères',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate username
   */
  private validateUsername(username: string): { isValid: boolean; error?: string } {
    if (!username || username.trim().length < 3) {
      return {
        isValid: false,
        error: 'Le nom d\'utilisateur doit contenir au moins 3 caractères',
      };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return {
        isValid: false,
        error: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores',
      };
    }

    if (username.length > 20) {
      return {
        isValid: false,
        error: 'Le nom d\'utilisateur ne peut pas dépasser 20 caractères',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate phone number
   */
  private validatePhoneNumber(phoneNumber: string): { isValid: boolean; error?: string } {
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      return {
        isValid: false,
        error: 'Le numéro de téléphone doit contenir au moins 10 chiffres',
      };
    }

    // Validation basique du format français
    const cleanNumber = phoneNumber.replace(/\s/g, '');
    if (!cleanNumber.match(/^(\+33|0)[1-9]\d{8}$/)) {
      return {
        isValid: false,
        error: 'Format de numéro de téléphone invalide',
      };
    }

    return { isValid: true };
  }
}






