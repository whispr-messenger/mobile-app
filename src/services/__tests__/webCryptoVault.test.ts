/**
 * @jest-environment jsdom
 */

import {
  WEB_VAULT_PREFIX,
  __resetForTests,
  isWrapped,
  unwrap,
  wrap,
} from "../webCryptoVault.web";

describe("webCryptoVault", () => {
  beforeEach(() => {
    __resetForTests();
    // fake-indexeddb persists across describes — wipe between tests so each
    // case exercises the full open/upgrade/get path on a fresh DB.
    indexedDB.deleteDatabase("whispr-secure-vault");
  });

  it("round-trips an identity-key-shaped string", async () => {
    const plaintext = "ZmFrZS1pZGVudGl0eS1rZXktYmFzZTY0LXBheWxvYWQ="; // 44-char base64
    const wrapped = await wrap(plaintext);
    expect(wrapped.startsWith(WEB_VAULT_PREFIX)).toBe(true);
    expect(wrapped).not.toContain(plaintext);
    expect(await unwrap(wrapped)).toBe(plaintext);
  });

  it("uses a fresh IV every wrap (two wraps of the same plaintext differ)", async () => {
    const plaintext = "same-input";
    const a = await wrap(plaintext);
    const b = await wrap(plaintext);
    expect(a).not.toBe(b);
    expect(await unwrap(a)).toBe(plaintext);
    expect(await unwrap(b)).toBe(plaintext);
  });

  it("isWrapped only matches the v1 prefix", () => {
    expect(isWrapped(`${WEB_VAULT_PREFIX}abc`)).toBe(true);
    expect(isWrapped("plain-base64-string")).toBe(false);
    expect(isWrapped("wrapped:v0:legacy")).toBe(false);
  });

  it("unwrap rejects values that are not wrapped", async () => {
    await expect(unwrap("not-a-wrapped-blob")).rejects.toThrow(/not wrapped/);
  });

  // Cross-reload persistence (key survives a page refresh) relies on the
  // browser's structured-clone honouring CryptoKey identity through IDB,
  // which fake-indexeddb does not emulate. Validate manually in DevTools.
});
