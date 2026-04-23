import * as VideoThumbnails from "expo-video-thumbnails";
import { tfjsService } from "./tfjs.service";
import { logger } from "../../utils/logger";
import { getModerationModelVersion } from "./model-version";
import type { GateChatImageResult } from "./gate-chat-image";

/**
 * On-device TFJS video check before sending a chat video. Only active when
 * the moderation model is v3 — v2 has no training signal for video content
 * and keeps the pre-WHISPR-1149 behaviour (no gate, always allowed).
 *
 * When v3 is active we extract the frame at t=0 via `expo-video-thumbnails`
 * and run the same binary food gate on it. Fail-closed on thumbnail
 * extraction or inference errors, consistent with `gateChatImageBeforeSend`.
 */
export async function gateChatVideoBeforeSend(
  uri: string,
): Promise<GateChatImageResult> {
  const version = await getModerationModelVersion();
  if (version !== "v3") {
    return { ok: true };
  }

  let thumbnailUri: string;
  try {
    const thumb = await VideoThumbnails.getThumbnailAsync(uri, {
      time: 0,
      quality: 1,
    });
    thumbnailUri = thumb.uri;
  } catch (e) {
    console.error(
      "[moderation] video thumbnail extraction FAILED — blocking video (fail-closed):",
      e,
    );
    logger.warn(
      "moderation",
      "Video thumbnail extraction failed. Blocking video for safety.",
      e,
    );
    return {
      ok: false,
      reason:
        "La vérification de la vidéo n'a pas pu aboutir. Veuillez réessayer.",
    };
  }

  try {
    const r = await tfjsService.gate({ uri: thumbnailUri, version: "v3" });
    if (!r.allowed) {
      return {
        ok: false,
        reason: "Cette vidéo a été détectée comme contenu non autorisé.",
        bestClass: r.bestClass,
        scores: r.probs,
      };
    }
    return { ok: true };
  } catch (e) {
    console.error(
      "[moderation] TFJS video gate FAILED — blocking video (fail-closed):",
      e,
    );
    logger.warn(
      "moderation",
      "TFJS video gate could not run. Blocking video for safety.",
      e,
    );
    return {
      ok: false,
      reason:
        "La vérification de la vidéo n'a pas pu aboutir. Veuillez réessayer.",
    };
  }
}
