import AsyncStorage from "@react-native-async-storage/async-storage";

export type ModerationModelVersion = "v2" | "v3";

export const DEFAULT_MODERATION_MODEL: ModerationModelVersion = "v2";
export const MODERATION_MODEL_STORAGE_KEY = "debug:moderationModel";

function isValidVersion(value: unknown): value is ModerationModelVersion {
  return value === "v2" || value === "v3";
}

// Cached in memory so `gate()` stays synchronous-friendly and the storage
// lookup isn't hit on the hot path. Updated eagerly by setModerationModelVersion.
let cached: ModerationModelVersion = DEFAULT_MODERATION_MODEL;
let hydrated = false;
let hydrating: Promise<void> | null = null;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const raw = await AsyncStorage.getItem(MODERATION_MODEL_STORAGE_KEY);
      if (isValidVersion(raw)) cached = raw;
    } catch {
      // AsyncStorage unavailable (e.g. web SSR) — stick to the default.
    } finally {
      hydrated = true;
      hydrating = null;
    }
  })();
  return hydrating;
}

export async function getModerationModelVersion(): Promise<ModerationModelVersion> {
  await hydrate();
  return cached;
}

/**
 * Synchronous read of the currently cached version. Callers that have
 * already awaited `getModerationModelVersion()` (or `preloadModels()`) at
 * some earlier point can safely use this from render paths.
 */
export function getModerationModelVersionSync(): ModerationModelVersion {
  return cached;
}

type Listener = (v: ModerationModelVersion) => void;
const listeners = new Set<Listener>();

export function subscribeModerationModelVersion(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export async function setModerationModelVersion(
  version: ModerationModelVersion,
): Promise<void> {
  if (!isValidVersion(version)) {
    throw new Error(`Invalid moderation model version: ${String(version)}`);
  }
  cached = version;
  hydrated = true;
  try {
    await AsyncStorage.setItem(MODERATION_MODEL_STORAGE_KEY, version);
  } catch {
    // Swallow — the in-memory value still reflects the change for this session.
  }
  for (const l of listeners) {
    try {
      l(version);
    } catch {
      // Ignore listener errors so one bad subscriber doesn't block the rest.
    }
  }
}

// Exported for tests only.
export function __resetModerationModelVersionForTests(): void {
  cached = DEFAULT_MODERATION_MODEL;
  hydrated = false;
  hydrating = null;
  listeners.clear();
}
