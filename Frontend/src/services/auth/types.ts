/**
 * Types partagés pour les services d'authentification
 * Basés sur les DTOs du backend auth-service
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

// DTOs pour les requêtes API
export interface VerificationRequestDto {
  phoneNumber: string; // Format international: +33123456789
}

export interface VerificationConfirmDto {
  verificationId: string; // UUID
  code: string; // 6 chiffres
}

export interface RegisterDto {
  verificationId: string; // UUID
  firstName: string;
  lastName: string;
  deviceName?: string;
  deviceType?: string;
  publicKey?: string;
}

export interface LoginDto {
  verificationId: string; // UUID
  deviceName?: string;
  deviceType?: string;
  publicKey?: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

// Réponses API
export interface VerificationResponse {
  verificationId: string;
  expiresAt?: string;
  attemptsRemaining?: number;
  message?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: string;
    phoneNumber: string;
    firstName?: string;
    lastName?: string;
    twoFactorEnabled: boolean;
  };
  device: {
    id: string;
    deviceName: string;
    deviceType: string;
    isVerified: boolean;
  };
}

export interface VerifyResponse {
  verified: boolean;
}

// Interface commune pour les services
export interface IAuthService {
  // Inscription
  requestRegistrationVerification(phoneNumber: PhoneNumber): Promise<{ success: boolean; verificationId?: string; message?: string }>;
  confirmRegistrationVerification(verificationId: string, code: VerificationCode): Promise<{ success: boolean; message?: string }>;
  register(verificationId: string, profile: UserProfile, deviceInfo?: any): Promise<{ success: boolean; data?: AuthResponse; message?: string }>;

  // Connexion
  requestLoginVerification(phoneNumber: PhoneNumber): Promise<{ success: boolean; verificationId?: string; message?: string }>;
  confirmLoginVerification(verificationId: string, code: VerificationCode): Promise<{ success: boolean; message?: string }>;
  login(verificationId: string, deviceInfo?: any): Promise<{ success: boolean; data?: AuthResponse; message?: string }>;

  // Tokens
  refreshToken(refreshToken: string): Promise<{ success: boolean; data?: AuthResponse; message?: string }>;
  logout(): Promise<{ success: boolean; message?: string }>;

  // Utilitaires
  validatePhoneNumber(phoneNumber: PhoneNumber): { isValid: boolean; error?: string };
  validateVerificationCode(code: string): { isValid: boolean; error?: string };
  validateProfile(profile: UserProfile): { isValid: boolean; error?: string };
}

