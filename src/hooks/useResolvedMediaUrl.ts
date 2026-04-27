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
    setResolvedUri("");
    setLoading(true);
    setError(false);

    (async () => {
      revokeBlobUrl();
      try {
        const token = await TokenService.getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        // Probe the endpoint first. We don't use the returned presigned
        // URL (see WHISPR-1216) but the JSON response tells us whether
        // the blob exists at all — `/thumbnail` legitimately returns
        // `{ url: null }` when no thumbnail is stored.
        const response = await fetch(uri, {
          headers,
          redirect: "follow",
        });

        if (cancelled) return;

        if (!response.ok) {
          console.warn(
            `[useResolvedMediaUrl] Failed to resolve media URL: HTTP ${response.status}`,
          );
          setError(true);
          return;
        }

        let blobExists = true;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          try {
            const body = (await response.json()) as { url?: string | null };
            if (body && "url" in body && body.url === null) {
              blobExists = false;
            }
          } catch {
            // Unparseable JSON → assume the blob exists; the proxy will
            // give us an explicit status if it really is gone.
          }
        }
        // Legacy 302 path: response.url would be the presigned URL. We
        // intentionally don't read it — proceed to stream below.

        if (!blobExists) {
          setResolvedUri("");
          return;
        }

        // WHISPR-1216 — always proxy through the authenticated /blob?stream=1
        // endpoint. We never hand the presigned URL to the renderer.
        const renderableUri = await streamMediaToRenderableUri(uri, token);
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
