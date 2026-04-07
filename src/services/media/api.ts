import { MEDIA_API_URL } from "../../config/api";
import { TokenService } from "../TokenService";

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
    const token = await TokenService.getAccessToken();
    if (!token) throw new Error("Missing access token");

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

    const res = await fetch(`${MEDIA_API_URL}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });
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
