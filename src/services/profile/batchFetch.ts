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
 */
import { getApiBaseUrl } from "../apiBase";

const BATCH_MAX_SIZE = 100;

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
 * Appelle POST /user/v1/profiles/batch et split en chunks de 100 si besoin.
 *
 * @param ids liste des userIds a recuperer
 * @param fetcher fetch authentifie (gere refresh 401, headers Bearer)
 * @returns `{ profiles, missing }` agreges sur tous les chunks
 *
 * - retourne `{ profiles: [], missing: [] }` si `ids` est vide pour eviter
 *   le 400 "ArrayMinSize" du backend
 * - sur erreur HTTP non-OK : tous les ids du chunk basculent dans `missing`
 *   pour permettre au caller de fallback (display "Utilisateur indisponible")
 *   plutot que de planter le rendering
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
          return { profiles: [], missing: [...chunkIds] };
        }
        const data = (await response
          .json()
          .catch(() => null)) as BatchProfilesResponse<T> | null;
        if (!data) {
          return { profiles: [], missing: [...chunkIds] };
        }
        return {
          profiles: Array.isArray(data.profiles) ? data.profiles : [],
          missing: Array.isArray(data.missing) ? data.missing : [],
        };
      } catch {
        return { profiles: [], missing: [...chunkIds] };
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
