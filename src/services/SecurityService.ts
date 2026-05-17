import { AuthService } from "./AuthService";
import { TokenService } from "./TokenService";
import { DeviceService } from "./DeviceService";
import { getApiBaseUrl } from "./apiBase";

type ApiError = Error & { status?: number; body?: unknown };

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
    Accept: "application/json",
    "x-device-type": "mobile",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

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
      (body as { message?: string })?.message ?? `HTTP ${response.status}`,
    ) as ApiError;
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) return undefined as unknown as T;
  return response.json() as Promise<T>;
}

// ─── 2FA ────────────────────────────────────────────────────────────────────

export interface TwoFASetupResult {
  secret: string;
  qr_code_url: string;
  backup_codes?: string[];
}

export interface TwoFAStatus {
  enabled: boolean;
  setup_at?: string;
}

export const TwoFactorAuthService = {
  /**
   * POST /auth/2fa/setup
   * Initialize 2FA — returns TOTP secret + QR code URL.
   */
  async setup(): Promise<TwoFASetupResult> {
    return apiFetch<TwoFASetupResult>("/2fa/setup", { method: "POST" });
  },

  /**
   * POST /auth/2fa/enable
   * Confirm and enable 2FA with the first TOTP code.
   */
  async enable(code: string): Promise<void> {
    await apiFetch<void>("/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  /**
   * POST /auth/2fa/verify
   * Verify a TOTP code (used during login when 2FA is active).
   */
  async verify(
    code: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    return apiFetch("/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  /**
   * POST /auth/2fa/disable
   * Disable 2FA (requires current TOTP code or backup code).
   */
  async disable(code: string): Promise<void> {
    await apiFetch<void>("/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  /**
   * POST /auth/2fa/backup-codes
   * Regenerate backup codes.
   */
  async generateBackupCodes(): Promise<{ backup_codes: string[] }> {
    return apiFetch("/2fa/backup-codes", { method: "POST" });
  },

  /**
   * GET /auth/2fa/status
   * Get 2FA status for the current user.
   */
  async getStatus(): Promise<TwoFAStatus> {
    return apiFetch<TwoFAStatus>("/2fa/status");
  },
};

// ─── Device management ───────────────────────────────────────────────────────

export interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  last_active: string;
  is_current: boolean;
}

export const DeviceManagerService = {
  /**
   * GET /auth/device
   * List all registered devices for the current user.
   */
  async listDevices(): Promise<DeviceInfo[]> {
    const data = await apiFetch<DeviceInfo | DeviceInfo[]>("/device");
    return Array.isArray(data) ? data : [data];
  },

  /**
   * DELETE /auth/device/:deviceId
   * Revoke a device (log it out remotely).
   */
  async revokeDevice(deviceId: string): Promise<void> {
    await apiFetch<void>(`/device/${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    });
  },
};

// ─── Signal Protocol keys ────────────────────────────────────────────────────

export interface SignalKeyBundle {
  identity_key: string;
  signed_prekey: {
    key_id: number;
    public_key: string;
    signature: string;
  };
  one_time_prekeys: Array<{
    key_id: number;
    public_key: string;
  }>;
}

export interface SignalHealthStatus {
  prekeys_remaining: number;
  signed_prekey_age_days: number;
  needs_replenishment: boolean;
}

export const SignalKeysService = {
  async listDevices(
    userId: string,
  ): Promise<{ userId: string; deviceIds: string[] }> {
    return apiFetch<{ userId: string; deviceIds: string[] }>(
      `/signal/keys/${encodeURIComponent(userId)}/devices`,
    );
  },
  /**
   * GET /auth/signal/keys/:userId/devices/:deviceId
   * Fetch the key bundle for a specific user+device (for E2E session init).
   */
  async getKeyBundle(
    userId: string,
    deviceId: string,
  ): Promise<SignalKeyBundle> {
    return apiFetch<SignalKeyBundle>(
      `/signal/keys/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}`,
    );
  },

  /**
   * POST /auth/signal/keys/signed-prekey
   * Upload a new signed prekey (rotation).
   */
  async uploadSignedPrekey(signedPrekey: {
    key_id: number;
    public_key: string;
    signature: string;
  }): Promise<void> {
    await apiFetch<void>("/signal/keys/signed-prekey", {
      method: "POST",
      body: JSON.stringify({
        keyId: signedPrekey.key_id,
        publicKey: signedPrekey.public_key,
        signature: signedPrekey.signature,
      }),
    });
  },

  /**
   * POST /auth/signal/keys/prekeys
   * Upload a batch of one-time prekeys.
   */
  async uploadPrekeys(
    prekeys: Array<{ key_id: number; public_key: string }>,
  ): Promise<void> {
    await apiFetch<void>("/signal/keys/prekeys", {
      method: "POST",
      body: JSON.stringify({
        preKeys: prekeys.map((pk) => ({
          keyId: pk.key_id,
          publicKey: pk.public_key,
        })),
      }),
    });
  },

  /**
   * GET /auth/signal/health
   * Check key health (how many prekeys remain, rotation needed, etc.).
   */
  async getHealth(): Promise<SignalHealthStatus> {
    return apiFetch<SignalHealthStatus>("/signal/health");
  },
};
