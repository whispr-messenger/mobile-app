/**
 * UserService - User Profile Management
 * Handles all user-related API calls
 */

import { TokenService } from "./TokenService";
import { AuthService } from "./AuthService";
import { getApiBaseUrl } from "./apiBase";
import { normalizeUsername } from "../utils";
import { logger } from "../utils/logger";

// Types
export interface UserVisualPreferences {
  theme?: "light" | "dark" | "auto";
  language?: "fr" | "en";
  fontSize?: "small" | "medium" | "large";
  backgroundPreset?: "whispr" | "midnight" | "sunset" | "aurora" | "custom";
  backgroundMediaId?: string | null;
  backgroundMediaUrl?: string | null;
  updatedAt?: string | null;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  biography: string;
  profilePicture?: string;
  backgroundMediaId?: string;
  backgroundMediaUrl?: string;
  visualPreferences?: UserVisualPreferences;
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
  avatarMediaId?: string;
  backgroundMediaId?: string | null;
  backgroundMediaUrl?: string | null;
  visualPreferences?: UserVisualPreferences;
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
  lastSeenVisibility: "everyone" | "contacts" | "nobody";
  onlineStatusVisibility: "everyone" | "contacts" | "nobody";
  groupAddPermission: "everyone" | "contacts" | "nobody";
  searchVisibility: boolean;
  phoneNumberSearch: "everyone" | "contacts" | "nobody";
  // toggle WhatsApp punitive : si false on n envoie pas et on ne voit pas
  readReceipts?: boolean;
}

