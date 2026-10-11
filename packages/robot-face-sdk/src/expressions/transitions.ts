import {
  EXPRESSION_PRIMITIVES,
  type ExpressionPrimitive,
} from "./primitives.js";
import { clamp01, type BlendWeights, type ExpressionBlend } from "./blend.js";

export type EasingName = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export function ease(t: number, easing: EasingName = "linear"): number {
  const x = clamp01(t);
  switch (easing) {
    case "linear":
      return x;
    case "ease-in":
      return x * x;
    case "ease-out":
      return 1 - (1 - x) * (1 - x);
    case "ease-in-out":
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    default: {
      const _exhaustive: never = easing;
      return _exhaustive;
    }
  }
}

export function lerpWeights(
  from: BlendWeights,
  to: BlendWeights,
  t: number,
): BlendWeights {
  const u = clamp01(t);
  return Object.fromEntries(
    EXPRESSION_PRIMITIVES.map((p) => [
      p,
      from[p] * (1 - u) + to[p] * u,
    ]),
  ) as BlendWeights;
}

export function lerpBlend(
  from: ExpressionBlend,
  to: ExpressionBlend,
  t: number,
): ExpressionBlend {
  return {
    weights: lerpWeights(from.weights, to.weights, t),
    intensity: from.intensity * (1 - t) + to.intensity * t,
  };
}

export function blendAtPrimitive(
  primitive: ExpressionPrimitive,
  weight: number,
  intensity = 1,
): ExpressionBlend {
  const weights = Object.fromEntries(
    EXPRESSION_PRIMITIVES.map((p) => [p, p === primitive ? weight : 0]),
  ) as BlendWeights;
  return { weights, intensity: clamp01(intensity) };
}
