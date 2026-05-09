import { getRandomBytes } from "expo-crypto";

/**
 * client_random crypto-safe pour la dedup serveur (cf. WHISPR-1399).
 * Math.random() = ~20 bits utilisables -> birthday collision a partir de
 * quelques centaines de messages. On utilise expo-crypto (CSPRNG natif sur
 * iOS/Android, crypto.getRandomValues sur web) puis on decode 4 octets en
 * Uint32, ce qui passe le keyspace a 2^32 (~4.3 milliards).
 *
 * Le serveur accepte number | string (cf. messaging api.ts), Uint32 fits
 * largement dans Number.MAX_SAFE_INTEGER (2^53).
 */
export function generateClientRandom(): number {
  const bytes = getRandomBytes(4);
  return (
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
  );
}
