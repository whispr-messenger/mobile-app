import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import { getRandomBytes } from "expo-crypto";
import { TokenService } from "./TokenService";
import type { SignalKeyBundleDto } from "../types/auth";

// tweetnacl looks for self.crypto which doesn't exist in Hermes — wire it up explicitly
nacl.setPRNG((x: Uint8Array, n: number) => {
  const bytes = getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = bytes[i];
});

const SIGNED_PREKEY_ID = 1;
const NUM_ONE_TIME_PREKEYS = 100;

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

    // One-time pre-keys
    const preKeys = Array.from({ length: NUM_ONE_TIME_PREKEYS }, (_, i) => {
      const kp = nacl.box.keyPair();
      return {
        keyId: i + 1,
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
        keyId: SIGNED_PREKEY_ID,
        publicKey: toBase64(signedPreKeyPair.publicKey),
        signature: toBase64(signature),
      },
      preKeys,
    };
  },
};
