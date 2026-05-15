/**
 * V2: 9-class softmax (EfficientNet-B0 + custom head), includes a catch-all
 * "Other" label alongside the eight trained food classes.
 */
export const CLASS_NAMES_V2 = [
  "Baked Potato",
  "Burger",
  "Crispy Chicken",
  "Donut",
  "Fries",
  "Hot Dog",
  "Other",
  "Pizza",
  "Sandwich",
] as const;

/**
 * V3: single sigmoid unit outputting p(food). The two synthetic labels are
 * only used to build the `probs` map returned by `GateResult` so consumers
 * see a consistent shape across model versions.
 */
export const CLASS_NAMES_V3 = ["food", "not_food"] as const;

/** Index of the "food" class in CLASS_NAMES_V3 — used by decideV3FromProbs. */
export const V3_FOOD_INDEX = 0;

/**
 * V4: 3-class softmax (Keras layers-model). Order MUST match the model's
 * training-time output indices, as recorded in the model card
 * (assets/models/tfjsv2/.../metrics.json): [healthy, not_food, unhealthy].
 * Only `unhealthy` blocks the upload — healthy food and `not_food`
 * (everything else) are allowed.
 */
export const CLASS_NAMES_V4 = ["healthy", "not_food", "unhealthy"] as const;

/** Index of the blocking class in CLASS_NAMES_V4 — used by decideV4FromProbs. */
export const V4_UNHEALTHY_INDEX = 2;

/**
 * Backwards-compatible alias. A few existing modules and tests import
 * CLASS_NAMES expecting the V2 label set.
 */
export const CLASS_NAMES = CLASS_NAMES_V2;

export const INPUT_SIZE = 224;
