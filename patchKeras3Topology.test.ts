/**
 * Tests for patchKeras3TopologyForTfjs — the in-place Keras 3 → tfjs shim.
 *
 * Keras 3 exports InputLayers with `batch_shape` and `dtype` as a
 * DTypePolicy dict. `@tensorflow/tfjs`'s LayersModel loader only understands
 * the older `batchInputShape` + plain `"float32"` string shapes. The patch
 * rewrites both, including inside nested Functional sub-models.
 */

jest.mock("@tensorflow/tfjs", () => ({
  setPlatform: jest.fn(),
  setBackend: jest.fn().mockResolvedValue(undefined),
  ready: jest.fn().mockResolvedValue(undefined),
  loadGraphModel: jest.fn(),
  loadLayersModel: jest.fn(),
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
jest.mock("./src/services/moderation/image-to-tensor", () => ({
  imageUriToFloatTensor_0_255: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

import { patchKeras3TopologyForTfjs } from "./src/services/moderation/tfjs.service";

describe("patchKeras3TopologyForTfjs", () => {
  it("rewrites batch_shape to batchInputShape on top-level InputLayer", () => {
    const topology = {
      model_config: {
        config: {
          layers: [
            {
              class_name: "InputLayer",
              config: { batch_shape: [null, 224, 224, 3], name: "input_0" },
            },
            {
              class_name: "Dense",
              config: { units: 1, activation: "sigmoid" },
            },
          ],
        },
      },
    };

    patchKeras3TopologyForTfjs(topology);

    const inputCfg = topology.model_config.config.layers[0].config as {
      batch_shape?: unknown;
      batchInputShape?: unknown;
    };
    expect(inputCfg.batch_shape).toBeUndefined();
    expect(inputCfg.batchInputShape).toEqual([null, 224, 224, 3]);
  });

  it("flattens the DTypePolicy dict into a plain string", () => {
    const topology = {
      model_config: {
        config: {
          layers: [
            {
              class_name: "InputLayer",
              config: {
                batch_shape: [null, 224, 224, 3],
                dtype: {
                  module: "keras",
                  class_name: "DTypePolicy",
                  config: { name: "float32" },
                },
              },
            },
          ],
        },
      },
    };

    patchKeras3TopologyForTfjs(topology);

    const cfg = topology.model_config.config.layers[0].config as {
      dtype?: unknown;
    };
    expect(cfg.dtype).toBe("float32");
  });

  it("recurses into nested Functional sub-models", () => {
    const topology = {
      model_config: {
        config: {
          layers: [
            { class_name: "InputLayer", config: { batch_shape: [null, 3] } },
            {
              class_name: "Functional",
              config: {
                name: "MobileNetV3Small",
                layers: [
                  {
                    class_name: "InputLayer",
                    config: { batch_shape: [null, 224, 224, 3] },
                  },
                  {
                    class_name: "Rescaling",
                    config: {
                      scale: 0.00784,
                      offset: -1,
                      dtype: {
                        class_name: "DTypePolicy",
                        config: { name: "float32" },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };

    patchKeras3TopologyForTfjs(topology);

    const inner = (
      topology.model_config.config.layers[1] as {
        config: { layers: { class_name: string; config: Record<string, unknown> }[] };
      }
    ).config.layers;
    const innerInput = inner[0].config as {
      batch_shape?: unknown;
      batchInputShape?: unknown;
    };
    expect(innerInput.batchInputShape).toEqual([null, 224, 224, 3]);
    expect(innerInput.batch_shape).toBeUndefined();
    expect(inner[1].config.dtype).toBe("float32");
  });

  it("is idempotent on already-patched topologies", () => {
    const topology = {
      model_config: {
        config: {
          layers: [
            {
              class_name: "InputLayer",
              config: {
                batchInputShape: [null, 224, 224, 3],
                dtype: "float32",
              },
            },
          ],
        },
      },
    };

    patchKeras3TopologyForTfjs(topology);
    patchKeras3TopologyForTfjs(topology);

    const cfg = topology.model_config.config.layers[0].config as {
      batchInputShape?: unknown;
      dtype?: unknown;
    };
    expect(cfg.batchInputShape).toEqual([null, 224, 224, 3]);
    expect(cfg.dtype).toBe("float32");
  });

  it("no-ops on a non-object topology", () => {
    expect(() => patchKeras3TopologyForTfjs(null)).not.toThrow();
    expect(() => patchKeras3TopologyForTfjs(undefined)).not.toThrow();
    expect(() => patchKeras3TopologyForTfjs("string")).not.toThrow();
  });

  it("does not disturb non-InputLayer batch_shape-like fields", () => {
    const topology = {
      model_config: {
        config: {
          layers: [
            {
              class_name: "Dense",
              config: { units: 8, batch_shape: "noise" },
            },
          ],
        },
      },
    };

    patchKeras3TopologyForTfjs(topology);

    const cfg = topology.model_config.config.layers[0].config as {
      batch_shape?: unknown;
      batchInputShape?: unknown;
    };
    expect(cfg.batch_shape).toBe("noise");
    expect(cfg.batchInputShape).toBeUndefined();
  });
});
