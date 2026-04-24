/* eslint-disable @typescript-eslint/no-explicit-any */

const mockSaveIdentityPrivateKey = jest.fn();

jest.mock("./src/services/TokenService", () => ({
  TokenService: {
    saveIdentityPrivateKey: (...args: any[]) =>
      mockSaveIdentityPrivateKey(...args),
  },
}));

jest.mock("expo-crypto", () => ({
  getRandomBytes: jest.fn((n: number) => new Uint8Array(n)),
}));

jest.mock("tweetnacl", () => {
  const mkKeyPair = () => ({
    publicKey: new Uint8Array(32).fill(0xaa),
    secretKey: new Uint8Array(64).fill(0xbb),
  });
  return {
    __esModule: true,
    default: {
      setPRNG: jest.fn(),
      box: {
        keyPair: jest.fn(mkKeyPair),
      },
      sign: {
        keyPair: {
          fromSeed: jest.fn(() => ({
            publicKey: new Uint8Array(32).fill(0xcc),
            secretKey: new Uint8Array(64).fill(0xdd),
          })),
        },
        detached: jest.fn(() => new Uint8Array(64).fill(0xee)),
      },
    },
  };
});

jest.mock("tweetnacl-util", () => ({
  encodeBase64: jest.fn((bytes: Uint8Array) => `b64(${bytes.length})`),
}));

import { SignalKeyService } from "./src/services/SignalKeyService";
import nacl from "tweetnacl";

const mockedNacl = nacl as unknown as {
  setPRNG: jest.Mock;
  box: { keyPair: jest.Mock };
  sign: {
    keyPair: { fromSeed: jest.Mock };
    detached: jest.Mock;
  };
};

beforeEach(() => {
  mockSaveIdentityPrivateKey.mockReset().mockResolvedValue(undefined);
  mockedNacl.box.keyPair.mockClear();
  mockedNacl.sign.keyPair.fromSeed.mockClear();
  mockedNacl.sign.detached.mockClear();
});

describe("SignalKeyService.generateKeyBundle", () => {
  it("returns a bundle with identityKey, signedPreKey and 100 preKeys", async () => {
    const bundle = await SignalKeyService.generateKeyBundle();

    expect(bundle).toMatchObject({
      identityKey: expect.any(String),
      signedPreKey: {
        keyId: expect.any(Number),
        publicKey: expect.any(String),
        signature: expect.any(String),
      },
    });
    expect(bundle.preKeys).toHaveLength(100);
  });

  it("generates sequential keyIds starting from a common base", async () => {
    const bundle = await SignalKeyService.generateKeyBundle();
    const ids = bundle.preKeys.map((pk) => pk.keyId);
    const base = ids[0];

    for (let i = 0; i < ids.length; i++) {
      expect(ids[i]).toBe(base + i);
    }
  });

  it("keeps every keyId within signed int32 range", async () => {
    const bundle = await SignalKeyService.generateKeyBundle();

    expect(bundle.signedPreKey.keyId).toBeGreaterThanOrEqual(0);
    expect(bundle.signedPreKey.keyId).toBeLessThan(0x80000000);
    for (const pk of bundle.preKeys) {
      expect(pk.keyId).toBeGreaterThanOrEqual(0);
      expect(pk.keyId).toBeLessThan(0x80000000);
    }
  });

  it("persists the identity private key via TokenService", async () => {
    await SignalKeyService.generateKeyBundle();

    expect(mockSaveIdentityPrivateKey).toHaveBeenCalledTimes(1);
    expect(mockSaveIdentityPrivateKey).toHaveBeenCalledWith(
      expect.stringContaining("b64("),
    );
  });

  it("signs the signed pre-key public key with the derived Ed25519 key", async () => {
    await SignalKeyService.generateKeyBundle();

    expect(mockedNacl.sign.keyPair.fromSeed).toHaveBeenCalledTimes(1);
    expect(mockedNacl.sign.detached).toHaveBeenCalledTimes(1);
    // Called with (signedPreKey.publicKey, signingSecretKey)
    const [pubKeyArg, secretKeyArg] = mockedNacl.sign.detached.mock.calls[0];
    expect(pubKeyArg).toBeInstanceOf(Uint8Array);
    expect(secretKeyArg).toBeInstanceOf(Uint8Array);
  });

  it("generates a fresh identity keypair and a separate signed pre-key keypair", async () => {
    await SignalKeyService.generateKeyBundle();

    // 1 identity + 1 signed-prekey + 100 one-time prekeys
    expect(mockedNacl.box.keyPair).toHaveBeenCalledTimes(102);
  });
});
