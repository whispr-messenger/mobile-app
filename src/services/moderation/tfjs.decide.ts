import type { GateResult } from "./moderation.types";
import {
  CLASS_NAMES_V2,
  CLASS_NAMES_V3,
  V3_FOOD_INDEX,
} from "./moderation.constants";

/**
 * Pure decision functions shared between the native and web `tfjs.service`
 * variants. No TensorFlow / React Native imports so these can run in plain
 * Jest (no jest-expo preset) and be reused from the web bundle without
 * pulling in the native platform shims.
 */

export const OTHER_CONFIDENCE_CEILING = 0.85;
export const SECONDARY_FOOD_THRESHOLD = 0.15;
export const V3_FOOD_THRESHOLD_DEFAULT = 0.5;

/**
 * V2 decision: 9-class softmax (8 food classes + "Other"), with a runner-up
 * weak-signal fallback for ambiguous shots the top-1 slot labelled "Other".
 */
export function decideV2FromProbs(
  data: ArrayLike<number>,
  threshold = 0.3,
): GateResult {
  if (data.length !== CLASS_NAMES_V2.length) {
    throw new Error(
      `Output length mismatch: got ${data.length}, expected ${CLASS_NAMES_V2.length}.`,
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

  const bestClass = CLASS_NAMES_V2[bestIndex];

  const probs: Record<string, number> = {};
  for (let i = 0; i < CLASS_NAMES_V2.length; i++) {
    probs[CLASS_NAMES_V2[i]] = Number(data[i]);
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
      if (CLASS_NAMES_V2[i] === "Other") continue;
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
        bestClass: CLASS_NAMES_V2[runnerUpIndex],
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

/**
 * V3 decision: MobileNetV3-Small with a single sigmoid unit outputting
 * p(food). Block when p(food) >= threshold (default 0.5).
 */
export function decideV3FromProbs(
  data: ArrayLike<number>,
  threshold = V3_FOOD_THRESHOLD_DEFAULT,
): GateResult {
  if (data.length < 1) {
    throw new Error("V3 output must contain at least one value");
  }
  const pFood = Number(data[0]);
  const pNotFood = 1 - pFood;
  const isFood = pFood >= threshold;
  const [foodLabel, notFoodLabel] = CLASS_NAMES_V3;
  const probs: Record<string, number> = {
    [foodLabel]: pFood,
    [notFoodLabel]: pNotFood,
  };

  if (isFood) {
    return {
      allowed: false,
      reason: "BLOCK_TRAINED_CLASS",
      bestIndex: V3_FOOD_INDEX,
      bestProb: pFood,
      bestClass: foodLabel,
      probs,
    };
  }

  return {
    allowed: true,
    reason: "OTHER_CLASS",
    bestIndex: 1 - V3_FOOD_INDEX,
    bestProb: pNotFood,
    bestClass: notFoodLabel,
    probs,
  };
}

/**
 * Backwards-compatible alias — earlier call sites and tests import this
 * symbol expecting V2 behaviour.
 */
export const decideFromProbs = decideV2FromProbs;
