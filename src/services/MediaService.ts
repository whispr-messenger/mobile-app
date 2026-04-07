import { AuthService } from './AuthService';
import { TokenService } from './TokenService';
import { getApiBaseUrl } from './apiBase';

type ApiError = Error & { status?: number; body?: unknown };

function getMediaBaseUrl(): string {
  return `${getApiBaseUrl()}/media`;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = await TokenService.getAccessToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

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
      (body as { message?: string })?.message ?? `HTTP ${response.status}`
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

export const MediaService = {
  /**
   * POST /media/upload
   * Upload a file (image, video, audio, document).
   */
  async uploadMedia(
    file: { uri: string; name: string; type: string },
    onProgress?: (percent: number) => void
  ): Promise<UploadMediaResult> {
    const token = await TokenService.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const formData = new FormData();
    formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);

    // Native fetch doesn't support upload progress; use XMLHttpRequest when progress is needed
    if (onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${getMediaBaseUrl()}/upload`);
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload failed: HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
    }

    const response = await fetch(`${getMediaBaseUrl()}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(
        (body as { message?: string })?.message ?? `Upload failed: HTTP ${response.status}`
      ) as ApiError;
      error.status = response.status;
      throw error;
    }

    return response.json();
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
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${getMediaBaseUrl()}/${encodeURIComponent(id)}/blob`, {
      headers,
    });

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
   * GET /media/:id/thumbnail
   * Download the thumbnail image.
   */
  async downloadThumbnail(id: string): Promise<string> {
    const token = await TokenService.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(
      `${getMediaBaseUrl()}/${encodeURIComponent(id)}/thumbnail`,
      { headers }
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
    await apiFetch<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export default MediaService;
