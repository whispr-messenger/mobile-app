import * as ImageManipulator from "expo-image-manipulator";
import jpeg from "jpeg-js";

async function resizeToJpegBase64(uri: string, width: number, height: number): Promise<string> {
    const fn =
        (ImageManipulator as any).manipulate ||
        (ImageManipulator as any).manipulateAsync;

    if (typeof fn !== "function") {
        throw new Error("expo-image-manipulator: neither manipulate nor manipulateAsync exists.");
    }

    const result = await fn(
        uri,
        [{ resize: { width, height } }],
        {
            compress: 1,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
        }
    );

    if (!result?.base64) throw new Error("Failed to get base64 from image manipulation.");
    return result.base64 as string;
}

export async function imageUriToFloatTensor_0_255(params: {
    uri: string;
    width: number;
    height: number;
}): Promise<Float32Array> {
    const { uri, width, height } = params;

    const base64 = await resizeToJpegBase64(uri, width, height);
    const bytes = new Uint8Array(Buffer.from(base64, "base64"));
    const decoded = jpeg.decode(bytes, { useTArray: true });
    const data: Uint8Array = decoded.data; // RGBA

    const out = new Float32Array(width * height * 3);
    let j = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Python 0-255
        out[j++] = r;
        out[j++] = g;
        out[j++] = b;
    }

    return out;
}
