/**
 * Image compression utilities
 * WHISPR-265: Compression automatique des images avant envoi
 * WHISPR-1039: ne plus déformer les images, le côté le plus long est borné
 *              et le ratio d'origine est préservé.
 * WHISPR-1197: GIF/HEIC sont préservés tels quels (pas de re-encodage JPEG)
 *              pour conserver l'animation des GIFs et la compression native
 *              Apple sur les HEIC. Seuls JPEG/PNG/inconnu passent par le
 *              pipeline `manipulateAsync`.
 */

import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

export type ImageFormat = "gif" | "heic" | "jpeg" | "png" | "webp" | "unknown";

/**
 * Détecte le format d'une image à partir de son URI/extension.
 * Pure et exportée pour être testable sans expo-image-manipulator.
 *
 * Note : on s'appuie sur l'extension uniquement. Une détection par magic
 * bytes serait plus robuste mais nécessiterait un read I/O — l'URI vient
 * de `expo-image-picker` ou `expo-camera` qui préservent l'extension du
 * fichier source, donc le risque d'erreur est faible et la perf gagnée
 * sur le chemin chaud (chaque envoi d'image) en vaut le coût.
 */
export function detectImageFormatFromUri(uri: string): ImageFormat {
  const path = uri.split("?")[0]?.split("#")[0] ?? uri;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "gif":
      return "gif";
    case "heic":
    case "heif":
      return "heic";
    case "jpg":
    case "jpeg":
      return "jpeg";
    case "png":
      return "png";
    case "webp":
      return "webp";
    default:
      return "unknown";
  }
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  compress?: number;
}

const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_MAX_HEIGHT = 1920;
const DEFAULT_QUALITY = 0.8;
const DEFAULT_COMPRESS = 0.7;

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) =>
        reject(
          err instanceof Error ? err : new Error(String(err ?? "unknown")),
        ),
    );
  });
}

/**
 * Choisit l'action `resize` la plus appropriée tout en préservant le ratio.
 * Si le côté le plus long dépasse sa borne, on ne contraint que ce côté ;
 * `expo-image-manipulator` calcule alors automatiquement l'autre. Si
 * l'image rentre déjà dans les bornes, on saute l'étape `resize`.
 *
 * Exporté pour permettre un test unitaire pur (cf. WHISPR-1039).
 */
export function buildResizeAction(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): ImageManipulator.Action[] {
  if (width >= height && width > maxWidth) {
    return [{ resize: { width: maxWidth } }];
  }
  if (height > width && height > maxHeight) {
    return [{ resize: { height: maxHeight } }];
  }
  return [];
}

/**
 * Compress an image file
 * @param uri - Image URI to compress
 * @param options - Compression options
 * @returns Compressed image URI
 */
export async function compressImage(
  uri: string,
  options: CompressionOptions = {},
): Promise<string> {
  try {
    const format = detectImageFormatFromUri(uri);

    // WHISPR-1197 : GIF et HEIC sont retournés inchangés.
    // - GIF : `manipulateAsync` ne préserve pas l'animation (extrait juste
    //   le premier frame), donc tout re-encodage casse le contenu attendu.
    // - HEIC : la pipeline serveur (media-service `magic-bytes.validator`
    //   + `THUMBNAIL_ALLOWED_MIME` + media.service.ts) accepte
    //   `image/heic`, et la modération côté client (`image-to-tensor.ts`)
    //   convertit en JPEG en interne avant inférence — donc préserver le
    //   format natif coûte zéro en aval et gagne ~50 % de bande passante
    //   sur les photos iOS prises en High Efficiency.
    if (format === "gif" || format === "heic") {
      return uri;
    }

    const {
      maxWidth = DEFAULT_MAX_WIDTH,
      maxHeight = DEFAULT_MAX_HEIGHT,
      quality = DEFAULT_QUALITY,
      compress = DEFAULT_COMPRESS,
    } = options;

    let resizeAction: ImageManipulator.Action[];
    try {
      const { width, height } = await getImageSize(uri);
      resizeAction = buildResizeAction(width, height, maxWidth, maxHeight);
    } catch {
      // Si la sonde de dimensions échoue, on borne uniquement la largeur :
      // mieux vaut une image potentiellement plus grande que prévu qu'une
      // image écrasée à un carré (régression de la compression "1920x1920").
      resizeAction = [{ resize: { width: maxWidth } }];
    }

    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      resizeAction,
      {
        compress,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    // Apply quality compression
    const finalResult = await ImageManipulator.manipulateAsync(
      manipResult.uri,
      [],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    return finalResult.uri;
  } catch (error) {
    console.error("[ImageCompression] Error compressing image:", error);
    // Return original URI if compression fails
    return uri;
  }
}
