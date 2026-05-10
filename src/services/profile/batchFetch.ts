/**
 * Helper bas-niveau pour appeler POST /user/v1/profiles/batch (WHISPR-1349,
 * exploite par WHISPR-1357 cote mobile). Sert a remplacer le burst de N
 * fetchs unitaires /user/v1/profile/{id} par un appel groupe au load de
 * ConversationsList et ContactsScreen.
 *
 * - dedup local des ids avant l'appel (le backend dedup aussi mais autant
 *   eviter de charger inutilement le payload)
 * - split en chunks de 100 (limite serveur ArrayMaxSize) traites en
 *   parallele : le throttler tolere 10 batch/s sur la fenetre courte
 * - sur 401, le refresh est fait par AuthService au niveau caller via
 *   `authenticatedFetch` deja utilise dans messaging/api.ts ; ici on
 *   recoit le fetcher en parametre pour rester decouple
 * - sur erreur batch (400/500/network) : fallback per-id via GET /profile/{id}
 *   avec concurrence limitee a 5 pour eviter de saturer le throttler
 *   (WHISPR-1435 - evite que 1 chunk fail = tous les profils perdus)
 */
import { getApiBaseUrl } from "../apiBase";

const BATCH_MAX_SIZE = 100;
// concurrence max pour le fallback per-id quand le batch echoue
const PER_ID_CONCURRENCY = 5;

export interface BatchProfilesResponse<T> {
  /** Profils trouves et autorises (privacy gates serveur appliquees). */
  profiles: T[];
  /** IDs demandes non resolus (user inexistant, supprime, prive). */
  missing: string[];
}

export type AuthenticatedFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Fallback : quand le batch endpoint retourne une erreur (400 validation,
 * 500 infra, timeout), on retente chaque id individuellement via
 * GET /user/v1/profile/{id}. Concurrence limitee a PER_ID_CONCURRENCY
 * pour ne pas saturer le throttler.
 */
async function fetchProfilesPerIdFallback<T>(
  ids: string[],
  fetcher: AuthenticatedFetch,
): Promise<BatchProfilesResponse<T>> {
  const baseUrl = `${getApiBaseUrl()}/user/v1`;
  const profiles: T[] = [];
  const missing: string[] = [];

  // traitement en pool de PER_ID_CONCURRENCY requetes paralleles
  const queue = [...ids];
  const workers = Array.from({ length: PER_ID_CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      try {
        const response = await fetcher(
          `${baseUrl}/profile/${encodeURIComponent(id)}`,
        );
        if (!response.ok) {
          missing.push(id);
          continue;
        }
        const raw = (await response.json().catch(() => null)) as T | null;
        if (raw) {
          profiles.push(raw);
        } else {
          missing.push(id);
        }
      } catch {
        missing.push(id);
      }
    }
  });

  await Promise.all(workers);
  return { profiles, missing };
}

/**
 * Appelle POST /user/v1/profiles/batch et split en chunks de 100 si besoin.
 * En cas d'erreur batch sur un chunk, fallback automatique per-id.
 *
 * @param ids liste des userIds a recuperer
 * @param fetcher fetch authentifie (gere refresh 401, headers Bearer)
 * @returns `{ profiles, missing }` agreges sur tous les chunks
 *
 * - retourne `{ profiles: [], missing: [] }` si `ids` est vide pour eviter
 *   le 400 "ArrayMinSize" du backend
 * - sur erreur HTTP batch : fallback per-id (recupere les profils valides,
 *   ne perd que les vrais inexistants ou en erreur individuelle)
 */
export async function fetchProfilesBatch<T = unknown>(
  ids: string[],
  fetcher: AuthenticatedFetch,
): Promise<BatchProfilesResponse<T>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) {
    return { profiles: [], missing: [] };
  }

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_MAX_SIZE) {
    chunks.push(unique.slice(i, i + BATCH_MAX_SIZE));
  }

  const url = `${getApiBaseUrl()}/user/v1/profiles/batch`;
  const results = await Promise.all(
    chunks.map(async (chunkIds): Promise<BatchProfilesResponse<T>> => {
      try {
        const response = await fetcher(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: chunkIds }),
        });
        if (!response.ok) {
          // batch indisponible (400 validation, 500, etc.) : fallback per-id
          return fetchProfilesPerIdFallback<T>(chunkIds, fetcher);
        }
        const data = (await response
          .json()
          .catch(() => null)) as BatchProfilesResponse<T> | null;
        if (!data) {
          return fetchProfilesPerIdFallback<T>(chunkIds, fetcher);
        }
        // le batch a reussi mais certains ids sont dans missing : on ne
        // retente pas per-id pour les missing (ils sont vraiment inexistants
        // ou prives selon le backend)
        return {
          profiles: Array.isArray(data.profiles) ? data.profiles : [],
          missing: Array.isArray(data.missing) ? data.missing : [],
        };
      } catch {
        // erreur reseau ou parse : fallback per-id
        return fetchProfilesPerIdFallback<T>(chunkIds, fetcher);
      }
    }),
  );

  const aggregated: BatchProfilesResponse<T> = { profiles: [], missing: [] };
  for (const r of results) {
    aggregated.profiles.push(...r.profiles);
    aggregated.missing.push(...r.missing);
  }
  return aggregated;
}

export const BATCH_PROFILES_CHUNK_SIZE = BATCH_MAX_SIZE;
