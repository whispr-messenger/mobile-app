import type { GateResult } from "./moderation.types";
import { imageUriToFloatTensor_0_255 } from "./image-to-tensor";
import { INPUT_SIZE } from "./moderation.constants";
import { decideV2FromProbs, decideV3FromProbs } from "./tfjs.decide";
import {
  getModerationModelVersion,
  type ModerationModelVersion,
} from "./model-version";

type TF = typeof import("@tensorflow/tfjs");

let tf: TF | null = null;

const MODEL_URLS: Record<ModerationModelVersion, string> = {
  v2: "/models/tfjs/model.json",
  v3: "/models/v3-tfjs/model.json",
};

type LoadedModel = Awaited<ReturnType<TF["loadGraphModel"]>>;

const models: Partial<Record<ModerationModelVersion, LoadedModel>> = {};
const loading: Partial<Record<ModerationModelVersion, Promise<void>>> = {};

async function ensureModel(version: ModerationModelVersion): Promise<void> {
  if (models[version]) return;
  const inFlight = loading[version];
  if (inFlight) return inFlight;

  const promise = (async () => {
    if (!tf) tf = await import("@tensorflow/tfjs");
    models[version] = await tf.loadGraphModel(MODEL_URLS[version]);
  })();

  loading[version] = promise;
  return promise;
}

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
  if (!tf || !model) throw new Error("TFJS model failed to load");

  const flat = await imageUriToFloatTensor_0_255({
    uri,
    width: INPUT_SIZE,
    height: INPUT_SIZE,
  });

  const input = tf.tensor4d(flat, [1, INPUT_SIZE, INPUT_SIZE, 3]);
  const output = model.predict(input) as import("@tensorflow/tfjs").Tensor;
  const data = output.dataSync();

  input.dispose();
  output.dispose();

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
