import { MEDIA_API_URL } from "../../config/api";
import { AuthService } from "../AuthService";
import { TokenService } from "../TokenService";
import { emitSessionExpired } from "../sessionEvents";

export interface UploadMediaResponse {
  mediaId: string;
  url: string | null;
  thumbnailUrl: string | null;
  expiresAt: string | null;
  context: "message" | "avatar" | "group_icon";
  size: number;
}

function guessImageMimeType(uri: string): { type: string; name: string } {
  const clean = uri.split("?")[0] ?? uri;
  const lower = clean.toLowerCase();
  if (lower.endsWith(".png")) return { type: "image/png", name: "image.png" };
  if (lower.endsWith(".webp"))
    return { type: "image/webp", name: "image.webp" };
  if (lower.endsWith(".heic"))
    return { type: "image/heic", name: "image.heic" };
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
    return { type: "image/jpeg", name: "image.jpg" };
  return { type: "image/jpeg", name: "image.jpg" };
}

export const mediaAPI = {
  async uploadImage(
    ownerId: string,
    fileUri: string,
    context: UploadMediaResponse["context"],
  ): Promise<UploadMediaResponse> {
    const { type, name } = guessImageMimeType(fileUri);

    const form = new FormData();
    form.append("file", {
      // @ts-ignore React Native FormData file shape
      uri: fileUri,
      type,
      name,
    } as any);
    form.append("context", context);
    form.append("ownerId", ownerId);

    const doUpload = async () => {
      const token = await TokenService.getAccessToken();
      if (!token) throw new Error("Missing access token");
      return fetch(`${MEDIA_API_URL}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
    };

    let res = await doUpload();
    if (res.status === 401) {
      try {
        await AuthService.refreshTokens();
        res = await doUpload();
      } catch (e: any) {
        if (e?.message === "SESSION_EXPIRED") {
          emitSessionExpired("refresh_failed");
          const err = new Error("SESSION_EXPIRED");
          (err as any).status = res.status;
          throw err;
        }
        throw e;
      }
    }
    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Upload failed: HTTP ${res.status} ${body}`);
      (err as any).status = res.status;
      throw err;
    }
    return (await res.json()) as UploadMediaResponse;
  },

  async uploadAvatar(
    ownerId: string,
    fileUri: string,
  ): Promise<UploadMediaResponse> {
    return this.uploadImage(ownerId, fileUri, "avatar");
  },

  async uploadGroupIcon(
    ownerId: string,
    fileUri: string,
  ): Promise<UploadMediaResponse> {
    return this.uploadImage(ownerId, fileUri, "group_icon");
  },
};
