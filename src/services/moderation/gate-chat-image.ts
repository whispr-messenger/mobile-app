import { tfjsService } from "./tfjs.service";
import { logger } from "../../utils/logger";

export type GateChatImageResult =
  | { ok: true }
  | { ok: false; reason: "blocked" | "error" };

/**
 * On-device TFJS image check before sending a chat image; block send if it fails.
 * Works on both web and native (Android). Caller must skip video/file types.
 */
export async function gateChatImageBeforeSend(
  uri: string,
): Promise<GateChatImageResult> {
  try {
    const r = await tfjsService.gate({ uri });
    if (!r.allowed) return { ok: false, reason: "blocked" };
    return { ok: true };
  } catch (e) {
    logger.error("moderation", "TFJS image gate inference failed", e);
    return { ok: false, reason: "error" };
  }
}
