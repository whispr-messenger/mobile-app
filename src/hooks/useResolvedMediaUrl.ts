/**
 * useResolvedMediaUrl — resolve a media-service `/media/v1/:id/blob` or
 * `/thumbnail` URL to something a native image/video/audio element can
 * actually consume.
 *
 * The `/blob` and `/thumbnail` endpoints return `{ url, expiresAt }` JSON
 * rather than the raw bytes, so passing the bare URL to `<Image>`, `<Video>`,
 * or `Audio.Sound.createAsync` results in a JSON decode failure. This hook
 * fetches the endpoint with a Bearer token, extracts the presigned URL, and
 * falls back to streaming the bytes through `?stream=1` when the presigned
 * host is cluster-internal.
 */

import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { TokenService } from "../services/TokenService";
import { isReachableUrl } from "../utils";

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

        // New contract (media-service deploy/preprod ≥ cedf7f9b):
        // `/blob` and `/thumbnail` return `{ url, expiresAt }` JSON, not a
        // 302 redirect. Parse JSON first; fall back to response.url for
        // the legacy 302 redirect contract.
        let presigned: string | null = null;
        let urlExplicitlyNull = false;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          try {
            const body = (await response.json()) as {
              url?: string | null;
            };
            if (body && "url" in body && body.url === null) {
              urlExplicitlyNull = true;
            }
            presigned = body?.url ?? null;
          } catch {
            presigned = null;
          }
        } else if (response.url && response.url !== uri) {
          // Legacy: fetch followed a 302 — response.url is the presigned URL
          presigned = response.url;
        }

        // `/thumbnail` retourne `{ url: null }` quand aucune vignette
        // n'est stockée — c'est légitime, pas une erreur.
        if (urlExplicitlyNull) {
          setResolvedUri("");
          return;
        }

        if (isReachableUrl(presigned)) {
          setResolvedUri(presigned as string);
          return;
        }

        if (presigned) {
          console.warn(
            "[useResolvedMediaUrl] Presigned URL unreachable — streaming via API proxy:",
            presigned,
          );
        }
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
