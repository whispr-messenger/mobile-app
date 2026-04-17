import { tfjsService } from "./tfjs.service";
import { logger } from "../../utils/logger";

export type GateChatImageResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      bestClass?: string;
      scores?: Record<string, number>;
    };

/**
 * On-device TFJS image check before sending a chat image; block send if it fails.
 * Works on both web and native (Android). Caller must skip video/file types.
 *
 * SECURITY: if the gate cannot run (model load failure, image decoding error,
 * etc.) we now fail CLOSED with { ok: false } rather than silently allowing
 * the image through. Previously the fallback returned { ok: true }, which
 * meant that any decoding error on web (e.g. "SOI not found" from jpeg-js
 * when manipulator returns PNG bytes) disabled the moderation gate entirely
 * and bypassed the appeal/contestation flow. Fail-closed is the safer default.
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
        bestClass: r.bestClass,
        scores: r.probs,
      };
    return { ok: true };
  } catch (e) {
    console.error(
      "[moderation] TFJS image gate FAILED — blocking image (fail-closed):",
      e,
    );
    logger.warn(
      "moderation",
      "TFJS image gate could not run. Blocking image for safety.",
      e,
    );
    return {
      ok: false,
      reason:
        "La vérification de l'image n'a pas pu aboutir. Veuillez réessayer.",
    };
  }
}
