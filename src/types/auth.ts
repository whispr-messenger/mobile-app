export type AuthPurpose = "login" | "register";

export interface VerificationRequestResponse {
  verificationId: string;
  code?: string; // only in DEMO_MODE
}

export interface VerificationConfirmResponse {
  verified: boolean;
  requires2FA?: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string; // userId
  deviceId: string;
  scope: string;
  fingerprint: string;
  iat: number;
  exp: number;
}

export interface PreKeyDto {
  keyId: number;
  publicKey: string; // base64
}

export interface SignedPreKeyDto {
  keyId: number;
  publicKey: string; // base64
  signature: string; // base64
}

export interface SignalKeyBundleDto {
  identityKey: string; // base64
  signedPreKey: SignedPreKeyDto;
  preKeys: PreKeyDto[];
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  model: string;
  osVersion: string;
  appVersion: string;
  fcmToken?: string;
  apnsToken?: string;
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUri: string;
  /** @deprecated Use otpauthUri for client-side QR generation */
  qrCodeUrl: string;
}

export interface TwoFactorBackupCodesResponse {
  backupCodes: string[];
}
