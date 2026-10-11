import type { ExpressionBlend } from "./blend.js";
import type { EasingName } from "./transitions.js";

/** One pose on a timeline, relative to sequence start (ms). */
export interface ExpressionKeyframe {
  atMs: number;
  blend: ExpressionBlend;
  /** Transition from previous keyframe; first keyframe ignores. */
  easing?: EasingName;
  holdMs?: number;
}

export interface ExpressionSequence {
  id: string;
  name: string;
  keyframes: ExpressionKeyframe[];
  loop?: boolean;
}

export function sortKeyframes(keyframes: ExpressionKeyframe[]): ExpressionKeyframe[] {
  return [...keyframes].sort((a, b) => a.atMs - b.atMs);
}

export function sequenceDurationMs(sequence: ExpressionSequence): number {
  const sorted = sortKeyframes(sequence.keyframes);
  if (sorted.length === 0) return 0;
  const last = sorted[sorted.length - 1];
  return last.atMs + (last.holdMs ?? 0);
}
