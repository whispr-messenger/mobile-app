/**
 * @jest-environment jsdom
 */

import { storage } from "./src/services/storage.web";
import {
  WEB_VAULT_PREFIX,
  __resetForTests,
  unwrap,
} from "./src/services/webCryptoVault.web";

const IDENTITY_KEY = "whispr.signal.identityKeyPrivate";

describe("storage.web (secure key handling)", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetForTests();
    indexedDB.deleteDatabase("whispr-secure-vault");
  });

  it("never lands the identity key as plaintext in localStorage", async () => {
    const secret = "super-secret-curve25519-base64";
    await storage.setItem(IDENTITY_KEY, secret);

    const stored = localStorage.getItem(IDENTITY_KEY);
    expect(stored).not.toBeNull();
    expect(stored).not.toContain(secret);
    expect(stored!.startsWith(WEB_VAULT_PREFIX)).toBe(true);
  });

  it("returns the original plaintext on getItem", async () => {
    const secret = "another-secret";
    await storage.setItem(IDENTITY_KEY, secret);
    expect(await storage.getItem(IDENTITY_KEY)).toBe(secret);
  });

  it("migrates legacy plaintext to wrapped on first read", async () => {
    const legacy = "legacy-plaintext-key";
    localStorage.setItem(IDENTITY_KEY, legacy);

    const read = await storage.getItem(IDENTITY_KEY);
    expect(read).toBe(legacy);

    const persisted = localStorage.getItem(IDENTITY_KEY);
    expect(persisted).not.toBe(legacy);
    expect(persisted!.startsWith(WEB_VAULT_PREFIX)).toBe(true);
    expect(await unwrap(persisted!)).toBe(legacy);
  });

  it("drops the stored value when the wrap key is lost", async () => {
    await storage.setItem(IDENTITY_KEY, "doomed-value");
    expect(localStorage.getItem(IDENTITY_KEY)).not.toBeNull();

    // Simulate a different browser / cleared IDB by wiping the wrap-key DB
    // while leaving the wrapped blob in localStorage.
    __resetForTests();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("whispr-secure-vault");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });

    expect(await storage.getItem(IDENTITY_KEY)).toBeNull();
    expect(localStorage.getItem(IDENTITY_KEY)).toBeNull();
  });

  it("leaves non-secure keys untouched (no wrapping for tokens)", async () => {
    const accessToken = "header.payload.signature";
    await storage.setItem("whispr.auth.accessToken", accessToken);
    expect(localStorage.getItem("whispr.auth.accessToken")).toBe(accessToken);
    expect(await storage.getItem("whispr.auth.accessToken")).toBe(accessToken);
  });

  it("deleteItem removes the stored value", async () => {
    await storage.setItem(IDENTITY_KEY, "to-delete");
    await storage.deleteItem(IDENTITY_KEY);
    expect(localStorage.getItem(IDENTITY_KEY)).toBeNull();
  });
});
