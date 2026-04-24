import type { TokenPair } from "../types/auth";

const base64urlEncode = (s: string): string =>
  Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const makeJwt = (payload: Record<string, unknown>): string => {
  const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64urlEncode(JSON.stringify(payload));
  return `${header}.${body}.signature`;
};

export const makeTokenPair = (
  overrides: Partial<TokenPair> = {},
): TokenPair => ({
  accessToken: makeJwt({
    sub: "user-1",
    deviceId: "dev-1",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
  refreshToken: makeJwt({
    sub: "user-1",
    deviceId: "dev-1",
    exp: Math.floor(Date.now() / 1000) + 86400,
  }),
  ...overrides,
});

export const makeExpiredJwt = (): string =>
  makeJwt({
    sub: "user-1",
    deviceId: "dev-1",
    exp: Math.floor(Date.now() / 1000) - 3600,
  });

export const makeDeviceInfo = () => ({
  deviceId: "dev-1",
  deviceName: "Test Device",
  deviceType: "ios",
  model: "iPhone 15",
  osVersion: "17.0",
  appVersion: "1.0.0",
});

export const makeSignalKeyBundle = () => ({
  identityKey: "aGVsbG8=",
  signedPrekey: {
    id: 1,
    publicKey: "cGs=",
    signature: "c2ln",
  },
  oneTimePrekeys: [{ id: 100, publicKey: "b3Rr" }],
});
