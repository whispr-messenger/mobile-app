/**
 * Image compression utilities
 * WHISPR-265: Compression automatique des images avant envoi
 */

import * as ImageManipulator from "expo-image-manipulator";

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
    const {
      maxWidth = DEFAULT_MAX_WIDTH,
      maxHeight = DEFAULT_MAX_HEIGHT,
      quality = DEFAULT_QUALITY,
      compress = DEFAULT_COMPRESS,
    } = options;

    // Get image dimensions
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: maxWidth,
            height: maxHeight,
          },
        },
      ],
      {
        compress: compress,
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
