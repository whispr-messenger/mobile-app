import "react-native-get-random-values";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import { Asset } from "expo-asset";
import { Buffer } from "buffer";
import { Platform, InteractionManager } from "react-native";
import type { GateResult } from "./moderation.types";
import { imageUriToFloatTensor_0_255 } from "./image-to-tensor";
import { CLASS_NAMES, INPUT_SIZE } from "./moderation.constants";

// Manually register a React Native platform for Hermes compatibility
class PlatformReactNativeManual implements tf.Platform {
  fetch(path: string, init?: RequestInit): Promise<Response> {
    return globalThis.fetch(path, init);
  }
  encode(text: string, encoding: string): Uint8Array {
    return new Uint8Array(Buffer.from(text, encoding as BufferEncoding));
  }
  decode(bytes: Uint8Array, encoding: string): string {
    return Buffer.from(bytes).toString(encoding as BufferEncoding);
  }
  now(): number {
    return Date.now();
  }
  setTimeoutCustom(): void {
    throw new Error("not supported");
  }
  isTypedArray(
    a: unknown,
  ): a is Float32Array | Int32Array | Uint8Array | Uint8ClampedArray {
    return (
      a instanceof Float32Array ||
      a instanceof Int32Array ||
      a instanceof Uint8Array ||
      a instanceof Uint8ClampedArray
    );
  }
}

if (Platform.OS !== "web") {
  tf.setPlatform("react-native", new PlatformReactNativeManual());
}

/* eslint-disable @typescript-eslint/no-require-imports */
const modelJsonAsset = require("../../../assets/models/tfjs/model.json");
const weightAssets = [
  require("../../../assets/models/tfjs/group1-shard1of1.bin"),
];
/* eslint-enable @typescript-eslint/no-require-imports */

let model: tf.GraphModel | null = null;
let loading: Promise<void> | null = null;
let tfReady = false;

/** Yield to the JS thread so UI stays responsive */
function yieldThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Custom IOHandler: reads model.json from a bundled require() and
 * fetches weight shards from expo-asset URIs. Uses Asset.fromModule so
 * it works on both React Native (local file URI) and web (HTTP asset URL).
 */
function bundledAssetIO(): tf.io.IOHandler {
  return {
    async load(): Promise<tf.io.ModelArtifacts> {
      const modelTopology = modelJsonAsset.modelTopology;
      const weightsManifest = modelJsonAsset.weightsManifest;

      const weightBuffers: ArrayBuffer[] = [];
      for (const mod of weightAssets) {
        const asset = Asset.fromModule(mod);
        await asset.downloadAsync();
        const uri = asset.localUri || asset.uri;
        if (!uri) {
          throw new Error("[tfjs] Asset has no URI after download");
        }
        const response = await fetch(uri);
        if (!response.ok) {
          throw new Error(
            `[tfjs] Failed to fetch weight shard ${uri}: HTTP ${response.status}`,
          );
        }
        const buf = await response.arrayBuffer();
        weightBuffers.push(buf);
      }

      const totalSize = weightBuffers.reduce((s, b) => s + b.byteLength, 0);
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      for (const buf of weightBuffers) {
        combined.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
      }

      const weightSpecs = weightsManifest[0].weights;

      return {
        modelTopology,
        weightSpecs,
        weightData: combined.buffer,
        format: modelJsonAsset.format,
        generatedBy: modelJsonAsset.generatedBy,
        convertedBy: modelJsonAsset.convertedBy,
      };
    },
  };
}

async function ensureModel(): Promise<void> {
  if (model) return;
  if (loading) return loading;

  loading = (async () => {
    try {
      if (!tfReady) {
        await tf.setBackend("cpu");
        await tf.ready();
        tfReady = true;
      }
      await yieldThread();
      model = await tf.loadGraphModel(bundledAssetIO());
    } catch (err) {
      // Surface the real failure reason so gate-chat-image can log it
      // explicitly instead of the generic catch-all message.
      console.error("[tfjs] ensureModel failed:", err);
      loading = null;
      throw err;
    }
  })();

  return loading;
}

