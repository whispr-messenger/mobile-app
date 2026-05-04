/**
 * useResolvedMediaUrl — resolve a media-service `/media/v1/:id/blob` or
 * `/thumbnail` URL to something a native image/video/audio element can
 * actually consume.
 *
 * The `/blob` and `/thumbnail` endpoints return `{ url, expiresAt }` JSON
 * rather than the raw bytes, so passing the bare URL to `<Image>`, `<Video>`,
 * or `Audio.Sound.createAsync` results in a JSON decode failure.
 *
 * WHISPR-1216 — the JSON `url` field is a presigned MinIO URL carrying
 * `X-Amz-Signature`. Rendering it directly via `<Image src={url}>` would
 * leak the signed URL to the rendering layer (DevTools Network panel,
 * right-click "copy image address", screenshots of HAR exports, Sentry
 * breadcrumbs, …) and let anyone who captures it download the blob without
 * authentication for the rest of the presign window. We always proxy the
 * bytes through the authenticated `?stream=1` endpoint instead.
 */

import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { TokenService } from "../services/TokenService";
import * as FileSystem from "expo-file-system/legacy";

type NativeCacheEntry = { resolvedUri: string; storedAt: number };

const NATIVE_MEDIA_CACHE = new Map<string, NativeCacheEntry>();
const NATIVE_MEDIA_CACHE_TTL_MS = 5 * 60 * 1000;
const NATIVE_MEDIA_CACHE_MAX_ENTRIES = 80;

const DISK_MEDIA_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DISK_MEDIA_CACHE_ROOT =
  (FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "") +
  "whispr-media-cache";
let DISK_MEDIA_CACHE_SCOPE = "anon";

function sanitizeScope(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "anon";
  return cleaned.replace(/[^a-z0-9._-]/gi, "_").slice(0, 64) || "anon";
}

export function setResolvedMediaCacheScope(scope: string | null | undefined) {
  DISK_MEDIA_CACHE_SCOPE = sanitizeScope(scope ?? "anon");
}

