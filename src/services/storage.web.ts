import { isWrapped, unwrap, wrap } from "./webCryptoVault.web";

// Cles dont les valeurs ne doivent jamais finir en clair dans localStorage.
// On y inclut la cle d'identite Signal (WHISPR-1212), les tokens d'auth
// (WHISPR-1328), la queue offline qui contient des messages en clair tant
// qu'ils n'ont pas pu etre envoyes (WHISPR-1359) et les flags security
// (WHISPR-1359) pour limiter l'exposition en cas de XSS sur le PWA web.
const SECURE_KEYS = new Set<string>([
  "whispr.signal.identityKeyPrivate",
  "whispr.auth.accessToken",
  "whispr.auth.refreshToken",
  "whispr.offline.message.queue",
  "@whispr_settings_security",
]);

function isSecure(key: string): boolean {
  return SECURE_KEYS.has(key);
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    const raw = localStorage.getItem(key);
    if (raw === null || !isSecure(key)) return raw;

    if (isWrapped(raw)) {
      try {
        return await unwrap(raw);
      } catch {
        // Wrap key lost (IDB cleared, different browser profile) → drop the
        // stored value so the user is forced through a fresh login that
        // regenerates the identity key.
        localStorage.removeItem(key);
        return null;
      }
    }

    // Legacy plaintext from a pre-vault build: surface it once and re-write
    // it wrapped so subsequent reads use the secure path.
    try {
      const wrapped = await wrap(raw);
      localStorage.setItem(key, wrapped);
    } catch {
      // Swallow — better to keep the user logged in than to refuse the read.
    }
    return raw;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isSecure(key)) {
      try {
        const wrapped = await wrap(value);
        localStorage.setItem(key, wrapped);
        return;
      } catch (error) {
        // IndexedDB / SubtleCrypto indisponible (Safari mode privé, vieux
        // navigateurs sans IDB, Firefox restrictif). Fail-closed sur les
        // cles sensibles (cle d'identite Signal, tokens auth, queue offline)
        // pour eviter qu'un XSS exfiltre des secrets via localStorage.
        // Le caller doit catch et proposer un parcours user-friendly
        // (logout / re-enrollment / "rouvrez hors mode privé").
        throw new Error(
          `[storage.web] crypto vault unavailable, refusing to persist sensitive key "${key}" in plaintext: ${
            (error as Error)?.message ?? error
          }`,
        );
      }
    }
    localStorage.setItem(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  },
};
