import { AuthService } from "./AuthService";
import { TokenService } from "./TokenService";
import { getApiBaseUrl } from "./apiBase";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

type ApiError = Error & { status?: number; body?: unknown };

function getMediaBaseUrl(): string {
  return `${getApiBaseUrl()}/media/v1`;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const token = await TokenService.getAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${getMediaBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !isRetry) {
    try {
      await AuthService.refreshTokens();
      return apiFetch<T>(path, options, true);
    } catch {
      // fall through
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      (body as { message?: string })?.message ?? `HTTP ${response.status}`,
    ) as ApiError;
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) return undefined as unknown as T;
  return response.json() as Promise<T>;
}

export interface MediaMetadata {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  url?: string;
  thumbnail_url?: string;
  created_at: string;
  uploaded_by?: string;
}

export interface UploadMediaResult {
  id: string;
  url: string;
  thumbnail_url?: string;
  filename: string;
  mime_type: string;
  size: number;
}

export type UploadMediaContext = "message" | "avatar" | "group_icon";

// The media-service upload response uses {mediaId, ...} but the rest of the
// app (chat send path, attachment metadata) expects {id}. Normalise here so
// callers don't have to know which key the server happened to return.
const normaliseUpload = (raw: any): UploadMediaResult => {
  const id = raw?.mediaId ?? raw?.id ?? raw?.media_id;
  // Always use the media-service API endpoint so recipients fetch via auth header.
  // Presigned MinIO URLs stored in messages would be inaccessible to non-owners.
  return {
    ...raw,
    id,
    url: id
      ? `${getMediaBaseUrl()}/${encodeURIComponent(id)}/blob`
      : (raw?.url ?? ""),
    thumbnail_url: id
      ? `${getMediaBaseUrl()}/${encodeURIComponent(id)}/thumbnail`
      : (raw?.thumbnailUrl ?? raw?.thumbnail_url ?? undefined),
  };
};

