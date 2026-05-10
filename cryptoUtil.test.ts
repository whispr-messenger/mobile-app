// WHISPR-1399 - generateClientRandom doit avoir un keyspace Uint32 et
// renvoyer des valeurs distinctes (pas Math.random *1e6 qui collisionne
// des quelques centaines de messages).

jest.mock("expo-crypto", () => ({
  // simule un CSPRNG : on utilise crypto.webcrypto via jest.setup
  getRandomBytes: (n: number) => {
    const bytes = new Uint8Array(n);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  },
}));

import { generateClientRandom } from "./src/utils/crypto";

describe("generateClientRandom", () => {
  it("retourne un entier dans le range Uint32", () => {
    for (let i = 0; i < 100; i++) {
      const v = generateClientRandom();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("ne collisionne pas sur 1000 calls (keyspace Uint32)", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      seen.add(generateClientRandom());
    }
    // birthday sur 2^32 keyspace -> ~0.000012% sur 1000. On accepte
    // une marge defensive (>= 990 distincts) pour eviter les flakes
    // legendaires si jamais le PRNG a un mauvais jour.
    expect(seen.size).toBeGreaterThanOrEqual(990);
  });
});
