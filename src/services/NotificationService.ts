import { AuthService } from "./AuthService";
import { TokenService } from "./TokenService";
import { getApiBaseUrl } from "./apiBase";

type ApiError = Error & { status?: number; body?: unknown };

function getNotificationBaseUrl(): string {
  return `${getApiBaseUrl()}/notification`;
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
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

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
      (body as { message?: string })?.message ?? `HTTP ${response.status}`,
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
  quiet_hours_end?: string; // HH:mm
}

export interface MuteSettings {
  conversation_id: string;
  muted_until?: string; // ISO date, undefined = muted forever
}

export interface BadgeCountResponse {
  unread_count: number;
}

export const NotificationService = {
  /**
   * GET /notification/api/v1/badge
   * Retourne le compteur de notifications non lues pour l'utilisateur.
   */
  async getBadge(): Promise<number> {
    const res = await apiFetch<BadgeCountResponse>("/api/v1/badge");
    return typeof res?.unread_count === "number" ? res.unread_count : 0;
  },

  /**
   * GET /notification/api/settings/:id
   * Get notification settings for a user.
   */
  async getSettings(userId: string): Promise<NotificationSettings> {
    return apiFetch<NotificationSettings>(
      `/api/settings/${encodeURIComponent(userId)}`,
    );
  },

  /**
   * PUT /notification/api/settings/:id
   * Update notification settings for a user.
   */
  async updateSettings(
    userId: string,
    settings: Partial<NotificationSettings>,
  ): Promise<NotificationSettings> {
    return apiFetch<NotificationSettings>(
      `/api/settings/${encodeURIComponent(userId)}`,
      {
        method: "PUT",
        body: JSON.stringify(settings),
      },
    );
  },

  /**
   * POST /notification/api/conversations/:id/mute
   * Mute notifications for a conversation.
   * @param duration  Duration in seconds. Omit to mute indefinitely.
   */
  async muteConversation(
    conversationId: string,
    duration?: number,
  ): Promise<void> {
    const body: Record<string, unknown> = {};
    if (duration !== undefined) body["duration"] = duration;

    await apiFetch<void>(
      `/api/conversations/${encodeURIComponent(conversationId)}/mute`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  /**
   * DELETE /notification/api/conversations/:id/mute
   * Unmute notifications for a conversation.
   */
  async unmuteConversation(conversationId: string): Promise<void> {
    await apiFetch<void>(
      `/api/conversations/${encodeURIComponent(conversationId)}/mute`,
      { method: "DELETE" },
    );
  },
};

export default NotificationService;
