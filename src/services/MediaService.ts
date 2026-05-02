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
  duration?: number;
}

export type UploadMediaContext = "message" | "avatar" | "group_icon";

// WHISPR-1220 — limites alignées avec media-service
// (see media.service.ts:46 / CONTEXT_SIZE_LIMITS).
//   * MESSAGE   : 100 MB — couvre vidéos courtes, documents, audio.
//   * AVATAR    :   5 MB — image seulement, déjà compressée client-side.
//   * GROUP_ICON:   5 MB — idem AVATAR.
const CONTEXT_SIZE_LIMITS: Record<UploadMediaContext, number> = {
  message: 100 * 1024 * 1024,
  avatar: 5 * 1024 * 1024,
  group_icon: 5 * 1024 * 1024,
};

const COMMON_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

// Doit rester en synchro avec CONTEXT_MIME_ALLOWLIST côté media-service
// (media.service.ts:70). Si le serveur élargit ou restreint la liste,
// reproduire ici — la validation client est un filet de sécurité, pas la
// source de vérité (le serveur doit toujours re-vérifier).
const CONTEXT_MIME_ALLOWLIST: Record<
  UploadMediaContext,
  ReadonlySet<string>
> = {
  message: new Set<string>([
    ...COMMON_IMAGE_MIMES,
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-matroska",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/mp4",
    "audio/aac",
    "audio/x-caf",
    "audio/x-m4a",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
  ]),
  avatar: new Set<string>(COMMON_IMAGE_MIMES),
  group_icon: new Set<string>(COMMON_IMAGE_MIMES),
};

export type UploadValidationError = Error & {
  code: "UPLOAD_TOO_LARGE" | "UPLOAD_MIME_NOT_ALLOWED";
  context: UploadMediaContext;
  limitBytes?: number;
  actualBytes?: number;
  mimeType?: string;
};

export function isUploadValidationError(
  err: unknown,
): err is UploadValidationError {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: unknown }).code;
  return code === "UPLOAD_TOO_LARGE" || code === "UPLOAD_MIME_NOT_ALLOWED";
}

function normalizeMime(raw: string): string {
  const mime = raw.split(";")[0].trim().toLowerCase();
  switch (mime) {
    case "audio/x-m4a":
    case "audio/m4a":
      return "audio/mp4";
    default:
      return mime;
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function readFileSize(uri: string): Promise<number | null> {
  if (Platform.OS === "web") {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size;
    } catch {
      return null;
    }
  }
  try {
    const info = (await FileSystem.getInfoAsync(uri)) as { size?: number };
    return typeof info?.size === "number" ? info.size : null;
  } catch {
    return null;
  }
}

async function validateUpload(
  file: { uri: string; type: string },
  context: UploadMediaContext,
): Promise<void> {
  const mime = normalizeMime(file.type);
  const allowed = CONTEXT_MIME_ALLOWLIST[context];
  if (!allowed.has(mime)) {
    const error = new Error(
      `MIME type '${mime}' not allowed for context '${context}'`,
    ) as UploadValidationError;
    error.code = "UPLOAD_MIME_NOT_ALLOWED";
    error.context = context;
    error.mimeType = mime;
    throw error;
  }

  const size = await readFileSize(file.uri);
  // If we can't read the size client-side (older RN, opaque URI), fall
  // through to the server check rather than block a legitimate upload.
  if (size === null) return;

  const limit = CONTEXT_SIZE_LIMITS[context];
  if (size > limit) {
    const error = new Error(
      `File size ${size} bytes exceeds ${context} limit of ${limit} bytes`,
    ) as UploadValidationError;
    error.code = "UPLOAD_TOO_LARGE";
    error.context = context;
    error.limitBytes = limit;
    error.actualBytes = size;
    throw error;
  }
}

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
    duration:
      raw?.duration ??
      raw?.metadata?.duration ??
      raw?.audioDuration ??
      raw?.audio_duration,
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
    const normalizedFile = {
      ...file,
      type: normalizeMime(file.type),
    };

    // WHISPR-1220 — fail fast before consuming the upload bandwidth.
    // Default to "message" (the most permissive context) when the caller
    // doesn't pass one, mirroring the server which uses the same default.
    await validateUpload(normalizedFile, meta?.context ?? "message");

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
        formData.append("file", blob, normalizedFile.name);
      } catch {
        // Fallback: try the data URI directly as a blob
        const byteString = atob(normalizedFile.uri.split(",")[1] || "");
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++)
          ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: normalizedFile.type });
        formData.append("file", blob, normalizedFile.name);
      }
    } else {
      formData.append("file", {
        uri: normalizedFile.uri,
        name: normalizedFile.name,
        type: normalizedFile.type,
      } as any);
    }

    // Keep XHR progress path on web only.
    // On iOS/Android we prefer fetch for multipart stability (voice upload 415).
    if (onProgress && Platform.OS === "web") {
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
            let message = `Upload failed: HTTP ${xhr.status}`;
            try {
              const parsed = JSON.parse(xhr.responseText || "{}") as {
                message?: string;
              };
              if (parsed?.message) {
                message = `${message} - ${parsed.message}`;
              }
            } catch {
              // Keep default message when body is not JSON.
            }
            reject(new Error(message));
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
        fileName: normalizedFile.name,
        fileType: normalizedFile.type,
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
   * Download an audio blob through the authenticated stream endpoint and keep
   * it as a local file so native players receive a real `file://` URI.
   */
  async downloadAudioToCacheFile(id: string): Promise<string> {
    const token = await TokenService.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const cacheRoot =
      (FileSystem as any).cacheDirectory ??
      (FileSystem as any).documentDirectory ??
      "";
    const cacheDir = `${cacheRoot}audio/`;
    await FileSystem.makeDirectoryAsync(cacheDir, {
      intermediates: true,
    }).catch(() => {});

    const baseName = `${encodeURIComponent(id)}`;
    const tmpPath = `${cacheDir}${baseName}.tmp`;
    const downloadUrl = `${getMediaBaseUrl()}/${encodeURIComponent(id)}/blob?stream=1`;
    let result: Awaited<ReturnType<typeof FileSystem.downloadAsync>> | null =
      null;
    let lastStatus = 0;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      result = await FileSystem.downloadAsync(downloadUrl, tmpPath, {
        headers,
      });
      lastStatus = result.status;
      if (result.status >= 200 && result.status < 300) {
        break;
      }
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(
        () => {},
      );
      if (result.status !== 404 || attempt === 4) {
        break;
      }
      await sleep(150 * attempt);
    }

    if (!result || lastStatus < 200 || lastStatus >= 300) {
      throw new Error(`Failed to download audio file: HTTP ${lastStatus}`);
    }

    const contentType = (
      (result as any)?.headers?.["Content-Type"] ??
      (result as any)?.headers?.["content-type"] ??
      ""
    ).toLowerCase();

    if (
      !contentType.startsWith("audio/") &&
      !contentType.startsWith("video/mp4") &&
      !contentType.startsWith("application/octet-stream")
    ) {
      const maybeBody = await FileSystem.readAsStringAsync(result.uri).catch(
        () => "",
      );
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(
        () => {},
      );
      throw new Error(
        `Downloaded audio has invalid content-type: ${contentType || maybeBody || "unknown"}`,
      );
    }

    const ext = contentType.includes("mpeg")
      ? "mp3"
      : contentType.includes("ogg")
        ? "ogg"
        : contentType.includes("wav")
          ? "wav"
          : contentType.includes("caf")
            ? "caf"
            : contentType.includes("aac")
              ? "aac"
              : contentType.includes("m4a")
                ? "m4a"
                : "mp4";
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
