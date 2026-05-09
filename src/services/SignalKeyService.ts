import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import { getRandomBytes } from "expo-crypto";
import { TokenService } from "./TokenService";
import { generateClientRandom } from "../utils/crypto";
import type { SignalKeyBundleDto } from "../types/auth";

// tweetnacl looks for self.crypto which doesn't exist in Hermes — wire it up explicitly
nacl.setPRNG((x: Uint8Array, n: number) => {
  const bytes = getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = bytes[i];
});

const NUM_ONE_TIME_PREKEYS = 100;

// Generate keyIds that fit in 32-bit signed INT (< 2^31 ≈ 2.14e9).
// Random 30-bit base avoids same-second collisions when the user
// reconnects multiple times, and leaves ~100 slots below 2^31 for the
// one-time prekeys numbered `base + i` (i < 100).
// CSPRNG pour coherence avec NaCl deja en place (cf. nacl.setPRNG ci-dessus).
function generateSignedPrekeyId(): number {
  return generateClientRandom() & 0x3fffffff;
}

function generatePrekeyIdBase(signedPrekeyId: number): number {
  // Pick a different random base for one-time prekeys so they never
  // overlap the signed prekey id even if both are generated in the same
  // second. The +/- spread within 2^30 keeps everything in INT32 range.
  let base = generateClientRandom() & 0x3fffffff;
  if (Math.abs(base - signedPrekeyId) < 200) {
    // In the unlikely collision, shift far enough away from signedPrekeyId.
    base = (signedPrekeyId + 0x20000000) & 0x3fffffff;
  }
  return base;
}

function toBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

export const SignalKeyService = {
  async generateKeyBundle(): Promise<SignalKeyBundleDto> {
    // Identity key pair (Curve25519)
    const identityKeyPair = nacl.box.keyPair();

    // Signed pre-key pair (Curve25519)
    const signedPreKeyPair = nacl.box.keyPair();

    // Sign the signed pre-key public key with the identity key (Ed25519)
    // We use the identity key secret to derive a signing key via nacl.sign.keyPair.fromSeed
    // The identity key secret is 32 bytes — valid seed for Ed25519
    const signingKeyPair = nacl.sign.keyPair.fromSeed(
      identityKeyPair.secretKey.slice(0, 32),
    );
    const signature = nacl.sign.detached(
      signedPreKeyPair.publicKey,
      signingKeyPair.secretKey,
    );

    // Use timestamp-based ids to avoid collisions with previously
    // uploaded keys on the same device (backend has a unique
    // (deviceId, keyId) constraint).
    const signedPrekeyId = generateSignedPrekeyId();
    const prekeyBase = generatePrekeyIdBase(signedPrekeyId);

    // One-time pre-keys
    const preKeys = Array.from({ length: NUM_ONE_TIME_PREKEYS }, (_, i) => {
      const kp = nacl.box.keyPair();
      return {
        keyId: prekeyBase + i,
        publicKey: toBase64(kp.publicKey),
      };
    });

    // Persist identity private key securely for future sessions
    await TokenService.saveIdentityPrivateKey(
      toBase64(identityKeyPair.secretKey),
    );

    return {
      identityKey: toBase64(identityKeyPair.publicKey),
      signedPreKey: {
        keyId: signedPrekeyId,
        publicKey: toBase64(signedPreKeyPair.publicKey),
        signature: toBase64(signature),
      },
      preKeys,
    };
  },
};
