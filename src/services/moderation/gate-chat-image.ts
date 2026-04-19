import { tfjsService } from "./tfjs.service";
import { logger } from "../../utils/logger";

export type GateChatImageResult = { ok: true } | { ok: false; reason: string };

/**
 * On-device TFJS image check before sending a chat image; block send if it fails.
 * Works on both web and native (Android). Caller must skip video/file types.
 *
 * If the TFJS model cannot load (e.g. on web where native TF bindings are
 * unavailable), the gate falls back to { ok: true } so the image is still
 * sent — a warning is logged for observability.
 */
export async function gateChatImageBeforeSend(
  uri: string,
): Promise<GateChatImageResult> {
  try {
    const r = await tfjsService.gate({ uri });
    if (!r.allowed)
      return {
        ok: false,
        reason: "Cette image a été détectée comme contenu non autorisé.",
      };
    return { ok: true };
  } catch (e) {
    console.error(
      "[moderation] TFJS image gate FAILED — allowing image as fallback:",
      e,
    );
    logger.warn(
      "moderation",
      "TFJS image gate could not run. See console.error above for stack.",
      e,
    );
    return { ok: true };
  }
}
