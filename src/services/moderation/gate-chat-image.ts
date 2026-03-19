import { Platform } from "react-native";
import { tfliteService } from "./tflite.service";
import { logger } from "../../utils/logger";

export type GateChatImageResult = { ok: true } | { ok: false; reason: "blocked" | "error" };

/**
 * 发送聊天图片前的本地 TFLite 检测。未通过则禁止发送。
 * Web 端跳过（未集成原生 TFLite）；视频/文件由调用方自行跳过。
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
