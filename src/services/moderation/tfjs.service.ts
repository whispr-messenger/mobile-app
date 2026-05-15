import "react-native-get-random-values";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import { Asset } from "expo-asset";
import { Buffer } from "buffer";
import { Platform, InteractionManager } from "react-native";
import type { GateResult } from "./moderation.types";
import { imageUriToFloatTensor_0_255 } from "./image-to-tensor";
import { INPUT_SIZE } from "./moderation.constants";
import {
  decideV2FromProbs,
  decideV3FromProbs,
  decideV4FromProbs,
} from "./tfjs.decide";
import {
  getModerationModelVersion,
  type ModerationModelVersion,
} from "./model-version";

export {
  decideV2FromProbs,
  decideV3FromProbs,
  decideV4FromProbs,
  decideFromProbs,
  OTHER_CONFIDENCE_CEILING,
  SECONDARY_FOOD_THRESHOLD,
  V3_FOOD_THRESHOLD_DEFAULT,
  V4_UNHEALTHY_THRESHOLD_DEFAULT,
} from "./tfjs.decide";

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
const v2ModelJsonAsset = require("../../../assets/models/tfjs/model.json");
const v2WeightAssets = [
  require("../../../assets/models/tfjs/group1-shard1of1.bin"),
];
const v3ModelJsonAsset = require("../../../assets/models/v3-tfjs/model.json");
const v3WeightAssets = [
  require("../../../assets/models/v3-tfjs/group1-shard1of1.bin"),
];
const v4ModelJsonAsset = require("../../../assets/models/tfjsv2/model.json");
const v4WeightAssets = [
  require("../../../assets/models/tfjsv2/group1-shard1of1.bin"),
];
/* eslint-enable @typescript-eslint/no-require-imports */

interface ModelJson {
  modelTopology: object;
  weightsManifest: { weights: tf.io.WeightsManifestEntry[] }[];
  format?: string;
  generatedBy?: string;
  convertedBy?: string;
}

interface ModelSpec {
  modelJson: ModelJson;
  /** Metro/Expo `require()` of a binary asset returns a numeric module id. */
  weights: number[];
}

// All three model versions are TFJS graph-model exports (not layers-model).
// Graph models avoid the entire Keras layers schema, so the loader stays
// uniform across versions and no per-version compat patching is needed.
const SPECS: Record<ModerationModelVersion, ModelSpec> = {
  v2: { modelJson: v2ModelJsonAsset, weights: v2WeightAssets },
  v3: { modelJson: v3ModelJsonAsset, weights: v3WeightAssets },
  v4: { modelJson: v4ModelJsonAsset, weights: v4WeightAssets },
};

const models: Partial<Record<ModerationModelVersion, tf.GraphModel>> = {};
const loading: Partial<Record<ModerationModelVersion, Promise<void>>> = {};
let tfReady = false;

/** Yield to the JS thread so UI stays responsive */
function yieldThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Custom IOHandler: reads model.json from a bundled require() and
 * fetches weight shards from expo-asset URIs.
 */
function bundledAssetIO(spec: ModelSpec): tf.io.IOHandler {
  return {
    async load(): Promise<tf.io.ModelArtifacts> {
      const weightBuffers: ArrayBuffer[] = [];
      for (const mod of spec.weights) {
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
        weightBuffers.push(await response.arrayBuffer());
      }

      const totalSize = weightBuffers.reduce((s, b) => s + b.byteLength, 0);
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      for (const buf of weightBuffers) {
        combined.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
      }

      return {
        modelTopology: spec.modelJson.modelTopology,
        weightSpecs: spec.modelJson.weightsManifest[0].weights,
        weightData: combined.buffer,
        format: spec.modelJson.format,
        generatedBy: spec.modelJson.generatedBy,
        convertedBy: spec.modelJson.convertedBy,
      };
    },
  };
}

async function ensureTf(): Promise<void> {
  if (tfReady) return;
  await tf.setBackend("cpu");
  await tf.ready();
  tfReady = true;
}

async function ensureModel(version: ModerationModelVersion): Promise<void> {
  if (models[version]) return;
  const inFlight = loading[version];
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      await ensureTf();
      await yieldThread();
      models[version] = await tf.loadGraphModel(bundledAssetIO(SPECS[version]));
    } catch (err) {
      // Hermes/RN sometimes prints raw Error objects as just "[Error]" with
      // no surface info. Dump every channel we can reach so the underlying
      // message isn't swallowed.
      const e = err as { message?: string; name?: string; stack?: string };
      console.error(
        `[tfjs] ensureModel(${version}) failed —`,
        "name=",
        e?.name,
        "message=",
        e?.message,
      );
      if (e?.stack) {
        console.error(`[tfjs] ensureModel(${version}) stack:\n${e.stack}`);
      }
      delete loading[version];
      throw err;
    }
  })();

  loading[version] = promise;
  return promise;
}

/**
 * Eagerly load v2, v3 and v4 so the first gate call doesn't pay the
 * model-load cost inline. Errors are swallowed — if preload fails, the
 * next `gate()` will retry and surface the error to the caller.
 */
async function preloadModels(): Promise<void> {
  await Promise.allSettled([
    ensureModel("v2"),
    ensureModel("v3"),
    ensureModel("v4"),
  ]);
}

async function gate(params: {
  uri: string;
  threshold?: number;
  version?: ModerationModelVersion;
}): Promise<GateResult> {
  const { uri, threshold, version } = params;
  const resolvedVersion = version ?? (await getModerationModelVersion());

  await ensureModel(resolvedVersion);
  const model = models[resolvedVersion];
  if (!model) throw new Error(`TFJS model ${resolvedVersion} failed to load`);

  await yieldThread();

  const flat = await imageUriToFloatTensor_0_255({
    uri,
    width: INPUT_SIZE,
    height: INPUT_SIZE,
  });

  await yieldThread();

  const data = await new Promise<Float32Array | Int32Array | Uint8Array>(
    (resolve, reject) => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const input = tf.tensor4d(flat, [1, INPUT_SIZE, INPUT_SIZE, 3]);
          const output = model.predict(input) as tf.Tensor;
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

  switch (resolvedVersion) {
    case "v3":
      return decideV3FromProbs(data, threshold);
    case "v4":
      return decideV4FromProbs(data, threshold);
    default:
      return decideV2FromProbs(data, threshold);
  }
}

async function isAllowed(params: {
  uri: string;
  threshold?: number;
  version?: ModerationModelVersion;
}): Promise<boolean> {
  const r = await gate(params);
  return r.allowed;
}

export const tfjsService = { gate, isAllowed, preloadModels };
