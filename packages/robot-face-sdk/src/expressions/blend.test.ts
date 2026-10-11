import { describe, expect, it } from "vitest";
import {
  createNeutralBlend,
  createSinglePrimitiveBlend,
  normalizeBlend,
} from "./blend.js";
import { EXPRESSION_PRIMITIVES } from "./primitives.js";

describe("expression blend", () => {
  it("creates neutral with full weight on neutral", () => {
    const blend = createNeutralBlend(0.8);
    expect(blend.weights.neutral).toBe(1);
    expect(blend.intensity).toBe(0.8);
    for (const p of EXPRESSION_PRIMITIVES) {
      if (p !== "neutral") expect(blend.weights[p]).toBe(0);
    }
  });

  it("normalizes arbitrary weights to sum to 1", () => {
    const blend = createSinglePrimitiveBlend("happiness", 1);
    blend.weights.happiness = 2;
    blend.weights.surprise = 2;
    const normalized = normalizeBlend(blend);
    const sum = EXPRESSION_PRIMITIVES.reduce(
      (acc, p) => acc + normalized.weights[p],
      0,
    );
    expect(sum).toBeCloseTo(1, 5);
    expect(normalized.weights.happiness).toBeCloseTo(0.5, 5);
  });

  it("falls back to neutral when all weights are zero", () => {
    const blend = createNeutralBlend(1);
    for (const p of EXPRESSION_PRIMITIVES) {
      blend.weights[p] = 0;
    }
    const normalized = normalizeBlend(blend);
    expect(normalized.weights.neutral).toBe(1);
  });
});
