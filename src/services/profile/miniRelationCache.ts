/**
 * Cache LRU memoire pour les relations user (self / blocked / contact / unknown)
 * resolues lors de l'ouverture de la mini-card.
 * - taille max 50 entries
 * - TTL 60s : au-dela on recompute pour ne pas garder une relation stale apres
 *   un block / unblock recent.
 *
 * Le cache est invalide explicitement par les actions block/unblock pour
 * ne pas afficher l'ancienne valeur a l'utilisateur.
 */
export type Relation = "self" | "blocked" | "contact" | "unknown";

interface CacheEntry {
  relation: Relation;
  fetchedAt: number;
}

const MAX_ENTRIES = 50;
const TTL_MS = 60 * 1000;

const store = new Map<string, CacheEntry>();

export function getCachedRelation(userId: string): Relation | null {
  const entry = store.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    store.delete(userId);
    return null;
  }
  // refresh LRU position
  store.delete(userId);
  store.set(userId, entry);
  return entry.relation;
}

export function setCachedRelation(userId: string, relation: Relation): void {
  if (store.has(userId)) {
    store.delete(userId);
  }
  store.set(userId, { relation, fetchedAt: Date.now() });
  while (store.size > MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

export function invalidateCachedRelation(userId: string): void {
  store.delete(userId);
}

export function clearRelationCache(): void {
  store.clear();
}

// helper test-only
export function _internalRelationSize(): number {
  return store.size;
}
