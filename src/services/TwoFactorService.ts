import { TokenService } from "./TokenService";
import { AUTH_API_URL } from "../config/api";
import type {
  TwoFactorStatusResponse,
  TwoFactorSetupResponse,
  TwoFactorBackupCodesResponse,
} from "../types/auth";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await TokenService.getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${AUTH_API_URL}${path}`, {
    ...options,
    headers,
  });

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
    return apiFetch<TwoFactorStatusResponse>("/v1/2fa/status");
  },

  async setup(): Promise<TwoFactorSetupResponse> {
    return apiFetch<TwoFactorSetupResponse>("/v1/2fa/setup", {
      method: "POST",
    });
  },

  async enable(token: string): Promise<void> {
    return apiFetch<void>("/v1/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  async disable(token: string): Promise<void> {
    return apiFetch<void>("/v1/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  async getBackupCodes(): Promise<TwoFactorBackupCodesResponse> {
    return apiFetch<TwoFactorBackupCodesResponse>("/v1/2fa/backup-codes", {
      method: "POST",
    });
  },
};

export default TwoFactorService;
