/**
 * UserService - User Profile Management
 * Handles all user-related API calls
 */

import { USER_API_URL } from "../config/api";
import { apiFetch } from "./apiClient";
import { TokenService } from "./TokenService";
import { mediaAPI } from "./media/api";

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
  profilePictureVisibility: "everyone" | "contacts" | "nobody";
  firstNameVisibility: "everyone" | "contacts" | "nobody";
  lastNameVisibility: "everyone" | "contacts" | "nobody";
  biographyVisibility: "everyone" | "contacts" | "nobody";
  searchVisibility: boolean;
  phoneNumberSearch: "everyone" | "contacts" | "nobody";
}

export class UserService {
  private static instance: UserService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = USER_API_URL;
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  private async resolveCurrentUserId(userId?: string): Promise<string> {
    if (userId) return userId;
    const token = await TokenService.getAccessToken();
    const payload = token ? TokenService.decodeAccessToken(token) : null;
    if (!payload?.sub) throw new Error("Missing user id");
    return payload.sub;
  }

  private toUserProfile(raw: any): UserProfile {
    return {
      id: String(raw?.id ?? ""),
      firstName: String(raw?.firstName ?? raw?.first_name ?? ""),
      lastName: String(raw?.lastName ?? raw?.last_name ?? ""),
      username: String(raw?.username ?? ""),
      phoneNumber: String(raw?.phoneNumber ?? raw?.phone_number ?? ""),
      biography: String(raw?.biography ?? ""),
      profilePicture:
        typeof raw?.profilePictureUrl === "string"
          ? raw.profilePictureUrl
          : typeof raw?.profile_picture_url === "string"
            ? raw.profile_picture_url
            : undefined,
      isOnline: Boolean(raw?.isOnline ?? false),
      lastSeen:
        typeof raw?.lastSeen === "string"
          ? raw.lastSeen
          : raw?.lastSeen
            ? new Date(raw.lastSeen).toISOString()
            : typeof raw?.last_seen === "string"
              ? raw.last_seen
              : undefined,
      createdAt: String(
        raw?.createdAt ?? raw?.created_at ?? new Date().toISOString(),
      ),
      updatedAt: String(
        raw?.updatedAt ?? raw?.updated_at ?? new Date().toISOString(),
      ),
    };
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<{
    success: boolean;
    profile?: UserProfile;
    message?: string;
  }> {
    try {
      const userId = await this.resolveCurrentUserId();
      const raw = await apiFetch<any>(
        `${this.baseUrl}/profile/${encodeURIComponent(userId)}`,
      );
      return { success: true, profile: this.toUserProfile(raw) };
    } catch (error) {
      console.error("Erreur récupération profil:", error);
      return {
        success: false,
        message: "Impossible de récupérer le profil",
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    profileData: UpdateProfileRequest,
  ): Promise<UpdateProfileResponse> {
    try {
      // Validation
      const validation = this.validateProfileData(profileData);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error,
        };
      }

      const userId = await this.resolveCurrentUserId();

      let avatarMediaId: string | undefined;
      let profilePictureUrl: string | undefined;
      if (profileData.profilePicture) {
        const uri = profileData.profilePicture;
        const isLocalUri =
          uri.startsWith("file:") ||
          uri.startsWith("content:") ||
          uri.startsWith("ph:");

        if (isLocalUri) {
          const upload = await mediaAPI.uploadAvatar(userId, uri);
          if (upload.url) profilePictureUrl = upload.url;
          else if (upload.mediaId) avatarMediaId = upload.mediaId;
        } else {
          profilePictureUrl = uri;
        }
      }

      const payload: Record<string, unknown> = {};
      if (profileData.firstName !== undefined)
        payload.firstName = profileData.firstName;
      if (profileData.lastName !== undefined)
        payload.lastName = profileData.lastName;
      if (profileData.username !== undefined)
        payload.username = profileData.username;
      if (profileData.biography !== undefined)
        payload.biography = profileData.biography;
      if (profilePictureUrl) payload.profilePictureUrl = profilePictureUrl;
      if (avatarMediaId) payload.avatarMediaId = avatarMediaId;

      const updated = await apiFetch<any>(
        `${this.baseUrl}/profile/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );

      return { success: true, profile: this.toUserProfile(updated) };
    } catch (error) {
      console.error("Erreur mise à jour profil:", error);
      return {
        success: false,
        message: "Impossible de mettre à jour le profil",
      };
    }
  }

  /**
   * Update profile picture
   */
  async updateProfilePicture(imageUri: string): Promise<UpdateProfileResponse> {
    try {
      return this.updateProfile({ profilePicture: imageUri });
    } catch (error) {
      console.error("Erreur mise à jour photo:", error);
      return {
        success: false,
        message: "Impossible de mettre à jour la photo de profil",
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

      return this.updateProfile({ username });
    } catch (error) {
      console.error("Erreur mise à jour username:", error);
      return {
        success: false,
        message: "Impossible de mettre à jour le nom d'utilisateur",
      };
    }
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(
    settings: PrivacySettings,
  ): Promise<UpdateProfileResponse> {
    try {
      console.log(
        "🔒 Mise à jour des paramètres de confidentialité:",
        settings,
      );

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
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return {
        success: true,
        message: "Paramètres de confidentialité mis à jour avec succès",
      };
    } catch (error) {
      console.error("Erreur mise à jour confidentialité:", error);
      return {
        success: false,
        message:
          "Impossible de mettre à jour les paramètres de confidentialité",
      };
    }
  }

  /**
   * Change phone number
   */
  async changePhoneNumber(
    newPhoneNumber: string,
  ): Promise<UpdateProfileResponse> {
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
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return {
        success: true,
        message: "Numéro de téléphone mis à jour avec succès",
      };
    } catch (error) {
      console.error("Erreur changement numéro:", error);
      return {
        success: false,
        message: "Impossible de changer le numéro de téléphone",
      };
    }
  }

  /**
   * Validate profile data
   */
  private validateProfileData(data: UpdateProfileRequest): {
    isValid: boolean;
    error?: string;
  } {
    if (data.firstName && data.firstName.trim().length < 2) {
      return {
        isValid: false,
        error: "Le prénom doit contenir au moins 2 caractères",
      };
    }

    if (data.lastName && data.lastName.trim().length < 2) {
      return {
        isValid: false,
        error: "Le nom doit contenir au moins 2 caractères",
      };
    }

    if (data.biography && data.biography.length > 500) {
      return {
        isValid: false,
        error: "La biographie ne peut pas dépasser 500 caractères",
      };
    }

    return { isValid: true };
  }

  /**
   * Validate username
   */
  private validateUsername(username: string): {
    isValid: boolean;
    error?: string;
  } {
    if (!username || username.trim().length < 3) {
      return {
        isValid: false,
        error: "Le nom d'utilisateur doit contenir au moins 3 caractères",
      };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return {
        isValid: false,
        error:
          "Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscores",
      };
    }

    if (username.length > 20) {
      return {
        isValid: false,
        error: "Le nom d'utilisateur ne peut pas dépasser 20 caractères",
      };
    }

    return { isValid: true };
  }

  /**
   * Validate phone number
   */
  private validatePhoneNumber(phoneNumber: string): {
    isValid: boolean;
    error?: string;
  } {
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      return {
        isValid: false,
        error: "Le numéro de téléphone doit contenir au moins 10 chiffres",
      };
    }

    // Validation basique du format français
    const cleanNumber = phoneNumber.replace(/\s/g, "");
    if (!cleanNumber.match(/^(\+33|0)[1-9]\d{8}$/)) {
      return {
        isValid: false,
        error: "Format de numéro de téléphone invalide",
      };
    }

    return { isValid: true };
  }
}
