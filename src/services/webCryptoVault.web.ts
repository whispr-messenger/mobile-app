// Browser-bound key vault for sensitive blobs persisted in localStorage.
//
// Threat model: a single XSS that reads localStorage must NOT be able to
// exfiltrate the raw bytes of the Signal identity private key. We wrap the
// plaintext with an AES-GCM CryptoKey that lives only in IndexedDB and is
// flagged non-extractable, so JS code can decrypt in-place but cannot
// serialize the key material. Passive exfiltration (one-shot dump of
// localStorage) becomes useless; live exploitation is still possible while
// the page is compromised, which is acceptable for this stage.

const DB_NAME = "whispr-secure-vault";
const STORE_NAME = "keys";
const KEY_ID = "wrap-key-v1";
const FORMAT_PREFIX = "wrapped:v1:";
const IV_LEN = 12;

let cachedKeyPromise: Promise<CryptoKey> | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function loadKey(db: IDBDatabase): Promise<CryptoKey | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY_ID);
    req.onsuccess = () =>
      resolve((req.result as CryptoKey | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

function storeKey(db: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(key, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getOrCreateKey(): Promise<CryptoKey> {
  if (cachedKeyPromise) return cachedKeyPromise;
  const promise = (async () => {
    const db = await openDb();
    try {
      const existing = await loadKey(db);
      if (existing) return existing;
      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
      await storeKey(db, key);
      return key;
    } finally {
      db.close();
    }
  })();
  // Reset on failure so a transient error (private mode, IDB quota) can be
  // retried on the next call instead of poisoning the cache forever.
  promise.catch(() => {
    if (cachedKeyPromise === promise) cachedKeyPromise = null;
  });
  cachedKeyPromise = promise;
  return promise;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export const WEB_VAULT_PREFIX = FORMAT_PREFIX;

export function isWrapped(value: string): boolean {
  return value.startsWith(FORMAT_PREFIX);
}

export async function wrap(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const blob = new Uint8Array(IV_LEN + ct.length);
  blob.set(iv, 0);
  blob.set(ct, IV_LEN);
  return FORMAT_PREFIX + bytesToBase64(blob);
}

export async function unwrap(value: string): Promise<string> {
  if (!isWrapped(value)) {
    throw new Error("webCryptoVault: value is not wrapped");
  }
  const blob = base64ToBytes(value.slice(FORMAT_PREFIX.length));
  // slice() (vs subarray) yields a fresh ArrayBuffer-backed copy, which
  // SubtleCrypto's BufferSource accepts under TS's strict DOM lib types.
  const iv = blob.slice(0, IV_LEN);
  const ct = blob.slice(IV_LEN);
  const key = await getOrCreateKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export function __resetForTests(): void {
  cachedKeyPromise = null;
}
