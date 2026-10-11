import { describe, expect, it } from "vitest";
import { createSinglePrimitiveBlend } from "./blend.js";
import type { ExpressionSequence } from "./keyframes.js";
import { ExpressionPlayback } from "./playback.js";
import { ease } from "./transitions.js";

describe("ExpressionPlayback", () => {
  it("samples between keyframes with easing", () => {
    const playback = new ExpressionPlayback();
    const sequence: ExpressionSequence = {
      id: "t",
      name: "t",
      keyframes: [
        {
          atMs: 0,
          blend: createSinglePrimitiveBlend("neutral", 1),
          holdMs: 0,
        },
        {
          atMs: 100,
          blend: createSinglePrimitiveBlend("happiness", 1),
          easing: "linear",
        },
      ],
    };
    const mid = playback.sampleAt(sequence, 50);
    expect(mid.weights.happiness).toBeGreaterThan(0.3);
    expect(mid.weights.happiness).toBeLessThan(0.7);
  });

  it("ease helpers clamp and reach endpoints", () => {
    expect(ease(0, "linear")).toBe(0);
    expect(ease(1, "linear")).toBe(1);
  });
});
