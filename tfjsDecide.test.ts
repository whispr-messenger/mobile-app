/**
 * Tests for decideFromProbs — the pure gate decision logic extracted from
 * tfjs.service.ts. No model loading, no native deps: we feed softmax outputs
 * directly and assert on the verdict.
 */

// Heavy native + TFJS imports in tfjs.service.ts need to be stubbed; Jest
// evaluates top-level imports before any test code runs.
jest.mock("@tensorflow/tfjs", () => ({
  setPlatform: jest.fn(),
  setBackend: jest.fn().mockResolvedValue(undefined),
  ready: jest.fn().mockResolvedValue(undefined),
  loadGraphModel: jest.fn(),
  tensor4d: jest.fn(),
}));
jest.mock("@tensorflow/tfjs-backend-cpu", () => ({}));
jest.mock("react-native-get-random-values", () => ({}));
jest.mock("expo-asset", () => ({
  Asset: { fromModule: jest.fn() },
}));
jest.mock(
  "./src/../assets/models/tfjs/model.json",
  () => ({
    format: "graph-model",
    modelTopology: {},
    weightsManifest: [{ paths: [], weights: [] }],
  }),
  { virtual: true },
);
jest.mock("./src/../assets/models/tfjs/group1-shard1of1.bin", () => ({}), {
  virtual: true,
});
jest.mock(
  "./src/../assets/models/v3-tfjs/model.json",
  () => ({
    format: "layers-model",
    modelTopology: {},
    weightsManifest: [{ paths: [], weights: [] }],
  }),
  { virtual: true },
);
jest.mock("./src/../assets/models/v3-tfjs/group1-shard1of1.bin", () => ({}), {
  virtual: true,
});
jest.mock(
  "./src/../assets/models/tfjsv2/model.json",
  () => ({
    format: "layers-model",
    modelTopology: {},
    weightsManifest: [{ paths: [], weights: [] }],
  }),
  { virtual: true },
);
jest.mock("./src/../assets/models/tfjsv2/group1-shard1of1.bin", () => ({}), {
  virtual: true,
});
jest.mock("./src/services/moderation/image-to-tensor", () => ({
  imageUriToFloatTensor_0_255: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

import { decideFromProbs } from "./src/services/moderation/tfjs.service";
import { CLASS_NAMES } from "./src/services/moderation/moderation.constants";

function probsFor(
  overrides: Partial<Record<(typeof CLASS_NAMES)[number], number>>,
): Float32Array {
  const out = new Float32Array(CLASS_NAMES.length);
  for (let i = 0; i < CLASS_NAMES.length; i++) {
    out[i] = overrides[CLASS_NAMES[i]] ?? 0;
  }
  return out;
}

describe("decideFromProbs", () => {
  it("allows when the top class is 'Other' regardless of confidence", () => {
    const data = probsFor({ Other: 0.98, Burger: 0.01 });
    const r = decideFromProbs(data);
    expect(r.allowed).toBe(true);
    expect(r.bestClass).toBe("Other");
    expect(r.reason).toBe("OTHER_CLASS");
  });

  it("blocks a junk food class above the default 0.3 threshold", () => {
    const data = probsFor({ Burger: 0.55, Other: 0.1 });
    const r = decideFromProbs(data);
    expect(r.allowed).toBe(false);
    expect(r.bestClass).toBe("Burger");
    expect(r.reason).toBe("BLOCK_TRAINED_CLASS");
  });

  it("blocks exactly at the threshold boundary (bestProb == threshold)", () => {
    const data = probsFor({ Pizza: 0.3, Other: 0.2 });
    const r = decideFromProbs(data, 0.3);
    expect(r.allowed).toBe(false);
    expect(r.bestClass).toBe("Pizza");
  });

  it("allows a food class whose confidence is below the threshold", () => {
    const data = probsFor({ Donut: 0.2, Other: 0.1 });
    const r = decideFromProbs(data, 0.3);
    expect(r.allowed).toBe(true);
    expect(r.bestClass).toBe("Donut");
    expect(r.reason).toBe("UNCERTAIN");
  });

  it("blocks every trained food class once above threshold (not just junk food)", () => {
    const trainedFoodClasses = CLASS_NAMES.filter((c) => c !== "Other");
    for (const cls of trainedFoodClasses) {
      const data = probsFor({ [cls]: 0.5 });
      const r = decideFromProbs(data);
      expect(r.allowed).toBe(false);
      expect(r.bestClass).toBe(cls);
    }
  });

  it("honours a caller-supplied higher threshold", () => {
    const data = probsFor({ Fries: 0.5, Other: 0.1 });
    const r = decideFromProbs(data, 0.7);
    expect(r.allowed).toBe(true);
    expect(r.bestClass).toBe("Fries");
    expect(r.reason).toBe("UNCERTAIN");
  });

  it("throws when the probability vector length mismatches CLASS_NAMES", () => {
    const data = new Float32Array([0.1, 0.2, 0.3]);
    expect(() => decideFromProbs(data)).toThrow(/Output length mismatch/);
  });

  it("returns the full probs dictionary for transparency in the appeal flow", () => {
    const data = probsFor({ Burger: 0.6, Pizza: 0.2, Other: 0.1 });
    const r = decideFromProbs(data);
    expect(r.probs).toBeDefined();
    expect(r.probs.Burger).toBeCloseTo(0.6);
    expect(r.probs.Pizza).toBeCloseTo(0.2);
    expect(r.probs.Other).toBeCloseTo(0.1);
  });

  it("blocks on a weak food signal when top-1 is 'Other' but not decisive", () => {
    // Real case from 25_potato.jpg: Other=0.807, Baked Potato=0.174.
    const data = probsFor({
      Other: 0.807,
      "Baked Potato": 0.174,
      Donut: 0.016,
    });
    const r = decideFromProbs(data);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("BLOCK_WEAK_FOOD_SIGNAL");
    expect(r.bestClass).toBe("Baked Potato");
  });

  it("allows when 'Other' is highly confident (> 0.85 ceiling)", () => {
    // Real case from 31_hotdog.jpg which is actually a 60m art installation:
    // the model is 100 % certain it's Other, so the weak-signal fallback
    // must NOT trigger and drag it back into the ban list.
    const data = probsFor({ Other: 0.95, Burger: 0.03, Pizza: 0.02 });
    const r = decideFromProbs(data);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("OTHER_CLASS");
  });

  it("allows when the runner-up food class is too weak to count", () => {
    const data = probsFor({ Other: 0.7, Burger: 0.1, Pizza: 0.1 });
    const r = decideFromProbs(data);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("OTHER_CLASS");
  });

  it("weak-signal fallback respects the 0.15 runner-up threshold at the boundary", () => {
    const data = probsFor({ Other: 0.5, Sandwich: 0.15, Donut: 0.15 });
    const r = decideFromProbs(data);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("BLOCK_WEAK_FOOD_SIGNAL");
  });
});