export const MediaService = {
  /**
   * POST /media/upload
   * Upload a file (image, video, audio, document).
   */
  async uploadMedia(
    file: { uri: string; name: string; type: string },
    onProgress?: (percent: number) => void,
    meta?: { context?: UploadMediaContext; ownerId?: string },
  ): Promise<UploadMediaResult> {
    const token = await TokenService.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const formData = new FormData();
    if (meta?.context) formData.append("context", meta.context);
    if (meta?.ownerId) formData.append("ownerId", meta.ownerId);

    // On web, FormData needs a real Blob; on native, the {uri,name,type} object works
    if (Platform.OS === "web") {
      try {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        formData.append("file", blob, file.name);
      } catch {
        // Fallback: try the data URI directly as a blob
        const byteString = atob(file.uri.split(",")[1] || "");
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++)
          ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: file.type });
        formData.append("file", blob, file.name);
      }
    } else {
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
    }

    // Native fetch doesn't support upload progress; use XMLHttpRequest when progress is needed
    if (onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${getMediaBaseUrl()}/upload`);
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(normaliseUpload(JSON.parse(xhr.responseText)));
          } else {
            reject(new Error(`Upload failed: HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(formData);
      });
    }

    console.log(
      "[PDP-DEBUG][MediaService] uploadMedia → POST",
      `${getMediaBaseUrl()}/upload`,
      {
        context: meta?.context,
        ownerId: meta?.ownerId,
        fileName: file.name,
        fileType: file.type,
      },
    );
    const response = await fetch(`${getMediaBaseUrl()}/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.log(
        "[PDP-DEBUG][MediaService] uploadMedia ← HTTP",
        response.status,
        body,
      );
      const error = new Error(
        (body as { message?: string })?.message ??
          `Upload failed: HTTP ${response.status}`,
      ) as ApiError;
      error.status = response.status;
      throw error;
    }

    const raw = await response.json();
    console.log("[PDP-DEBUG][MediaService] uploadMedia ← 200 raw:", raw);
    const normalised = normaliseUpload(raw);
    console.log("[PDP-DEBUG][MediaService] uploadMedia normalised:", {
      id: normalised.id,
      url: normalised.url,
      thumbnail_url: normalised.thumbnail_url,
    });
    return normalised;
  },

  /**
   * GET /media/:id
   * Get metadata for a media file.
   */
  async getMediaMetadata(id: string): Promise<MediaMetadata> {
    return apiFetch<MediaMetadata>(`/${encodeURIComponent(id)}`);
  },

  /**
   * GET /media/:id/blob
   * Download the raw file. Returns a blob URL usable in <Image> or file save.
   */
  async downloadMedia(id: string): Promise<{ url: string; blob?: Blob }> {
    const token = await TokenService.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(
      `${getMediaBaseUrl()}/${encodeURIComponent(id)}/blob`,
      {
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to download media: HTTP ${response.status}`);
    }

    // On React Native, blob() may not be available — return the response URL as fallback
    try {
      const blob = await response.blob();
      return { url: response.url, blob };
    } catch {
      return { url: response.url };
    }
  },

  /**
   * Download media to a local cache file (works for protected endpoints).
   * Useful for React Native <Image> when auth headers are required.
   */
  async downloadMediaToCacheFile(id: string): Promise<string> {
    const token = await TokenService.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const cacheRoot =
      (FileSystem as any).cacheDirectory ??
      (FileSystem as any).documentDirectory ??
      "";
    const cacheDir = `${cacheRoot}avatars/`;
    await FileSystem.makeDirectoryAsync(cacheDir, {
      intermediates: true,
    }).catch(() => {});
    const baseName = `${encodeURIComponent(id)}`;
    const tmpPath = `${cacheDir}${baseName}.tmp`;

    const download = (url: string) =>
      FileSystem.downloadAsync(url, tmpPath, { headers });

    const result = await download(
      `${getMediaBaseUrl()}/${encodeURIComponent(id)}/blob`,
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Failed to download media file: HTTP ${result.status}`);
    }

    const contentType =
      (result as any)?.headers?.["Content-Type"] ??
      (result as any)?.headers?.["content-type"] ??
      "";

    const info = (await FileSystem.getInfoAsync(result.uri).catch(
      () => null,
    )) as any;
    const size = typeof info?.size === "number" ? info.size : undefined;

    const tryParseUrl = async () => {
      const raw = await FileSystem.readAsStringAsync(result.uri).catch(
        () => "",
      );
      try {
        const data = JSON.parse(raw);
        const url = typeof data?.url === "string" ? data.url : undefined;
        if (url) return url;
      } catch {
        // ignore
      }
      return undefined;
    };

    if (
      contentType.includes("application/json") ||
      contentType.includes("text/plain") ||
      (typeof size === "number" && size > 0 && size < 1024)
    ) {
      const url = await tryParseUrl();
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(
        () => {},
      );

      try {
        const streamed = await download(
          `${getMediaBaseUrl()}/${encodeURIComponent(id)}/blob?stream=1`,
        );
        if (streamed.status < 200 || streamed.status >= 300) {
          throw new Error(`HTTP ${streamed.status}`);
        }

        const streamedContentType =
          (streamed as any)?.headers?.["Content-Type"] ??
          (streamed as any)?.headers?.["content-type"] ??
          "";

        if (!streamedContentType.startsWith("image/")) {
          await FileSystem.deleteAsync(streamed.uri, {
            idempotent: true,
          }).catch(() => {});
          throw new Error(
            `Streamed avatar has invalid content-type: ${streamedContentType}`,
          );
        }

        const ext = streamedContentType.includes("png")
          ? "png"
          : streamedContentType.includes("webp")
            ? "webp"
            : streamedContentType.includes("heic") ||
                streamedContentType.includes("heif")
              ? "heic"
              : "jpg";
        const finalPath = `${cacheDir}${baseName}.${ext}`;
        await FileSystem.deleteAsync(finalPath, { idempotent: true }).catch(
          () => {},
        );
        await FileSystem.moveAsync({ from: streamed.uri, to: finalPath });
        return finalPath;
      } catch {
        if (url) return url;
        throw new Error("Downloaded avatar is not an image");
      }
    }

    if (!contentType.startsWith("image/")) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(
        () => {},
      );
      throw new Error(
        `Downloaded avatar has invalid content-type: ${contentType}`,
      );
    }

    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("heic") || contentType.includes("heif")
          ? "heic"
          : "jpg";
    const finalPath = `${cacheDir}${baseName}.${ext}`;
    await FileSystem.deleteAsync(finalPath, { idempotent: true }).catch(
      () => {},
    );
    await FileSystem.moveAsync({ from: result.uri, to: finalPath });

    return finalPath;
  },

  /**
   * GET /media/:id/thumbnail
   * Download the thumbnail image.
   */
  async downloadThumbnail(id: string): Promise<string> {
    const token = await TokenService.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(
      `${getMediaBaseUrl()}/${encodeURIComponent(id)}/thumbnail`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(`Failed to download thumbnail: HTTP ${response.status}`);
    }

    return response.url;
  },

  /**
   * DELETE /media/:id
   * Delete a media file.
   */
  async deleteMedia(id: string): Promise<void> {
    await apiFetch<void>(`/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  /**
   * PATCH /media/:id/share
   * Grant read access to the given user IDs for a media file.
   */
  async shareMedia(id: string, userIds: string[]): Promise<void> {
    if (!userIds.length) return;
    await apiFetch<{ sharedWith: string[] }>(
      `/${encodeURIComponent(id)}/share`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      },
    );
  },

  /**
   * Same as shareMedia but retries up to `maxAttempts` times on failure
   * with exponential backoff (default 1s, 2s). Recipients cannot view
   * media until shared_with contains their user ID, so a transient
   * network blip during this PATCH would leave the media unreadable
   * for the recipient until the next retry — surface failures clearly
   * after exhaustion.
   */
  async shareMediaWithRetry(
    id: string,
    userIds: string[],
    options: {
      maxAttempts?: number;
      initialDelayMs?: number;
      sleep?: (ms: number) => Promise<void>;
    } = {},
  ): Promise<void> {
    if (!userIds.length) return;
    const maxAttempts = options.maxAttempts ?? 3;
    const initialDelayMs = options.initialDelayMs ?? 1000;
    const sleep =
      options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await MediaService.shareMedia(id, userIds);
        return;
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          await sleep(initialDelayMs * Math.pow(2, attempt - 1));
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("shareMedia failed after retries");
  },
};

export default MediaService;
