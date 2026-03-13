import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { TokenService } from './TokenService';
import { DeviceService } from './DeviceService';
import { SignalKeyService } from './SignalKeyService';
import type {
  AuthPurpose,
  TokenPair,
  VerificationConfirmResponse,
  VerificationRequestResponse,
} from '../types/auth';

function getDevHost(): string {
  if (Platform.OS === 'android') return '10.0.2.2';
  // On iOS simulator, localhost works; on physical device use the LAN IP
  // from the Expo dev server (debuggerHost).
  const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) return debuggerHost.split(':')[0];
  return 'localhost';
}

function getBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  if (__DEV__) {
    return `http://${getDevHost()}:3010/auth`;
  }
  return `${extra?.apiBaseUrl ?? 'https://whispr.epitech.beer'}/auth`;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body?.message ?? `HTTP ${response.status}`) as Error & {
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

export const AuthService = {
  async requestVerification(
    phoneNumber: string,
    purpose: AuthPurpose
  ): Promise<VerificationRequestResponse> {
    return apiFetch<VerificationRequestResponse>(
      `/v1/auth/verify/${purpose}/request`,
      {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
      }
    );
  },

  async confirmVerification(
    verificationId: string,
    code: string,
    purpose: AuthPurpose
  ): Promise<VerificationConfirmResponse> {
    return apiFetch<VerificationConfirmResponse>(
      `/v1/auth/verify/${purpose}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ verificationId, code }),
      }
    );
  },

  async register(verificationId: string): Promise<TokenPair> {
    const [deviceInfo, signalKeyBundle] = await Promise.all([
      DeviceService.getDeviceInfo(),
      SignalKeyService.generateKeyBundle(),
    ]);

    const tokens = await apiFetch<TokenPair>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        verificationId,
        ...deviceInfo,
        signalKeyBundle,
      }),
    });

    await TokenService.saveTokens(tokens);
    return tokens;
  },

  async login(verificationId: string): Promise<TokenPair> {
    const [deviceInfo, signalKeyBundle] = await Promise.all([
      DeviceService.getDeviceInfo(),
      SignalKeyService.generateKeyBundle(),
    ]);

    const tokens = await apiFetch<TokenPair>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        verificationId,
        ...deviceInfo,
        signalKeyBundle,
      }),
    });

    await TokenService.saveTokens(tokens);
    return tokens;
  },

  async refreshTokens(): Promise<void> {
    const refreshToken = await TokenService.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const tokens = await apiFetch<TokenPair>('/v1/tokens/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    await TokenService.saveTokens(tokens);
  },

  async logout(deviceId: string, userId: string): Promise<void> {
    const token = await TokenService.getAccessToken();
    await apiFetch('/v1/auth/logout', {
      method: 'POST',
      token: token ?? undefined,
      body: JSON.stringify({ deviceId, userId }),
    }).catch(() => {
      // Best-effort: clear local tokens even if server call fails
    });
    await TokenService.clearTokens();
  },

  async validateSession(): Promise<{ userId: string; deviceId: string } | null> {
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

    // Validate with a network call (GET /users/me via user-service)
    try {
      const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
      const userApiBase = __DEV__
        ? `http://${getDevHost()}:3011/user/v1`
        : `${extra?.apiBaseUrl ?? 'https://whispr.epitech.beer'}/user/v1`;

      const response = await fetch(`${userApiBase}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401 || response.status === 403) {
        await TokenService.clearTokens();
        return null;
      }

      return AuthService._extractSession(token);
    } catch {
      // Network error — trust the token locally
      return AuthService._extractSession(token);
    }
  },

  _extractSession(token: string): { userId: string; deviceId: string } | null {
    const payload = TokenService.decodeAccessToken(token);
    if (!payload) return null;
    return { userId: payload.sub, deviceId: payload.deviceId };
  },
};

export default AuthService;
