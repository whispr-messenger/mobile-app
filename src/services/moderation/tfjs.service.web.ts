import type { GateResult } from "./moderation.types";
import { imageUriToFloatTensor_0_255 } from "./image-to-tensor";
import { CLASS_NAMES, INPUT_SIZE } from "./moderation.constants";

type TF = typeof import("@tensorflow/tfjs");

let tf: TF | null = null;
let model: Awaited<ReturnType<TF["loadGraphModel"]>> | null = null;
let loading: Promise<void> | null = null;

async function ensureModel(): Promise<void> {
  if (model) return;
  if (loading) return loading;

  loading = (async () => {
    tf = await import("@tensorflow/tfjs");
    model = await tf.loadGraphModel("/models/tfjs/model.json");
  })();

  return loading;
}

async function gate(params: {
  uri: string;
  threshold?: number;
}): Promise<GateResult> {
  const { uri, threshold = 0.5 } = params;

  await ensureModel();
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

  return {
    allowed: true,
    reason: !isFoodClass ? "OTHER_CLASS" : "UNCERTAIN",
    bestIndex,
    bestProb: Number(bestProb),
    bestClass,
    probs,
  };
}

async function isAllowed(params: {
  uri: string;
  threshold?: number;
}): Promise<boolean> {
  const r = await gate(params);
  return r.allowed;
}

export const tfjsService = { gate, isAllowed };
