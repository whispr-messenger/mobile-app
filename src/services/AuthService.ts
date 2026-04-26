import { TokenService } from "./TokenService";
import { DeviceService } from "./DeviceService";
import { SignalKeyService } from "./SignalKeyService";
import { NotificationService } from "./NotificationService";
import { getApiBaseUrl } from "./apiBase";
import { emitSessionExpired } from "./sessionEvents";
import type {
  AuthPurpose,
  TokenPair,
  VerificationConfirmResponse,
  VerificationRequestResponse,
} from "../types/auth";

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // The auth-service hashes (userAgent + ip + deviceType) into a device
    // fingerprint. Browsers' UA does not contain "mobile", so the backend
    // auto-detects "desktop" while login body sends "mobile" → fingerprint
    // mismatch on /tokens/refresh. Force the header so both endpoints see
    // the same deviceType.
    "x-device-type": "mobile",
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}/auth/v1${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      body?.message ?? `HTTP ${response.status}`,
    ) as Error & {
      status: number;
      body: unknown;
    };
    error.status = response.status;
    error.body = body;
    throw error;
  }

  // 204 No Content
  if (response.status === 204) return undefined as unknown as T;

  return response.json() as Promise<T>;
}

let refreshPromise: Promise<void> | null = null;
// Once the session has been declared dead (tokens cleared + event emitted),
// further refresh attempts must fail fast instead of re-entering the dead
// refresh loop. Reset on every successful login/register.
let sessionDead = false;

export const AuthService = {
  async requestVerification(
    phoneNumber: string,
    purpose: AuthPurpose,
  ): Promise<VerificationRequestResponse> {
    return apiFetch<VerificationRequestResponse>(`/verify/${purpose}/request`, {
      method: "POST",
      body: JSON.stringify({ phoneNumber }),
    });
  },

  async confirmVerification(
    verificationId: string,
    code: string,
    purpose: AuthPurpose,
  ): Promise<VerificationConfirmResponse> {
    return apiFetch<VerificationConfirmResponse>(`/verify/${purpose}/confirm`, {
      method: "POST",
      body: JSON.stringify({ verificationId, code }),
    });
  },

  async register(verificationId: string): Promise<TokenPair> {
    const [deviceInfo, signalKeyBundle] = await Promise.all([
      DeviceService.getDeviceInfo(),
      SignalKeyService.generateKeyBundle(),
    ]);

    const tokens = await apiFetch<TokenPair>("/register", {
      method: "POST",
      body: JSON.stringify({
        verificationId,
        ...deviceInfo,
        signalKeyBundle,
      }),
    });

    await TokenService.saveTokens(tokens);
    sessionDead = false;
    NotificationService.initPushRegistration().catch(() => {});
    return tokens;
  },

  async login(verificationId: string): Promise<TokenPair> {
    const [deviceInfo, signalKeyBundle] = await Promise.all([
      DeviceService.getDeviceInfo(),
      SignalKeyService.generateKeyBundle(),
    ]);

    const tokens = await apiFetch<TokenPair>("/login", {
      method: "POST",
      body: JSON.stringify({
        verificationId,
        ...deviceInfo,
        signalKeyBundle,
      }),
    });

    await TokenService.saveTokens(tokens);
    sessionDead = false;
    NotificationService.initPushRegistration().catch(() => {});
    return tokens;
  },

  async refreshTokens(): Promise<void> {
    // Fast-fail once the session has been declared dead. Without this,
    // every concurrent 401 triggers yet another refresh → another logout
    // event → every screen that is still mounted fetches again → loop.
    if (sessionDead) {
      throw new Error("SESSION_EXPIRED");
    }
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const refreshToken = await TokenService.getRefreshToken();
        if (!refreshToken) {
          sessionDead = true;
          emitSessionExpired("no_refresh_token");
          throw new Error("SESSION_EXPIRED");
        }

        try {
          const tokens = await apiFetch<TokenPair>("/tokens/refresh", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          });
          await TokenService.saveTokens(tokens);
        } catch (err) {
          // Refresh failed (401 / token revoked / fingerprint mismatch).
          // Clear local tokens once, emit sessionExpired once, and mark the
          // session dead so subsequent callers short-circuit above.
          const status = (err as { status?: number })?.status;
          console.error(
            "[AuthService] refreshTokens failed, status=",
            status,
            err,
          );
          if (status === 401 || status === 403) {
            sessionDead = true;
            await TokenService.clearTokens();
            emitSessionExpired("refresh_failed");
            console.warn(
              "[AuthService] tokens cleared, sessionExpired event emitted",
            );
          }
          throw err;
        }
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  async logout(deviceId: string, userId: string): Promise<void> {
    const token = await TokenService.getAccessToken();
    await NotificationService.unregisterDevice(deviceId).catch(() => {});
    NotificationService.tearDownPushRegistration();
    await apiFetch("/logout", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({ deviceId, userId }),
    }).catch(() => {
      // Best-effort: clear local tokens even if server call fails
    });
    await TokenService.clearTokens();
  },

  async validateSession(): Promise<{
    userId: string;
    deviceId: string;
  } | null> {
    const token = await TokenService.getAccessToken();
    if (!token) return null;

    // Try to refresh if expired
    if (TokenService.isTokenExpired(token)) {
      try {
        await AuthService.refreshTokens();
        const newToken = await TokenService.getAccessToken();
        if (!newToken) return null;
        return AuthService._extractSession(newToken);
      } catch {
        await TokenService.clearTokens();
        return null;
      }
    }

    // Validate with a network call (GET /auth/device).
    // Bound the request: without a timeout, a hanging network on app boot
    // keeps the splash screen forever (validateSession never resolves).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/v1/device`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-device-type": "mobile",
        },
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        await TokenService.clearTokens();
        return null;
      }

      return AuthService._extractSession(token);
    } catch {
      // Network error or timeout — trust the token locally rather than
      // bouncing the user to the login screen on a flaky connection.
      return AuthService._extractSession(token);
    } finally {
      clearTimeout(timeoutId);
    }
  },

  _extractSession(token: string): { userId: string; deviceId: string } | null {
    const payload = TokenService.decodeAccessToken(token);
    if (!payload) return null;
    return { userId: payload.sub, deviceId: payload.deviceId };
  },
};

export default AuthService;
