import "react-native-get-random-values";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import { Asset } from "expo-asset";
import { Buffer } from "buffer";
import { Platform, InteractionManager } from "react-native";
import type { GateResult } from "./moderation.types";
import { imageUriToFloatTensor_0_255 } from "./image-to-tensor";
import { INPUT_SIZE } from "./moderation.constants";
import { decideV2FromProbs, decideV3FromProbs } from "./tfjs.decide";
import {
  getModerationModelVersion,
  type ModerationModelVersion,
} from "./model-version";

export {
  decideV2FromProbs,
  decideV3FromProbs,
  decideFromProbs,
  OTHER_CONFIDENCE_CEILING,
  SECONDARY_FOOD_THRESHOLD,
  V3_FOOD_THRESHOLD_DEFAULT,
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
/* eslint-enable @typescript-eslint/no-require-imports */

type LoadedModel = tf.GraphModel | tf.LayersModel;

interface ModelJson {
  modelTopology: object;
  weightsManifest: { weights: tf.io.WeightsManifestEntry[] }[];
  format?: string;
  generatedBy?: string;
  convertedBy?: string;
}

interface ModelSpec {
  format: "graph" | "layers";
  modelJson: ModelJson;
  /** Metro/Expo `require()` of a binary asset returns a numeric module id. */
  weights: number[];
}

const SPECS: Record<ModerationModelVersion, ModelSpec> = {
  v2: {
    format: "graph",
    modelJson: v2ModelJsonAsset,
    weights: v2WeightAssets,
  },
  v3: {
    format: "layers",
    modelJson: v3ModelJsonAsset,
    weights: v3WeightAssets,
  },
};

const models: Partial<Record<ModerationModelVersion, LoadedModel>> = {};
const loading: Partial<Record<ModerationModelVersion, Promise<void>>> = {};
let tfReady = false;

/** Yield to the JS thread so UI stays responsive */
function yieldThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Keras 3 exports a few fields in a shape `@tensorflow/tfjs` still doesn't
 * understand (as of 4.22):
 *
 *  - `InputLayer.config.batch_shape` instead of `batchInputShape`
 *  - `config.dtype` as a `DTypePolicy` dict `{ class_name: "DTypePolicy",
 *    config: { name: "float32" }}` instead of a plain `"float32"` string
 *
 * Without this rewrite, `tf.loadLayersModel` fails with
 * "An InputLayer should be passed either a `batchInputShape` or an
 * `inputShape`." on any Keras 3 export — which is exactly what the
 * MobileNetV3-Small binary food model on Hugging Face ships.
 *
 * The patcher walks the topology in place and fixes both fields on every
 * layer, including nested Functional sub-models.
 */
type AnyLayerConfig = Record<string, unknown>;

function flattenDtype(cfg: AnyLayerConfig): void {
  const dtype = cfg.dtype as
    | string
    | { class_name?: string; config?: { name?: string } }
    | undefined;
  if (dtype && typeof dtype === "object" && dtype.config?.name) {
    cfg.dtype = dtype.config.name;
  }
}

function renameBatchShape(cfg: AnyLayerConfig): void {
  if (Array.isArray(cfg.batch_shape) && cfg.batchInputShape === undefined) {
    cfg.batchInputShape = cfg.batch_shape;
    delete cfg.batch_shape;
  }
}

function patchLayersRecursively(layers: unknown): void {
  if (!Array.isArray(layers)) return;
  for (const layer of layers) {
    if (!layer || typeof layer !== "object") continue;
    const l = layer as { config?: AnyLayerConfig; class_name?: string };
    const cfg = l.config;
    if (!cfg) continue;
    flattenDtype(cfg);
    if (l.class_name === "InputLayer") renameBatchShape(cfg);
    const nested = cfg.layers;
    if (Array.isArray(nested)) patchLayersRecursively(nested);
  }
}

/**
 * Patch a Keras 3 `modelTopology` in place so that `tf.loadLayersModel` can
 * consume it. Idempotent — safe to call on already-patched topologies.
 * Exported for unit testing.
 */
export function patchKeras3TopologyForTfjs(topology: unknown): void {
  if (!topology || typeof topology !== "object") return;
  const root = topology as {
    model_config?: { config?: { layers?: unknown } };
  };
  const layers = root.model_config?.config?.layers;
  patchLayersRecursively(layers);
}

/**
 * Custom IOHandler: reads model.json from a bundled require() and
 * fetches weight shards from expo-asset URIs. Uses Asset.fromModule so
 * it works on both React Native (local file URI) and web (HTTP asset URL).
 */
function bundledAssetIO(spec: ModelSpec): tf.io.IOHandler {
  return {
    async load(): Promise<tf.io.ModelArtifacts> {
      if (spec.format === "layers") {
        patchKeras3TopologyForTfjs(spec.modelJson.modelTopology);
      }
      const modelTopology = spec.modelJson.modelTopology;
      const weightsManifest = spec.modelJson.weightsManifest;

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
      const spec = SPECS[version];
      const io = bundledAssetIO(spec);
      models[version] =
        spec.format === "graph"
          ? await tf.loadGraphModel(io)
          : await tf.loadLayersModel(io);
    } catch (err) {
      console.error(`[tfjs] ensureModel(${version}) failed:`, err);
      delete loading[version];
      throw err;
    }
  })();

  loading[version] = promise;
  return promise;
}

/**
 * Eagerly load both v2 and v3 so that the first gate call doesn't pay the
 * model-load cost inline. Errors are swallowed — if preload fails, the
 * next `gate()` will retry and surface the error to the caller.
 */
async function preloadModels(): Promise<void> {
  await Promise.allSettled([ensureModel("v2"), ensureModel("v3")]);
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

  return resolvedVersion === "v3"
    ? decideV3FromProbs(data, threshold)
    : decideV2FromProbs(data, threshold);
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
