/**
 * Tests for decideV3FromProbs — MobileNetV3 binary food decision.
 *
 * The v3 model emits a single sigmoid unit (length-1 tensor) representing
 * `p(food)`. decideV3FromProbs blocks when `p(food) >= threshold`.
 */

import {
  decideV3FromProbs,
  V3_FOOD_THRESHOLD_DEFAULT,
} from "./src/services/moderation/tfjs.decide";

describe("decideV3FromProbs", () => {
  it("blocks when p(food) is clearly above the default threshold", () => {
    const r = decideV3FromProbs(new Float32Array([0.92]));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("BLOCK_TRAINED_CLASS");
    expect(r.bestClass).toBe("food");
    expect(r.bestProb).toBeCloseTo(0.92);
  });

  it("allows when p(food) is clearly below the default threshold", () => {
    const r = decideV3FromProbs(new Float32Array([0.1]));
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("OTHER_CLASS");
    expect(r.bestClass).toBe("not_food");
    expect(r.bestProb).toBeCloseTo(0.9);
  });

  it("blocks exactly at the threshold boundary (p == threshold)", () => {
    const r = decideV3FromProbs(
      new Float32Array([V3_FOOD_THRESHOLD_DEFAULT]),
      V3_FOOD_THRESHOLD_DEFAULT,
    );
    expect(r.allowed).toBe(false);
  });

  it("honours a caller-supplied stricter threshold", () => {
    const r = decideV3FromProbs(new Float32Array([0.6]), 0.9);
    expect(r.allowed).toBe(true);
    expect(r.bestClass).toBe("not_food");
  });

  it("honours a caller-supplied permissive threshold", () => {
    const r = decideV3FromProbs(new Float32Array([0.2]), 0.1);
    expect(r.allowed).toBe(false);
    expect(r.bestClass).toBe("food");
  });

  it("returns a full probs map with both synthetic labels", () => {
    const r = decideV3FromProbs(new Float32Array([0.8]));
    expect(r.probs).toEqual({
      food: expect.closeTo(0.8),
      not_food: expect.closeTo(0.2),
    });
  });

  it("throws on an empty tensor", () => {
    expect(() => decideV3FromProbs(new Float32Array([]))).toThrow(
      /at least one value/,
    );
  });
});
