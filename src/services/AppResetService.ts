import AsyncStorage from "@react-native-async-storage/async-storage";
import { TokenService } from "./TokenService";

// Keys that survive a sign-out. The list must stay tight: anything not in
// here that lives under one of the OWNED_PREFIXES will be wiped on logout.
//
// `whispr.globalSettings.v1` carries the language and theme — preferences
// that aren't tied to a specific account and that users would resent
// having to re-set after every sign-out.
const PRESERVED_KEYS: ReadonlySet<string> = new Set([
  "whispr.globalSettings.v1",
]);

// Every key written by this app uses one of these prefixes. Anything
// outside the prefixes belongs to React Native or a vendor library and
// MUST NOT be touched (Expo Constants caches, Metro state, etc.).
const OWNED_PREFIXES: readonly string[] = ["whispr.", "@whispr"];

function isOwned(key: string): boolean {
  return OWNED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export const AppResetService = {
  /**
   * Wipe per-account state. Called from `AuthContext.signOut()` to make sure
   * a fresh login on the same device starts from a clean slate (no stale
   * settings, no leftover caches, no previous user's identity material).
   *
   * Two-step cleanup:
   *   1. `AsyncStorage.getAllKeys()` filtered by prefix + allowlist. This
   *      catches every `whispr.*` / `@whispr*` key automatically — caches
   *      that get added later are covered without an audit.
   *   2. `TokenService.clearAll()` so the secure-store / encrypted-vault
   *      backed values (access/refresh tokens + Signal identity private
   *      key) are removed via the right backend on each platform.
   */
  async resetAppData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const toRemove = keys.filter(
        (key) => isOwned(key) && !PRESERVED_KEYS.has(key),
      );
      if (toRemove.length > 0) {
        await AsyncStorage.multiRemove(toRemove);
      }
    } catch {
      // Best-effort: if AsyncStorage is unavailable, fall through to the
      // token cleanup so at minimum the session credentials are gone.
    }

    await TokenService.clearAll();
  },
};
