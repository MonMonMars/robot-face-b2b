import {
  EXPRESSION_PRIMITIVES,
  type ExpressionPrimitive,
} from "./primitives.js";

export type BlendWeights = Record<ExpressionPrimitive, number>;

export interface ExpressionBlend {
  /** Per-primitive weights in [0, 1]. Should sum to ~1 for a normalized pose. */
  weights: BlendWeights;
  /** Global intensity multiplier in [0, 1]. */
  intensity: number;
}

export function createNeutralBlend(intensity = 1): ExpressionBlend {
  const weights = Object.fromEntries(
    EXPRESSION_PRIMITIVES.map((p) => [p, p === "neutral" ? 1 : 0]),
  ) as BlendWeights;
  return { weights, intensity: clamp01(intensity) };
}

export function createSinglePrimitiveBlend(
  primitive: ExpressionPrimitive,
  intensity = 1,
): ExpressionBlend {
  const weights = Object.fromEntries(
    EXPRESSION_PRIMITIVES.map((p) => [p, p === primitive ? 1 : 0]),
  ) as BlendWeights;
  return { weights, intensity: clamp01(intensity) };
}

/** Normalize weights so they sum to 1 (or all zero → neutral). */
export function normalizeBlend(blend: ExpressionBlend): ExpressionBlend {
  const sum = EXPRESSION_PRIMITIVES.reduce(
    (acc, p) => acc + Math.max(0, blend.weights[p]),
    0,
  );
  if (sum <= 0) {
    return createNeutralBlend(blend.intensity);
  }
  const weights = Object.fromEntries(
    EXPRESSION_PRIMITIVES.map((p) => [
      p,
      Math.max(0, blend.weights[p]) / sum,
    ]),
  ) as BlendWeights;
  return { weights, intensity: clamp01(blend.intensity) };
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
