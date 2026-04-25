import { NativeModules, Platform } from "react-native";
import Constants from "expo-constants";
import { AuthService } from "./AuthService";
import { TokenService } from "./TokenService";
import { DeviceService } from "./DeviceService";
import { getApiBaseUrl } from "./apiBase";

type ApiError = Error & { status?: number; body?: unknown };

type ExpoNotificationsModule = {
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getDevicePushTokenAsync: () => Promise<{ type: string; data: string }>;
  addPushTokenListener: (
    listener: (t: { type: string; data: string }) => void,
  ) => {
    remove: () => void;
  };
};

function loadExpoNotifications(): ExpoNotificationsModule | null {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  const native = NativeModules as Record<string, unknown>;
  const hasNotificationsNative =
    Boolean(native?.ExpoPushTokenManager) ||
    Boolean(native?.ExpoNotificationsEmitter) ||
    Boolean(native?.ExpoBadgeModule);
  if (!hasNotificationsNative) return null;
  try {
    return require("expo-notifications") as ExpoNotificationsModule;
  } catch {
    return null;
  }
}

let tokenRotationSub: { remove: () => void } | null = null;

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

export interface RegisterDeviceParams {
  token: string;
  platform?: "android" | "ios";
  deviceId?: string;
  appVersion?: string;
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

  /**
   * POST /notification/api/v1/devices
   * Enregistre le token push natif (FCM sur Android, APNS sur iOS) côté backend.
   */
  async registerDevice(params: RegisterDeviceParams): Promise<void> {
    const platform =
      params.platform ?? (Platform.OS === "ios" ? "ios" : "android");
    const deviceId =
      params.deviceId ?? (await DeviceService.getOrCreateDeviceId());
    const appVersion =
      params.appVersion ??
      (Constants.expoConfig?.extra?.appVersion as string | undefined) ??
      "1.0.0";

    await apiFetch<void>("/api/v1/devices", {
      method: "POST",
      body: JSON.stringify({
        device_id: deviceId,
        fcm_token: params.token,
        platform,
        app_version: appVersion,
      }),
    });
  },

  /**
   * DELETE /notification/api/v1/devices/:deviceId
   * Désenregistre le device au logout (soft-delete côté serveur, idempotent).
   */
  async unregisterDevice(deviceId: string): Promise<void> {
    await apiFetch<void>(`/api/v1/devices/${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    });
  },

  /**
   * Demande la permission push, récupère le token natif et l'enregistre côté
   * backend, puis abonne un listener pour re-register en cas de rotation FCM.
   * Best-effort : toutes les erreurs sont swallowed, un nouveau run au prochain
   * cold-start retentera.
   *
   * No-op sur web ou si `expo-notifications` n'est pas disponible.
   */
  async initPushRegistration(): Promise<void> {
    const mod = loadExpoNotifications();
    if (!mod) return;

    try {
      const current = await mod.getPermissionsAsync();
      if (current.status !== "granted") {
        const requested = await mod.requestPermissionsAsync();
        if (requested.status !== "granted") return;
      }

      const native = await mod.getDevicePushTokenAsync();
      if (native?.data) {
        await NotificationService.registerDevice({ token: native.data });
      }

      if (!tokenRotationSub) {
        tokenRotationSub = mod.addPushTokenListener((t) => {
          if (t?.data) {
            NotificationService.registerDevice({ token: t.data }).catch(
              () => {},
            );
          }
        });
      }
    } catch {
      // best-effort — swallow, next cold-start retries
    }
  },

  /**
   * Retire le listener de rotation. À appeler au logout.
   */
  tearDownPushRegistration(): void {
    if (tokenRotationSub) {
      try {
        tokenRotationSub.remove();
      } catch {
        // ignore
      }
      tokenRotationSub = null;
    }
  },
};

export default NotificationService;
