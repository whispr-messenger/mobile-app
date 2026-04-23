import * as ImageManipulator from "expo-image-manipulator";
import jpeg from "jpeg-js";
import { Platform } from "react-native";

/** RN Hermes has atob; avoid relying on Node `Buffer` in the app bundle. */
function base64ToUint8Array(base64: string): Uint8Array {
  const atobFn = (globalThis as unknown as { atob?: (s: string) => string })
    .atob;
  if (typeof atobFn === "function") {
    const binary = atobFn(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Buffer } = require("buffer") as typeof import("buffer");
  return new Uint8Array(Buffer.from(base64, "base64"));
}

/**
 * Detects image format from magic bytes.
 * - JPEG: ff d8 ff
 * - PNG:  89 50 4e 47
 */
function detectImageFormat(bytes: Uint8Array): "jpeg" | "png" | "unknown" {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  return "unknown";
}

async function resizeToJpegBase64(
  uri: string,
  width: number,
  height: number,
): Promise<string> {
  const fn =
    (ImageManipulator as any).manipulate ||
    (ImageManipulator as any).manipulateAsync;

  if (typeof fn !== "function") {
    throw new Error(
      "expo-image-manipulator: neither manipulate nor manipulateAsync exists.",
    );
  }

  // Probe original dimensions so we can center-crop to a square before
  // resizing. Without this, portrait photos (e.g. 3024×4032 from the camera)
  // get squashed into 1:1 224×224, which wrecks classifier confidence and
  // was the root cause of camera-captured junk food slipping past the gate.
  const probe = await fn(uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const origW = Number(probe?.width) || 0;
  const origH = Number(probe?.height) || 0;

  const actions: unknown[] = [];
  if (origW > 0 && origH > 0 && origW !== origH) {
    const side = Math.min(origW, origH);
    const originX = Math.floor((origW - side) / 2);
    const originY = Math.floor((origH - side) / 2);
    actions.push({
      crop: { originX, originY, width: side, height: side },
    });
  }
  actions.push({ resize: { width, height } });

  const result = await fn(uri, actions, {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  if (!result?.base64)
    throw new Error("Failed to get base64 from image manipulation.");
  return result.base64 as string;
}

/**
 * Web-only: decode an image (any format) via the browser's native <img> +
 * <canvas> pipeline, resizing to the target dimensions.
 *
 * This bypasses jpeg-js entirely on web because expo-image-manipulator on
 * web sometimes returns PNG bytes despite `format: JPEG`, which breaks
 * jpeg-js with "SOI not found". Browsers always know how to decode
 * whatever bitmap comes back.
 *
 * Returns RGBA in a Uint8ClampedArray (length = width * height * 4).
 */
async function decodeAndResizeOnWeb(
  uri: string,
  width: number,
  height: number,
): Promise<Uint8ClampedArray> {
  if (typeof document === "undefined") {
    throw new Error("decodeAndResizeOnWeb called outside of a browser context");
  }

  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () =>
      reject(new Error(`Failed to load image from URI on web: ${uri}`));
    el.src = uri;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D canvas context on web");

  // Center-crop to a square before drawing into the target size so the
  // classifier sees undistorted content on portrait/landscape inputs.
  const side = Math.min(img.naturalWidth, img.naturalHeight) || 1;
  const sx = Math.max(0, Math.floor((img.naturalWidth - side) / 2));
  const sy = Math.max(0, Math.floor((img.naturalHeight - side) / 2));
  ctx.drawImage(img, sx, sy, side, side, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return imageData.data;
}

export async function imageUriToFloatTensor_0_255(params: {
  uri: string;
  width: number;
  height: number;
}): Promise<Float32Array> {
  const { uri, width, height } = params;

  let rgba: Uint8Array | Uint8ClampedArray;

  if (Platform.OS === "web") {
    // On web, go straight through Canvas: format-agnostic and avoids the
    // jpeg-js "SOI not found" failure when manipulator returns PNG bytes.
    rgba = await decodeAndResizeOnWeb(uri, width, height);
  } else {
    const base64 = await resizeToJpegBase64(uri, width, height);
    const bytes = base64ToUint8Array(base64);
    const format = detectImageFormat(bytes);

    if (format === "jpeg") {
      const decoded = jpeg.decode(bytes, { useTArray: true });
      rgba = decoded.data;
    } else if (format === "png") {
      // Native is expected to return JPEG, but guard defensively.
      throw new Error(
        "Unexpected PNG output from expo-image-manipulator on native; cannot decode without a PNG decoder.",
      );
    } else {
      throw new Error(
        `Unknown image format from expo-image-manipulator (magic bytes: ${Array.from(
          bytes.slice(0, 4),
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ")})`,
      );
    }
  }

  const out = new Float32Array(width * height * 3);
  let j = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    // Python 0-255
    out[j++] = r;
    out[j++] = g;
    out[j++] = b;
  }

  return out;
}