export async function clearResolvedMediaCache(
  scope: string | null | undefined = undefined,
): Promise<void> {
  const effectiveScope =
    scope === undefined
      ? DISK_MEDIA_CACHE_SCOPE
      : sanitizeScope(scope ?? "anon");
  const dir = `${DISK_MEDIA_CACHE_ROOT}/${effectiveScope}`;
  await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => {});
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function ensureStreamUrl(uri: string): string {
  if (!uri.includes("/media/v1/")) return uri;
  if (!uri.includes("/blob") && !uri.includes("/thumbnail")) return uri;
  if (/([?&])stream=1(&|$)/.test(uri)) return uri;
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}stream=1`;
}

function mimeToExtension(mime: string | null | undefined): string {
  const t = (mime ?? "").split(";")[0].trim().toLowerCase();
  if (t === "image/gif") return "gif";
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  if (t === "image/heic" || t === "image/heif") return "heic";
  if (t === "image/jpeg" || t === "image/jpg") return "jpg";
  if (t === "video/quicktime") return "mov";
  if (t === "video/mp4") return "mp4";
  if (t === "video/webm") return "webm";
  if (t === "video/x-matroska") return "mkv";
  if (t === "audio/mpeg") return "mp3";
  if (t === "audio/ogg") return "ogg";
  if (t === "audio/wav") return "wav";
  if (t === "audio/mp4") return "m4a";
  if (t === "audio/aac") return "aac";
  if (t === "audio/x-caf") return "caf";
  if (t === "audio/x-m4a") return "m4a";
  return "bin";
}

type DiskCacheMeta = { fileUri: string; storedAt: number };

async function readDiskCache(uri: string): Promise<string | null> {
  const scopeDir = `${DISK_MEDIA_CACHE_ROOT}/${DISK_MEDIA_CACHE_SCOPE}`;
  const key = fnv1aHex(uri);
  const metaPath = `${scopeDir}/${key}.json`;
  try {
    const info = await FileSystem.getInfoAsync(metaPath);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(metaPath);
    const meta = JSON.parse(raw) as DiskCacheMeta;
    if (!meta?.fileUri || typeof meta.storedAt !== "number") return null;
    if (Date.now() - meta.storedAt > DISK_MEDIA_CACHE_TTL_MS) {
      await FileSystem.deleteAsync(meta.fileUri, { idempotent: true }).catch(
        () => {},
      );
      await FileSystem.deleteAsync(metaPath, { idempotent: true }).catch(
        () => {},
      );
      return null;
    }
    // If the cached file has a .bin extension, delete it and re-download
    if (meta.fileUri.endsWith(".bin")) {
      await FileSystem.deleteAsync(meta.fileUri, { idempotent: true }).catch(
        () => {},
      );
      await FileSystem.deleteAsync(metaPath, { idempotent: true }).catch(
        () => {},
      );
      return null;
    }
    const fileInfo = await FileSystem.getInfoAsync(meta.fileUri);
    if (!fileInfo.exists) return null;
    return meta.fileUri;
  } catch {
    return null;
  }
}

async function writeDiskCache(
  uri: string,
  token: string | null,
): Promise<string> {
  const scopeDir = `${DISK_MEDIA_CACHE_ROOT}/${DISK_MEDIA_CACHE_SCOPE}`;
  await FileSystem.makeDirectoryAsync(scopeDir, { intermediates: true }).catch(
    () => {},
  );

  const key = fnv1aHex(uri);
  const metaPath = `${scopeDir}/${key}.json`;
  const cached = await readDiskCache(uri);
  if (cached) return cached;

  const tmpPath = `${scopeDir}/${key}.tmp`;
  await FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {});

  const headers: Record<string, string> = {
    Accept: "application/octet-stream",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await FileSystem.downloadAsync(ensureStreamUrl(uri), tmpPath, {
    headers,
  });
  const contentTypeHeader =
    (res.headers as any)?.["Content-Type"] ??
    (res.headers as any)?.["content-type"];
  const ext = mimeToExtension(
    typeof contentTypeHeader === "string" ? contentTypeHeader : undefined,
  );
  const finalPath = `${scopeDir}/${key}.${ext}`;
  await FileSystem.deleteAsync(finalPath, { idempotent: true }).catch(() => {});
  await FileSystem.moveAsync({ from: tmpPath, to: finalPath });
  const meta: DiskCacheMeta = { fileUri: finalPath, storedAt: Date.now() };
  await FileSystem.writeAsStringAsync(metaPath, JSON.stringify(meta)).catch(
    () => {},
  );
  return finalPath;
}

export async function prefetchResolvedMediaUris(
  uris: Array<string | undefined | null>,
): Promise<void> {
  if (Platform.OS === "web") return;
  const token = await TokenService.getAccessToken().catch(() => null);
  const unique = Array.from(
    new Set(
      uris
        .filter(
          (u): u is string => typeof u === "string" && u.trim().length > 0,
        )
        .map((u) => u.trim())
        .filter((u) => uriNeedsAuthResolution(u)),
    ),
  ).slice(0, 40);

  const concurrency = 2;
  let index = 0;
  const workers = Array.from({ length: concurrency }).map(async () => {
    while (index < unique.length) {
      const next = unique[index];
      index += 1;
      try {
        await writeDiskCache(next, token);
      } catch {
        // best-effort
      }
    }
  });
  await Promise.all(workers);
}

function readNativeCache(uri: string): string | null {
  const entry = NATIVE_MEDIA_CACHE.get(uri);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > NATIVE_MEDIA_CACHE_TTL_MS) {
    NATIVE_MEDIA_CACHE.delete(uri);
    return null;
  }
  return entry.resolvedUri;
}

function writeNativeCache(uri: string, resolvedUri: string): void {
  if (!resolvedUri || resolvedUri.startsWith("blob:")) return;
  NATIVE_MEDIA_CACHE.set(uri, { resolvedUri, storedAt: Date.now() });
  if (NATIVE_MEDIA_CACHE.size <= NATIVE_MEDIA_CACHE_MAX_ENTRIES) return;
  const entries = Array.from(NATIVE_MEDIA_CACHE.entries());
  entries.sort((a, b) => a[1].storedAt - b[1].storedAt);
  const toDrop = entries.slice(
    0,
    Math.max(0, entries.length - NATIVE_MEDIA_CACHE_MAX_ENTRIES),
  );
  for (const [key] of toDrop) NATIVE_MEDIA_CACHE.delete(key);
}

export function uriNeedsAuthResolution(uri: string | undefined): boolean {
  return (
    !!uri &&
    uri.includes("/media/v1/") &&
    (uri.includes("/blob") || uri.includes("/thumbnail"))
  );
}

/**
 * Fetch the media bytes through the authenticated `/blob?stream=1` proxy and
 * turn them into something `<Image>`/`<Video>`/`Audio.Sound` can render.
 * On web we use a short-lived `blob:` URL; on native we fall back to a
 * `data:` URL because `blob:` URIs don't round-trip cleanly through React
 * Native's media elements.
 */
export async function streamMediaToRenderableUri(
  uri: string,
  token: string | null,
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/octet-stream",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const separator = uri.includes("?") ? "&" : "?";
  const response = await fetch(`${uri}${separator}stream=1`, { headers });
  if (!response.ok) {
    throw new Error(`stream failed: HTTP ${response.status}`);
  }
  const blob = await response.blob();

  if (
    Platform.OS === "web" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  ) {
    return URL.createObjectURL(blob);
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("FileReader did not produce a data URL"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

// media-service applies several throttle tiers (short=30/1s, medium=20/2s,
// long=100/60s — WHISPR-1192). Opening a chat screen first-time used to
// fire two requests per image (probe /blob for the JSON envelope, then
// /blob?stream=1 for the bytes), and the medium=20/2s window collapsed at
// ~10 images. The probe is dead weight on /blob — the JSON `url` field is
// no longer consumed (WHISPR-1216) and only /thumbnail can legitimately
// answer `{ url: null }`. We now skip the probe on /blob and keep it on
// /thumbnail. Even with that halving the burst can still spike above the
// medium tier under heavier conversations, so cap concurrent slot users
// (probe + stream both share the pool) and retry transient 429/503/network
// failures with exponential backoff.
const MAX_CONCURRENT_STREAM_FETCHES = 4;

let activeStreamFetches = 0;
const streamFetchQueue: Array<() => void> = [];

function acquireStreamSlot(): Promise<void> {
  return new Promise<void>((resolve) => {
    const tryAcquire = () => {
      if (activeStreamFetches < MAX_CONCURRENT_STREAM_FETCHES) {
        activeStreamFetches += 1;
        resolve();
      } else {
        streamFetchQueue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

function releaseStreamSlot(): void {
  activeStreamFetches -= 1;
  const next = streamFetchQueue.shift();
  if (next) next();
}

const streamSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function isRetryableStreamError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // streamMediaToRenderableUri throws "stream failed: HTTP <status>" for
  // HTTP errors. Anything without an HTTP marker (network failure, abort,
  // FileReader error) is treated as retryable.
  const match = /HTTP (\d+)/.exec(msg);
  if (!match) return true;
  const status = Number(match[1]);
  return status === 429 || status === 503;
}

export async function streamMediaToRenderableUriThrottled(
  uri: string,
  token: string | null,
): Promise<string> {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await acquireStreamSlot();
    try {
      return await streamMediaToRenderableUri(uri, token);
    } catch (err) {
      if (!isRetryableStreamError(err) || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = Math.min(1000, 100 * 2 ** (attempt - 1));
      await streamSleep(delayMs);
    } finally {
      releaseStreamSlot();
    }
  }
  throw new Error("streamMediaToRenderableUri retry loop exhausted");
}

// Probe the metadata endpoint (`/blob` or `/thumbnail` without `?stream=1`)
// inside the same slot pool the stream phase uses, so a chat-screen burst
// cannot starve the medium throttle window with a probe-then-stream
// hammer. Retries 429/503 with the same exponential backoff as
// streamMediaToRenderableUriThrottled and surfaces every other status as a
// resolved Response (caller decides). Network errors propagate as throws.
export async function probeMediaUrlThrottled(
  uri: string,
  headers: Record<string, string>,
): Promise<Response> {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await acquireStreamSlot();
    let res: Response;
    try {
      res = await fetch(uri, { headers, redirect: "follow" });
    } finally {
      releaseStreamSlot();
    }
    if (res.ok) return res;
    if (res.status !== 429 && res.status !== 503) return res;
    if (attempt === maxAttempts) return res;
    const delayMs = Math.min(1000, 100 * 2 ** (attempt - 1));
    await streamSleep(delayMs);
  }
  // Loop above always returns; this is here to satisfy the type checker.
  throw new Error("probeMediaUrl retry loop exhausted");
}

export interface ResolvedMediaUrl {
  resolvedUri: string;
  loading: boolean;
  error: boolean;
}

export function useResolvedMediaUrl(uri: string | undefined): ResolvedMediaUrl {
  const [resolvedUri, setResolvedUri] = useState(
    uriNeedsAuthResolution(uri) ? "" : uri || "",
  );
  const [loading, setLoading] = useState(uriNeedsAuthResolution(uri));
  const [error, setError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const revokeBlobUrl = () => {
      const previous = blobUrlRef.current;
      if (
        previous &&
        typeof URL !== "undefined" &&
        typeof URL.revokeObjectURL === "function"
      ) {
        URL.revokeObjectURL(previous);
      }
      blobUrlRef.current = null;
    };

    if (!uri) {
      revokeBlobUrl();
      setResolvedUri("");
      setLoading(false);
      return;
    }

    if (!uriNeedsAuthResolution(uri)) {
      revokeBlobUrl();
      setResolvedUri(uri);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const canUseNativeCache = Platform.OS !== "web";
    if (canUseNativeCache) {
      const cached = readNativeCache(uri);
      if (cached) {
        setResolvedUri(cached);
        setLoading(false);
        setError(false);
        return () => {
          cancelled = true;
          revokeBlobUrl();
        };
      }

      (async () => {
        const diskCached = await readDiskCache(uri);
        if (!diskCached || cancelled) return;
        setResolvedUri(diskCached);
        setLoading(false);
        setError(false);
      })().catch(() => {});
    }

    setLoading(true);
    setError(false);

    (async () => {
      revokeBlobUrl();
      try {
        const token = await TokenService.getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        // /thumbnail can legitimately return `{ url: null }` when no
        // thumbnail is stored — we still need to probe it to detect that
        // case (otherwise we'd stream a 404 and surface it as an error).
        // /blob always has bytes, so we skip the probe entirely there
        // and go straight to stream — halves the per-image request count
        // against the throttle (medium=20/2s) and removes the silent 429
        // failure that landed straight in setError(true).
        const isThumbnail = uri.includes("/thumbnail");

        if (isThumbnail) {
          let blobExists = true;
          try {
            const probeRes = await probeMediaUrlThrottled(uri, headers);
            if (!cancelled && probeRes.ok) {
              const contentType = probeRes.headers.get("content-type") || "";
              if (contentType.includes("application/json")) {
                try {
                  const body = (await probeRes.json()) as {
                    url?: string | null;
                  };
                  if (body && "url" in body && body.url === null) {
                    blobExists = false;
                  }
                } catch {
                  // Unparseable JSON → assume the thumbnail exists; the
                  // stream call below will surface an explicit 404 if it
                  // really is gone.
                }
              }
            }
          } catch (err) {
            console.warn(
              `[useResolvedMediaUrl] Thumbnail probe failed, will try streaming anyway:`,
              err,
            );
          }

          if (!blobExists) {
            setResolvedUri("");
            return;
          }
        }

        // WHISPR-1216 — always proxy through the authenticated /blob?stream=1
        // endpoint. We never hand the presigned URL to the renderer.
        // Use the throttled variant so a chat-screen burst doesn't trip
        // the server-side 30 req/s short throttle.
        const renderableUri =
          Platform.OS === "web"
            ? await streamMediaToRenderableUriThrottled(uri, token)
            : await writeDiskCache(uri, token);
        if (cancelled) {
          if (
            renderableUri.startsWith("blob:") &&
            typeof URL !== "undefined" &&
            typeof URL.revokeObjectURL === "function"
          ) {
            URL.revokeObjectURL(renderableUri);
          }
          return;
        }
        if (renderableUri.startsWith("blob:")) {
          blobUrlRef.current = renderableUri;
        }
        if (Platform.OS !== "web") {
          writeNativeCache(uri, renderableUri);
        }
        setResolvedUri(renderableUri);
      } catch (err) {
        if (cancelled) return;
        console.warn("[useResolvedMediaUrl] Error resolving media URL:", err);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      revokeBlobUrl();
    };
  }, [uri]);

  return { resolvedUri, loading, error };
}
