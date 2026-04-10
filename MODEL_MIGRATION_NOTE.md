# Expo Go Moderation Migration Note

## 1) Removed/disabled native TFLite crash points

- Removed dependency: `react-native-fast-tflite`
- Deleted native entry files:
  - `src/services/moderation/tflite.service.native.ts`
  - `src/services/moderation/tflite.service.web.ts`
- Replaced moderation implementation with Expo-compatible JS service:
  - `src/services/moderation/tflite.service.ts`
  - `src/services/tfjsModel.ts`
- Chat screen only preloads moderation (`warmup`) for image send; no demo UI card.

These changes prevent `TurboModuleRegistry.getEnforcing(...): 'Tflite' could not be found` because no runtime import or call to the native TFLite module remains.

## 2) Why `.tflite` cannot be directly loaded by tfjs

- `.tflite` is a TensorFlow Lite flatbuffer format targeted for TFLite runtimes.
- `@tensorflow/tfjs` expects TensorFlow.js model artifacts (typically `model.json` + shard weights), not `.tflite` files.
- Therefore, we keep `.tflite` as an asset for future migration reference, but do not load it in Expo Go runtime.

## 3) Current placeholder approach (Expo Go compatible)

- **不**使用 `@tensorflow/tfjs-react-native`（会间接解析 `react-native-fs`，导致 Expo Go 打包失败）。
- **不**使用 `expo-gl` / 任何 RN 原生 ML 适配层；`src/services/tfjsModel.ts` 为 **纯 TypeScript deterministic mock**。
- 模块 `src/services/tfjsModel.ts` 仍提供同名接口：
  - `initTensorflow()`
  - `loadDemoModel()`
  - `runInference(input)`
- 占位逻辑：对输入做简单确定性哈希式分布，**不是**真实模型推理；业务侧阈值与类别名仍可与后续真实模型对齐。

## 4) Existing `.tflite` model assumptions captured

From previous native implementation:

- Model file: `assets/models/whispr.tflite`
- Input shape intent: `224 x 224 x 3`
- Input preprocessing:
  - Resize image to `224x224`
  - Decode JPEG
  - RGB channels only
  - Value range `0..255` (no normalization to `0..1`)
- Output expectation:
  - Single probability vector of length `7`
  - Class order:
    1. `Baked Potato`
    2. `Burger`
    3. `Crispy Chicken`
    4. `Donut`
    5. `Fries`
    6. `Hot Dog`
    7. `Pizza`
- Decision rule:
  - If best probability `>= 0.99`, block as `BLOCK_TRAINED_CLASS`
  - Else allow as `UNCERTAIN`

## 5) What is still required for real tfjs inference later

To restore real model inference in Expo Go, provide one of:

- A TensorFlow.js model bundle (`model.json` + weight files), or
- Source model format convertible to tfjs (`SavedModel`, `Keras`, `ONNX`, etc.) and conversion pipeline.

Then replace demo logic in `src/services/tfjsModel.ts` with actual model loading + real output parsing while keeping existing moderation service interface.
