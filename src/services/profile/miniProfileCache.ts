/**
 * Cache LRU en memoire pour les profils utilisateurs charges via la mini-card.
 * - taille max 50 entries (eviction LRU)
 * - TTL implicite 5 min : au-dela, l'entry est consideree stale et le caller
 *   est libre de refetch en background tout en affichant la version cachee.
 */
import { UserProfile } from "../UserService";

interface CacheEntry {
  profile: UserProfile;
  fetchedAt: number;
}

const MAX_ENTRIES = 50;
const STALE_AFTER_MS = 5 * 60 * 1000;

const store = new Map<string, CacheEntry>();

export function getCached(userId: string): {
  profile: UserProfile;
  isStale: boolean;
} | null {
  const entry = store.get(userId);
  if (!entry) return null;
  // refresh LRU position (delete + reinsert)
  store.delete(userId);
  store.set(userId, entry);
  return {
    profile: entry.profile,
    isStale: Date.now() - entry.fetchedAt > STALE_AFTER_MS,
  };
}

export function setCached(userId: string, profile: UserProfile): void {
  if (store.has(userId)) {
    store.delete(userId);
  } else if (store.size >= MAX_ENTRIES) {
    // eviction du moins recemment utilise (premiere clef de l'iter)
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(userId, { profile, fetchedAt: Date.now() });
}

export function clearCache(): void {
  store.clear();
}

// helper test-only : on l'expose pour pouvoir verifier la taille / contenu
export function _internalSize(): number {
  return store.size;
}