/**
 * When the top class is "Other" but the model isn't very confident (below
 * this bound), we look at the runner-up food class as a weak signal and
 * still block if it clears `SECONDARY_FOOD_THRESHOLD`. Tuned on a sample
 * of Wikipedia Commons junk-food photos where baked potatoes and BLT
 * sandwiches were misclassified as "Other" with top-1 probability in the
 * 0.58–0.81 range while the true class sat at 0.17–0.31.
 */
export const OTHER_CONFIDENCE_CEILING = 0.85;
export const SECONDARY_FOOD_THRESHOLD = 0.15;

/**
 * Pure decision function: maps a softmax output to the gate verdict.
 * Extracted from `gate` so it can be unit-tested without loading the
 * TF model. 0.3 is deliberately low — we need high recall on trained
 * food classes (≥ 85 % target) even at the cost of occasional false
 * positives on food-looking images.
 */
export function decideFromProbs(
  data: ArrayLike<number>,
  threshold = 0.3,
): GateResult {
  if (data.length !== CLASS_NAMES.length) {
    throw new Error(
      `Output length mismatch: got ${data.length}, expected ${CLASS_NAMES.length}.`,
    );
  }

  let bestIndex = 0;
  let bestProb = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i] > bestProb) {
      bestProb = data[i];
      bestIndex = i;
    }
  }

  const bestClass = CLASS_NAMES[bestIndex];

  const probs: Record<string, number> = {};
  for (let i = 0; i < CLASS_NAMES.length; i++) {
    probs[CLASS_NAMES[i]] = Number(data[i]);
  }

  const isFoodClass = bestClass !== "Other";
  const isConfident = bestProb >= threshold;

  if (isFoodClass && isConfident) {
    return {
      allowed: false,
      reason: "BLOCK_TRAINED_CLASS",
      bestIndex,
      bestProb: Number(bestProb),
      bestClass,
      probs,
    };
  }

  // Fallback: the model picked "Other" but wasn't decisive, and the
  // runner-up is a food class with enough mass. Block on that weak
  // signal so ambiguous junk-food shots (baked potato with toppings,
  // sandwich on a busy plate) don't slip past the gate.
  if (bestClass === "Other" && bestProb < OTHER_CONFIDENCE_CEILING) {
    let runnerUpIndex = -1;
    let runnerUpProb = 0;
    for (let i = 0; i < data.length; i++) {
      if (CLASS_NAMES[i] === "Other") continue;
      if (data[i] > runnerUpProb) {
        runnerUpProb = data[i];
        runnerUpIndex = i;
      }
    }
    if (runnerUpIndex !== -1 && runnerUpProb >= SECONDARY_FOOD_THRESHOLD) {
      return {
        allowed: false,
        reason: "BLOCK_WEAK_FOOD_SIGNAL",
        bestIndex: runnerUpIndex,
        bestProb: Number(runnerUpProb),
        bestClass: CLASS_NAMES[runnerUpIndex],
        probs,
      };
    }
  }

  return {
    allowed: true,
    reason: !isFoodClass ? "OTHER_CLASS" : "UNCERTAIN",
    bestIndex,
    bestProb: Number(bestProb),
    bestClass,
    probs,
  };
}

async function gate(params: {
  uri: string;
  threshold?: number;
}): Promise<GateResult> {
  const { uri, threshold = 0.3 } = params;

  await ensureModel();
  if (!model) throw new Error("TFJS model failed to load");

  // Yield before heavy image processing
  await yieldThread();

  const flat = await imageUriToFloatTensor_0_255({
    uri,
    width: INPUT_SIZE,
    height: INPUT_SIZE,
  });

  // Yield before inference (the heaviest part)
  await yieldThread();

  // Run inference wrapped in InteractionManager to avoid blocking animations
  const data = await new Promise<Float32Array | Int32Array | Uint8Array>(
    (resolve, reject) => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const input = tf.tensor4d(flat, [1, INPUT_SIZE, INPUT_SIZE, 3]);
          const output = model!.predict(input) as tf.Tensor;
          const result = await output.data();
          input.dispose();
          output.dispose();
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    },
  );

  return decideFromProbs(data, threshold);
}

async function isAllowed(params: {
  uri: string;
  threshold?: number;
}): Promise<boolean> {
  const r = await gate(params);
  return r.allowed;
}

export const tfjsService = { gate, isAllowed };
