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

export const mediaAPI = {
  async uploadAvatar(
    ownerId: string,
    fileUri: string,
  ): Promise<UploadMediaResponse> {
    const token = await TokenService.getAccessToken();
    if (!token) throw new Error("Missing access token");

    const form = new FormData();
    form.append("file", {
      // @ts-ignore React Native FormData file shape
      uri: fileUri,
      type: "image/jpeg",
      name: "avatar.jpg",
    } as any);
    form.append("context", "avatar");
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
};
