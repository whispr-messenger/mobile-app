import { TokenService } from "./TokenService";
import { AuthService } from "./AuthService";
import { getApiBaseUrl } from "./apiBase";
import type {
  TwoFactorStatusResponse,
  TwoFactorSetupResponse,
  TwoFactorBackupCodesResponse,
} from "../types/auth";

function getAuthBaseUrl(): string {
  return `${getApiBaseUrl()}/auth/v1`;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const token = await TokenService.getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${getAuthBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !isRetry) {
    try {
      await AuthService.refreshTokens();
      return apiFetch<T>(path, options, true);
    } catch {
      // fall through
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      body?.message ?? `HTTP ${response.status}`,
    ) as Error & { status: number; body: unknown };
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) return undefined as unknown as T;

  return response.json() as Promise<T>;
}

export const TwoFactorService = {
  async getStatus(): Promise<TwoFactorStatusResponse> {
    return apiFetch<TwoFactorStatusResponse>("/2fa/status");
  },

  async setup(): Promise<TwoFactorSetupResponse> {
    return apiFetch<TwoFactorSetupResponse>("/2fa/setup", {
      method: "POST",
    });
  },

  async enable(token: string): Promise<TwoFactorBackupCodesResponse> {
    return apiFetch<TwoFactorBackupCodesResponse>("/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  async disable(token: string): Promise<void> {
    return apiFetch<void>("/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  async getBackupCodes(token: string): Promise<TwoFactorBackupCodesResponse> {
    return apiFetch<TwoFactorBackupCodesResponse>("/2fa/backup-codes", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
};

export default TwoFactorService;
