import type { GateResult } from "./moderation.types";
import { imageUriToFloatTensor_0_255 } from "./image-to-tensor";
import { INPUT_SIZE } from "./moderation.constants";
import { decideV2FromProbs, decideV3FromProbs } from "./tfjs.decide";
import {
  getModerationModelVersion,
  type ModerationModelVersion,
} from "./model-version";

// scope reduce: import core + converter + webgl au lieu du bundle complet @tensorflow/tfjs
// (le bundle full = ~500KB min+gzip non tree-shakeable, on n'a besoin que de loadGraphModel + tensor4d)
type TFCore = typeof import("@tensorflow/tfjs-core");
type TFConverter = typeof import("@tensorflow/tfjs-converter");

let tfCore: TFCore | null = null;
let tfConverter: TFConverter | null = null;

const MODEL_URLS: Record<ModerationModelVersion, string> = {
  v2: "/models/tfjs/model.json",
  v3: "/models/v3-tfjs/model.json",
};

type LoadedModel = Awaited<ReturnType<TFConverter["loadGraphModel"]>>;

const models: Partial<Record<ModerationModelVersion, LoadedModel>> = {};
const loading: Partial<Record<ModerationModelVersion, Promise<void>>> = {};

async function ensureModel(version: ModerationModelVersion): Promise<void> {
  if (models[version]) return;
  const inFlight = loading[version];
  if (inFlight) return inFlight;

  const promise = (async () => {
    if (!tfCore || !tfConverter) {
      const [core, converter] = await Promise.all([
        import("@tensorflow/tfjs-core"),
        import("@tensorflow/tfjs-converter"),
        import("@tensorflow/tfjs-backend-webgl"),
      ]);
      tfCore = core;
      tfConverter = converter;
      await tfCore.setBackend("webgl");
      await tfCore.ready();
    }
    models[version] = await tfConverter.loadGraphModel(MODEL_URLS[version]);
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
  if (!tfCore || !model) throw new Error("TFJS model failed to load");

  const flat = await imageUriToFloatTensor_0_255({
    uri,
    width: INPUT_SIZE,
    height: INPUT_SIZE,
  });

  const input = tfCore.tensor4d(flat, [1, INPUT_SIZE, INPUT_SIZE, 3]);
  const output = model.predict(input) as import("@tensorflow/tfjs-core").Tensor;
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
