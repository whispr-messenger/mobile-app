import * as SecureStore from "expo-secure-store";
import type { JwtPayload, TokenPair } from "../types/auth";

const KEYS = {
  ACCESS_TOKEN: "whispr.auth.accessToken",
  REFRESH_TOKEN: "whispr.auth.refreshToken",
  IDENTITY_KEY: "whispr.signal.identityKeyPrivate",
} as const;

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url → base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "==".slice(0, (4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export const TokenService = {
  async saveTokens(tokens: TokenPair): Promise<void> {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, tokens.accessToken);
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, tokens.refreshToken);
  },

  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
  },

  async saveIdentityPrivateKey(base64Key: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.IDENTITY_KEY, base64Key);
  },

  async getIdentityPrivateKey(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.IDENTITY_KEY);
  },

  async clearIdentityPrivateKey(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.IDENTITY_KEY);
  },

  async clearAll(): Promise<void> {
    await Promise.all([this.clearTokens(), this.clearIdentityPrivateKey()]);
  },

  decodeAccessToken(token: string): JwtPayload | null {
    return decodeJwtPayload(token);
  },

  isTokenExpired(token: string): boolean {
    const payload = decodeJwtPayload(token);
    if (!payload) return true;
    return Date.now() / 1000 >= payload.exp;
  },
};
