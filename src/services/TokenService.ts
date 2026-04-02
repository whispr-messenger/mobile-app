import type { JwtPayload, TokenPair } from "../types/auth";
import { storage } from "./storage";

// expo-secure-store doesn't work on web — fallback to localStorage
const storage = Platform.OS === 'web'
  ? {
      getItemAsync: async (key: string) => localStorage.getItem(key),
      setItemAsync: async (key: string, value: string) => localStorage.setItem(key, value),
      deleteItemAsync: async (key: string) => localStorage.removeItem(key),
    }
  : require('expo-secure-store') as {
      getItemAsync: (key: string) => Promise<string | null>;
      setItemAsync: (key: string, value: string) => Promise<void>;
      deleteItemAsync: (key: string) => Promise<void>;
    };

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
    await storage.setItem(KEYS.ACCESS_TOKEN, tokens.accessToken);
    await storage.setItem(KEYS.REFRESH_TOKEN, tokens.refreshToken);
  },

  async getAccessToken(): Promise<string | null> {
    return storage.getItem(KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return storage.getItem(KEYS.REFRESH_TOKEN);
  },

  async clearTokens(): Promise<void> {
    await storage.deleteItem(KEYS.ACCESS_TOKEN);
    await storage.deleteItem(KEYS.REFRESH_TOKEN);
  },

  async saveIdentityPrivateKey(base64Key: string): Promise<void> {
    await storage.setItem(KEYS.IDENTITY_KEY, base64Key);
  },

  async getIdentityPrivateKey(): Promise<string | null> {
    return storage.getItem(KEYS.IDENTITY_KEY);
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
