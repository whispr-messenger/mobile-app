import { Platform } from "react-native";
import { tfliteService } from "./tflite.service";
import { logger } from "../../utils/logger";

export type GateChatImageResult = { ok: true } | { ok: false; reason: "blocked" | "error" };

/**
 * On-device TFLite check before sending a chat image; block send if it fails.
 * Skipped on web (no native TFLite); caller must skip video/file types.
 */
export async function gateChatImageBeforeSend(uri: string): Promise<GateChatImageResult> {
  if (Platform.OS === "web") {
    logger.warn("moderation", "Skipping TFLite gate on web");
    return { ok: true };
  }

  try {
    const r = await tfliteService.gate({ uri });
    if (!r.allowed) {
      return { ok: false, reason: "blocked" };
    }
    return { ok: true };
  } catch (e) {
    logger.error("moderation", "Image gate inference failed", e);
    return { ok: false, reason: "error" };
  }
}
