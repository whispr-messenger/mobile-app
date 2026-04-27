import { Platform } from "react-native";

/**
 * BadgeService — pilote le badge de l'icône d'app (APNs sur iOS, laucher sur
 * Android quand le launcher le supporte) via `expo-notifications`.
 *
 * Le module natif n'est importé que sur iOS/Android pour éviter les erreurs
 * sous Jest / web où `expo-notifications` n'est pas initialisé.
 */

type ExpoNotificationsModule = {
  setBadgeCountAsync: (count: number) => Promise<boolean>;
  getBadgeCountAsync: () => Promise<number>;
};

function loadNotifications(): ExpoNotificationsModule | null {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return null;
  }
  try {
    return require("expo-notifications") as ExpoNotificationsModule;
  } catch {
    return null;
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  return Math.floor(value);
}

export const BadgeService = {
  async setCount(count: number): Promise<void> {
    const mod = loadNotifications();
    if (!mod) return;
    try {
      await mod.setBadgeCountAsync(clamp(count));
    } catch {
      // silent — badge is a best-effort UX, not critical
    }
  },

  async getCount(): Promise<number> {
    const mod = loadNotifications();
    if (!mod) return 0;
    try {
      return (await mod.getBadgeCountAsync()) ?? 0;
    } catch {
      return 0;
    }
  },

  async reset(): Promise<void> {
    await this.setCount(0);
  },
};

export default BadgeService;