export class UserService {
  private static instance: UserService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = `${getApiBaseUrl()}/user/v1`;
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Authenticated fetch with automatic token refresh on 401.
   * Uses isRetry guard to prevent infinite refresh/retry loops.
   */
  private async authFetch(
    path: string,
    options: RequestInit = {},
    isRetry = false,
  ): Promise<Response> {
    const token = await TokenService.getAccessToken();
    if (!token) throw new Error("Non authentifié");

    const payload = TokenService.decodeAccessToken(token);
    if (!payload?.sub) throw new Error("Token invalide");

    const url = `${this.baseUrl}${path.replace("{userId}", payload.sub)}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers as Record<string, string>),
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 && !isRetry) {
      try {
        await AuthService.refreshTokens();
        return this.authFetch(path, options, true);
      } catch {
        // refresh failed – return the original 401 response
      }
    }

    return response;
  }

  private async extractErrorMessage(
    response: Response,
    fallback: string,
  ): Promise<string> {
    try {
      const data = await response.json().catch(() => null);
      const msg =
        data?.message ??
        data?.error ??
        data?.detail ??
        (typeof data === "string" ? data : undefined);
      if (typeof msg === "string" && msg.trim()) return msg.trim();
    } catch {}
    return fallback;
  }

  private normalizeProfile(raw: any): UserProfile | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const profilePicture =
      raw.profilePicture ??
      raw.profilePictureUrl ??
      raw.profile_picture_url ??
      raw.avatar_url;
    const visualPreferencesRaw =
      raw.visualPreferences ??
      raw.visual_preferences ??
      raw.preferences?.visualPreferences ??
      raw.preferences?.visual_preferences ??
      raw.metadata?.visualPreferences ??
      raw.metadata?.visual_preferences;
    const visualPreferences =
      visualPreferencesRaw && typeof visualPreferencesRaw === "object"
        ? {
            theme:
              visualPreferencesRaw.theme === "light" ||
              visualPreferencesRaw.theme === "dark" ||
              visualPreferencesRaw.theme === "auto"
                ? visualPreferencesRaw.theme
                : undefined,
            language:
              visualPreferencesRaw.language === "fr" ||
              visualPreferencesRaw.language === "en"
                ? visualPreferencesRaw.language
                : undefined,
            fontSize:
              visualPreferencesRaw.fontSize === "small" ||
              visualPreferencesRaw.fontSize === "medium" ||
              visualPreferencesRaw.fontSize === "large"
                ? visualPreferencesRaw.fontSize
                : undefined,
            backgroundPreset:
              visualPreferencesRaw.backgroundPreset === "whispr" ||
              visualPreferencesRaw.backgroundPreset === "midnight" ||
              visualPreferencesRaw.backgroundPreset === "sunset" ||
              visualPreferencesRaw.backgroundPreset === "aurora" ||
              visualPreferencesRaw.backgroundPreset === "custom"
                ? visualPreferencesRaw.backgroundPreset
                : undefined,
            backgroundMediaId:
              typeof visualPreferencesRaw.backgroundMediaId === "string"
                ? visualPreferencesRaw.backgroundMediaId
                : visualPreferencesRaw.backgroundMediaId === null
                  ? null
                  : undefined,
            backgroundMediaUrl:
              typeof visualPreferencesRaw.backgroundMediaUrl === "string"
                ? visualPreferencesRaw.backgroundMediaUrl
                : visualPreferencesRaw.backgroundMediaUrl === null
                  ? null
                  : undefined,
            updatedAt:
              typeof visualPreferencesRaw.updatedAt === "string"
                ? visualPreferencesRaw.updatedAt
                : visualPreferencesRaw.updatedAt === null
                  ? null
                  : undefined,
          }
        : undefined;
    const backgroundMediaId =
      raw.backgroundMediaId ??
      raw.background_media_id ??
      visualPreferences?.backgroundMediaId ??
      raw?.preferences?.backgroundMediaId ??
      raw?.preferences?.background_media_id ??
      raw?.metadata?.backgroundMediaId ??
      raw?.metadata?.background_media_id;
    const backgroundMediaUrl =
      raw.backgroundMediaUrl ??
      raw.background_media_url ??
      visualPreferences?.backgroundMediaUrl ??
      raw?.preferences?.backgroundMediaUrl ??
      raw?.preferences?.background_media_url ??
      raw?.metadata?.backgroundMediaUrl ??
      raw?.metadata?.background_media_url;
    return {
      id: String(raw.id ?? ""),
      firstName: String(raw.firstName ?? raw.first_name ?? ""),
      lastName: String(raw.lastName ?? raw.last_name ?? ""),
      username: String(raw.username ?? ""),
      phoneNumber: String(raw.phoneNumber ?? raw.phone_number ?? ""),
      biography: String(raw.biography ?? ""),
      profilePicture: profilePicture ? String(profilePicture) : undefined,
      backgroundMediaId: backgroundMediaId
        ? String(backgroundMediaId)
        : undefined,
      backgroundMediaUrl: backgroundMediaUrl
        ? String(backgroundMediaUrl)
        : undefined,
      visualPreferences,
      isOnline: Boolean(raw.isOnline ?? raw.is_online ?? true),
      lastSeen: raw.lastSeen ?? raw.last_seen ?? undefined,
      createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
      updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ""),
    };
  }

  /**
   * POST /user/v1/account/bootstrap
   * Initialize user-service side state (privacy settings, role, etc.) after first login.
   * Idempotent — safe to call on every login.
   */
  async bootstrapAccount(
    userId: string,
    phoneNumber: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await this.authFetch("/account/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, phoneNumber }),
      });
      if (!response.ok) {
        return { success: false, message: `HTTP ${response.status}` };
      }
      return { success: true };
    } catch (error) {
      logger.warn("UserService", "bootstrapAccount failed", error);
      return { success: false, message: "bootstrap failed" };
    }
  }

  /**
   * Get current user profile.
   * Uses GET /profile/me which returns the full profile (including
   * phoneNumber) without privacy masking — see WHISPR-1188.
   */
  async getProfile(): Promise<{
    success: boolean;
    profile?: UserProfile;
    message?: string;
  }> {
    try {
      logger.debug("PDP-UserService", "getProfile → GET /profile/me");
      const response = await this.authFetch("/profile/me");

      if (!response.ok) {
        logger.debug("PDP-UserService", "getProfile ← HTTP", response.status);
        return { success: false, message: `Erreur ${response.status}` };
      }

      const data = await response.json().catch(() => null);
      logger.debug("PDP-UserService", "getProfile ← 200", {
        profilePictureUrl: data?.profilePictureUrl,
        rawKeys: data ? Object.keys(data) : null,
      });
      const profile = this.normalizeProfile(data);
      logger.debug("PDP-UserService", "getProfile normalized", {
        profilePicture: profile?.profilePicture,
      });
      return profile
        ? { success: true, profile }
        : { success: false, message: "Profil invalide reçu du serveur" };
    } catch (error) {
      console.error("[PDP-DEBUG][UserService] getProfile threw:", error);
      return { success: false, message: "Impossible de récupérer le profil" };
    }
  }

  /**
   * Get a specific user's profile by id (not the authenticated user).
   * Used when viewing another member's profile from groups, contacts, etc.
   */
  async getUserProfile(userId: string): Promise<{
    success: boolean;
    profile?: UserProfile;
    message?: string;
  }> {
    try {
      const token = await TokenService.getAccessToken();
      if (!token) return { success: false, message: "Non authentifié" };

      const url = `${this.baseUrl}/profile/${encodeURIComponent(userId)}`;
      logger.debug("PDP-UserService", "getUserProfile → GET", url);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        logger.debug(
          "PDP-UserService",
          "getUserProfile ← HTTP",
          response.status,
        );
        return { success: false, message: `Erreur ${response.status}` };
      }

      const data = await response.json().catch(() => null);
      logger.debug("PDP-UserService", "getUserProfile ← 200", {
        id: data?.id,
        profilePictureUrl: data?.profilePictureUrl,
      });
      if (data && data.profilePictureUrl && !data.profilePicture) {
        data.profilePicture = data.profilePictureUrl;
      }
      return { success: true, profile: data };
    } catch (error) {
      console.error("Erreur récupération profil utilisateur:", error);
      return { success: false, message: "Impossible de récupérer le profil" };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    profileData: UpdateProfileRequest,
  ): Promise<UpdateProfileResponse> {
    try {
      const validation = this.validateProfileData(profileData);
      if (!validation.isValid) {
        return { success: false, message: validation.error };
      }

      logger.debug(
        "PDP-UserService",
        "updateProfile → PATCH /profile/{userId} payload",
        profileData,
      );
      const response = await this.authFetch("/profile/{userId}", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const msg = await this.extractErrorMessage(
          response,
          `Erreur ${response.status}`,
        );
        logger.debug("PDP-UserService", "updateProfile ← HTTP", {
          status: response.status,
          msg,
        });
        return { success: false, message: msg };
      }

      const data = await response.json().catch(() => null);
      logger.debug("PDP-UserService", "updateProfile ← 200", {
        raw: data,
        profilePictureUrl: data?.profilePictureUrl,
      });
      const normalized = this.normalizeProfile(data);
      logger.debug("PDP-UserService", "updateProfile normalized", {
        profilePicture: normalized?.profilePicture,
      });
      return {
        success: true,
        message: "Profil mis à jour avec succès",
        profile: normalized,
      };
    } catch (error) {
      console.error("[PDP-DEBUG][UserService] updateProfile threw:", error);
      return {
        success: false,
        message: "Impossible de mettre à jour le profil",
      };
    }
  }

  /**
   * Update profile picture
   */
  async updateProfilePicture(mediaId: string): Promise<UpdateProfileResponse> {
    try {
      const response = await this.authFetch("/profile/{userId}", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarMediaId: mediaId }),
      });

      if (!response.ok) {
        return {
          success: false,
          message: await this.extractErrorMessage(
            response,
            `Erreur ${response.status}`,
          ),
        };
      }

      const data = await response.json().catch(() => null);
      const normalized = this.normalizeProfile(data);
      return {
        success: true,
        message: "Photo de profil mise à jour avec succès",
        profile: normalized,
      };
    } catch (error) {
      console.error("Erreur mise à jour photo:", error);
      return {
        success: false,
        message: "Impossible de mettre à jour la photo de profil",
      };
    }
  }

  async updateProfileBackground(
    backgroundMediaId: string | null,
    backgroundMediaUrl?: string | null,
  ): Promise<UpdateProfileResponse> {
    const updatedAt = new Date().toISOString();
    try {
      const response = await this.authFetch("/profile/{userId}", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backgroundMediaId,
          backgroundMediaUrl: backgroundMediaUrl ?? null,
          visualPreferences: {
            backgroundPreset: backgroundMediaId ? "custom" : "whispr",
            backgroundMediaId,
            backgroundMediaUrl: backgroundMediaUrl ?? null,
            updatedAt,
          },
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          message: await this.extractErrorMessage(
            response,
            `Erreur ${response.status}`,
          ),
        };
      }

      const data = await response.json().catch(() => null);
      const normalized = this.normalizeProfile(data);
      return {
        success: true,
        message: "Arrière-plan mis à jour avec succès",
        profile: normalized,
      };
    } catch (error) {
      console.error("Erreur mise à jour arrière-plan:", error);
      return {
        success: false,
        message: "Impossible de mettre à jour l'arrière-plan",
      };
    }
  }

  async updateVisualPreferences(
    visualPreferences: UserVisualPreferences,
  ): Promise<UpdateProfileResponse> {
    try {
      const response = await this.authFetch("/profile/{userId}", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visualPreferences }),
      });

      if (!response.ok) {
        return {
          success: false,
          message: await this.extractErrorMessage(
            response,
            `Erreur ${response.status}`,
          ),
        };
      }

      const data = await response.json().catch(() => null);
      const normalized = this.normalizeProfile(data);
      return {
        success: true,
        message: "Préférences visuelles mises à jour avec succès",
        profile: normalized,
      };
    } catch (error) {
      console.error("Erreur mise à jour préférences visuelles:", error);
      return {
        success: false,
        message: "Impossible de mettre à jour les préférences visuelles",
      };
    }
  }

  /**
   * Update username
   */
  async updateUsername(username: string): Promise<UpdateProfileResponse> {
    try {
      const normalizedUsername = normalizeUsername(username);
      const validation = this.validateUsername(normalizedUsername);
      if (!validation.isValid) {
        return { success: false, message: validation.error };
      }

      const response = await this.authFetch("/profile/{userId}", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizedUsername }),
      });

      if (!response.ok) {
        return {
          success: false,
          message: await this.extractErrorMessage(
            response,
            `Erreur ${response.status}`,
          ),
        };
      }

      const data = await response.json().catch(() => null);
      const normalizedProfile = this.normalizeProfile(data);
      return {
        success: true,
        message: "Nom d'utilisateur mis à jour avec succès",
        profile: normalizedProfile,
      };
    } catch (error) {
      console.error("Erreur mise à jour username:", error);
      return {
        success: false,
        message: "Impossible de mettre à jour le nom d'utilisateur",
      };
    }
  }

  /**
   * Get privacy settings
   */
  async getPrivacySettings(): Promise<{
    success: boolean;
    settings?: PrivacySettings;
    message?: string;
  }> {
    try {
      const response = await this.authFetch("/privacy/{userId}");

      if (!response.ok) {
        return { success: false, message: `Erreur ${response.status}` };
      }

      const raw = await response.json().catch(() => null);
      const data: PrivacySettings = {
        profilePictureVisibility:
          raw?.profilePicturePrivacy ??
          raw?.profilePictureVisibility ??
          "everyone",
        firstNameVisibility:
          raw?.firstNamePrivacy ?? raw?.firstNameVisibility ?? "everyone",
        lastNameVisibility:
          raw?.lastNamePrivacy ?? raw?.lastNameVisibility ?? "everyone",
        biographyVisibility:
          raw?.biographyPrivacy ?? raw?.biographyVisibility ?? "everyone",
        lastSeenVisibility:
          raw?.lastSeenPrivacy ?? raw?.lastSeenVisibility ?? "everyone",
        onlineStatusVisibility:
          raw?.onlineStatus ?? raw?.onlineStatusVisibility ?? "everyone",
        groupAddPermission: raw?.groupAddPermission ?? "everyone",
        searchVisibility:
          raw?.searchByUsername ?? raw?.searchVisibility ?? true,
        phoneNumberSearch:
          raw?.searchByPhone ?? raw?.phoneNumberSearch ?? "everyone",
        // backend renvoie read_receipts (snake) ou readReceipts selon la version
        readReceipts: raw?.readReceipts ?? raw?.read_receipts ?? true,
      };
      return { success: true, settings: data };
    } catch (error) {
      console.error("Erreur récupération paramètres confidentialité:", error);
      return {
        success: false,
        message: "Impossible de récupérer les paramètres de confidentialité",
      };
    }
  }

  /**
   * Update privacy settings (PATCH partiel : seuls les champs definis sont
   * envoyes au backend)
   */
  async updatePrivacySettings(
    settings: Partial<PrivacySettings>,
  ): Promise<UpdateProfileResponse> {
    try {
      // PATCH partiel : on n envoie que les champs definis. Permet aux callers
      // de toucher uniquement readReceipts sans ecraser le reste de la privacy.
      const body: Record<string, unknown> = {};
      if (settings.profilePictureVisibility !== undefined) {
        body.profilePicturePrivacy = settings.profilePictureVisibility;
      }
      if (settings.firstNameVisibility !== undefined) {
        body.firstNamePrivacy = settings.firstNameVisibility;
      }
      if (settings.lastNameVisibility !== undefined) {
        body.lastNamePrivacy = settings.lastNameVisibility;
      }
      if (settings.biographyVisibility !== undefined) {
        body.biographyPrivacy = settings.biographyVisibility;
      }
      if (settings.lastSeenVisibility !== undefined) {
        body.lastSeenPrivacy = settings.lastSeenVisibility;
      }
      if (settings.onlineStatusVisibility !== undefined) {
        body.onlineStatus = settings.onlineStatusVisibility;
      }
      if (settings.groupAddPermission !== undefined) {
        body.groupAddPermission = settings.groupAddPermission;
      }
      if (settings.phoneNumberSearch !== undefined) {
        body.searchByPhone = settings.phoneNumberSearch !== "nobody";
      }
      if (settings.searchVisibility !== undefined) {
        body.searchByUsername = settings.searchVisibility;
      }
      if (settings.readReceipts !== undefined) {
        body.readReceipts = settings.readReceipts;
      }
      const response = await this.authFetch("/privacy/{userId}", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return { success: false, message: `Erreur ${response.status}` };
      }

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
      const validation = this.validatePhoneNumber(newPhoneNumber);
      if (!validation.isValid) {
        return { success: false, message: validation.error };
      }

      const response = await this.authFetch("/profile/{userId}", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: newPhoneNumber }),
      });

      if (!response.ok) {
        return { success: false, message: `Erreur ${response.status}` };
      }

      const data = await response.json().catch(() => null);
      const normalized = this.normalizeProfile(data);
      return {
        success: true,
        message: "Numéro de téléphone mis à jour avec succès",
        profile: normalized,
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

    if (!/^[a-z0-9_]+$/.test(username)) {
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
