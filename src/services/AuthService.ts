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

// WHISPR-1218 — backoff state for transient backend failures (5xx /
// network). 401/403 still goes straight to sessionDead because that's
// auth saying "no", not "I'm down".
const MAX_TRANSIENT_FAILURES = 3;
const COOLDOWN_BASE_MS = 1000;
let consecutiveTransientFailures = 0;
let cooldownUntil = 0;

function resetSessionState(): void {
  sessionDead = false;
  consecutiveTransientFailures = 0;
  cooldownUntil = 0;
}

// Treat undefined status (network error) and 5xx as transient. Other
// 4xx (e.g. 400 bad-request) are programming errors and shouldn't poison
// the backoff counter — let them propagate without state change.
function isTransientFailure(status: number | undefined): boolean {
  return status === undefined || status >= 500;
}

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
    resetSessionState();
    const userId = TokenService.decodeAccessToken(tokens.accessToken)?.sub;
    if (userId) {
      NotificationService.initPushRegistration(userId).catch(() => {});
    }
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
    resetSessionState();
    const userId = TokenService.decodeAccessToken(tokens.accessToken)?.sub;
    if (userId) {
      NotificationService.initPushRegistration(userId).catch(() => {});
    }
    return tokens;
  },

  async refreshTokens(): Promise<void> {
    // Fast-fail once the session has been declared dead. Without this,
    // every concurrent 401 triggers yet another refresh → another logout
    // event → every screen that is still mounted fetches again → loop.
    if (sessionDead) {
      throw new Error("SESSION_EXPIRED");
    }
    // WHISPR-1218 — short-circuit during the cooldown that follows
    // transient (5xx / network) failures. Without this, every 401 from
    // an in-flight HTTP call would re-trigger refresh → 5xx → repeat,
    // hammering an already-degraded auth-service.
    if (cooldownUntil > Date.now()) {
      throw new Error("AUTH_UNREACHABLE");
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
          // Healthy response — clear any pending backoff state.
          consecutiveTransientFailures = 0;
          cooldownUntil = 0;
        } catch (err) {
          const status = (err as { status?: number })?.status;
          console.error(
            "[AuthService] refreshTokens failed, status=",
            status,
            err,
          );

          if (status === 401 || status === 403) {
            // Auth said "no" — session genuinely dead.
            sessionDead = true;
            await TokenService.clearTokens();
            emitSessionExpired("refresh_failed");
            console.warn(
              "[AuthService] tokens cleared, sessionExpired event emitted",
            );
          } else if (isTransientFailure(status)) {
            // 5xx or network — auth-service is unreachable, not refusing.
            consecutiveTransientFailures += 1;
            if (consecutiveTransientFailures >= MAX_TRANSIENT_FAILURES) {
              // Stop hammering — declare unreachable and bounce the user.
              sessionDead = true;
              emitSessionExpired("auth_unreachable");
              console.warn(
                "[AuthService] auth-service unreachable after",
                consecutiveTransientFailures,
                "attempts; sessionExpired emitted",
              );
            } else {
              // Exponential backoff: 1 s, 2 s, 4 s.
              cooldownUntil =
                Date.now() +
                COOLDOWN_BASE_MS *
                  Math.pow(2, consecutiveTransientFailures - 1);
            }
          }
          // Other 4xx (400/404/etc.) are bugs, not retry-worthy — let
          // them propagate without poisoning the backoff state.
          throw err;
        }
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  // WHISPR-1214 — récupère un JWT court-vivant (60 s, aud=ws) à passer dans
  // la query string du handshake Phoenix. Le token long (access token) ne
  // doit jamais transiter par l'URL : reverse-proxies, HAR exports et
  // Sentry breadcrumbs le captureraient. On échoue si pas d'access token
  // disponible — l'appelant (websocket.ts) gère le fallback éventuel.
  async getWsToken(): Promise<{ wsToken: string; expiresIn: number }> {
    const access = await TokenService.getAccessToken();
    if (!access) {
      const err = new Error("NO_ACCESS_TOKEN") as Error & { status: number };
      err.status = 401;
      throw err;
    }
    return apiFetch<{ wsToken: string; expiresIn: number }>(
      "/tokens/ws-token",
      {
        method: "POST",
        token: access,
      },
    );
  },

  async logout(deviceId: string, userId: string): Promise<void> {
    const token = await TokenService.getAccessToken();

    // WHISPR-1217 — properly await the unregister so a fresh login on the
    // same device can't race ahead while the server still has the previous
    // user's row. We bound the wait at 5 s so a hung connection can't
    // block logout indefinitely. Failures are logged (vs. swallowed
    // silently) so shared-device misroute reports are debuggable.
    try {
      await Promise.race([
        NotificationService.unregisterDevice(deviceId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("UNREGISTER_TIMEOUT")), 5000),
        ),
      ]);
    } catch (err) {
      console.warn("[AuthService] unregisterDevice failed:", err);
    }
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
