/**
 * Canonical expression primitives supported across robot adapters.
 * Adapters map these to vendor-specific actuators or blend shapes.
 */
export const EXPRESSION_PRIMITIVES = [
  "neutral",
  "happiness",
  "surprise",
  "anger",
  "sadness",
] as const;

export type ExpressionPrimitive = (typeof EXPRESSION_PRIMITIVES)[number];

export function isExpressionPrimitive(value: string): value is ExpressionPrimitive {
  return (EXPRESSION_PRIMITIVES as readonly string[]).includes(value);
}
