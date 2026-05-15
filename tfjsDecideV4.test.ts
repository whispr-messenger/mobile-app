/**
 * Tests for decideV4FromProbs — 3-class softmax over
 * [healthy, not_food, unhealthy] (order from metrics.json). Only
 * `unhealthy` (index 2) blocks.
 */

import {
  decideV4FromProbs,
  V4_UNHEALTHY_THRESHOLD_DEFAULT,
} from "./src/services/moderation/tfjs.decide";

describe("decideV4FromProbs", () => {
  it("blocks when unhealthy is top-1 and above the default threshold", () => {
    const r = decideV4FromProbs(new Float32Array([0.05, 0.05, 0.9]));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("BLOCK_TRAINED_CLASS");
    expect(r.bestClass).toBe("unhealthy");
    expect(r.bestIndex).toBe(2);
    expect(r.bestProb).toBeCloseTo(0.9);
  });

  it("allows when healthy is top-1", () => {
    const r = decideV4FromProbs(new Float32Array([0.8, 0.05, 0.15]));
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("OTHER_CLASS");
    expect(r.bestClass).toBe("healthy");
  });

  it("allows when not_food is top-1", () => {
    const r = decideV4FromProbs(new Float32Array([0.1, 0.7, 0.2]));
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("OTHER_CLASS");
    expect(r.bestClass).toBe("not_food");
  });

  it("allows when unhealthy is top-1 but below the threshold", () => {
    const r = decideV4FromProbs(new Float32Array([0.3, 0.3, 0.4]), 0.5);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("UNCERTAIN");
    expect(r.bestClass).toBe("unhealthy");
  });

  it("blocks exactly at the threshold boundary (p == threshold)", () => {
    const r = decideV4FromProbs(
      new Float32Array([0.25, 0.25, V4_UNHEALTHY_THRESHOLD_DEFAULT]),
      V4_UNHEALTHY_THRESHOLD_DEFAULT,
    );
    expect(r.allowed).toBe(false);
  });

  it("honours a caller-supplied stricter threshold", () => {
    const r = decideV4FromProbs(new Float32Array([0.1, 0.3, 0.6]), 0.9);
    expect(r.allowed).toBe(true);
    expect(r.bestClass).toBe("unhealthy");
    expect(r.reason).toBe("UNCERTAIN");
  });

  it("honours a caller-supplied permissive threshold (top-1 not_food)", () => {
    const r = decideV4FromProbs(new Float32Array([0.05, 0.75, 0.2]), 0.1);
    expect(r.allowed).toBe(true);
    expect(r.bestClass).toBe("not_food");
  });

  it("blocks when unhealthy is top-1 even by a tiny margin, above threshold", () => {
    const r = decideV4FromProbs(new Float32Array([0.49, 0.0, 0.51]), 0.5);
    expect(r.allowed).toBe(false);
    expect(r.bestClass).toBe("unhealthy");
  });

  it("returns a full probs map keyed by class name", () => {
    const r = decideV4FromProbs(new Float32Array([0.2, 0.1, 0.7]));
    expect(r.probs).toEqual({
      healthy: expect.closeTo(0.2),
      not_food: expect.closeTo(0.1),
      unhealthy: expect.closeTo(0.7),
    });
  });

  it("throws when the output length does not match the class count", () => {
    expect(() => decideV4FromProbs(new Float32Array([0.5, 0.5]))).toThrow(
      /length mismatch/,
    );
    expect(() =>
      decideV4FromProbs(new Float32Array([0.25, 0.25, 0.25, 0.25])),
    ).toThrow(/length mismatch/);
  });
});
