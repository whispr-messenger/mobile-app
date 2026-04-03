import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { AuthService } from './AuthService';
import { TokenService } from './TokenService';

type ApiError = Error & { status?: number; body?: unknown };

function getDevHost(): string {
  if (Platform.OS === 'android') return '10.0.2.2';
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) return debuggerHost.split(':')[0];
  return 'localhost';
}

function getNotificationBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  if (__DEV__) {
    const configured = extra?.devNotificationApiUrl;
    if (configured) return configured.replace(/\/+$/, '');
    return `http://${getDevHost()}:3004`;
  }
  return `${(extra?.apiBaseUrl ?? 'https://whispr-api.roadmvn.com').replace(/\/+$/, '')}/notification`;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = await TokenService.getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${getNotificationBaseUrl()}${path}`, {
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
      (body as { message?: string })?.message ?? `HTTP ${response.status}`
    ) as ApiError;
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) return undefined as unknown as T;
  return response.json() as Promise<T>;
}

export interface NotificationSettings {
  push_enabled: boolean;
  message_previews: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  show_sender_name: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string; // HH:mm
  quiet_hours_end?: string;   // HH:mm
}

export interface MuteSettings {
  conversation_id: string;
  muted_until?: string; // ISO date, undefined = muted forever
}

export const NotificationService = {
  /**
   * GET /notification/api/settings/:id
   * Get notification settings for a user.
   */
  async getSettings(userId: string): Promise<NotificationSettings> {
    return apiFetch<NotificationSettings>(`/api/settings/${encodeURIComponent(userId)}`);
  },

  /**
   * PUT /notification/api/settings/:id
   * Update notification settings for a user.
   */
  async updateSettings(
    userId: string,
    settings: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    return apiFetch<NotificationSettings>(`/api/settings/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  /**
   * POST /notification/api/conversations/:id/mute
   * Mute notifications for a conversation.
   * @param duration  Duration in seconds. Omit to mute indefinitely.
   */
  async muteConversation(conversationId: string, duration?: number): Promise<void> {
    const body: Record<string, unknown> = {};
    if (duration !== undefined) body['duration'] = duration;

    await apiFetch<void>(
      `/api/conversations/${encodeURIComponent(conversationId)}/mute`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  },

  /**
   * DELETE /notification/api/conversations/:id/mute
   * Unmute notifications for a conversation.
   */
  async unmuteConversation(conversationId: string): Promise<void> {
    await apiFetch<void>(
      `/api/conversations/${encodeURIComponent(conversationId)}/mute`,
      { method: 'DELETE' }
    );
  },
};

export default NotificationService;
