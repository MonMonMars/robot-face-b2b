import type { ExpressionBlend } from "./blend.js";
import { normalizeBlend } from "./blend.js";

export interface ExpressionTiming {
  /** Duration to hold or transition toward this frame, in milliseconds. */
  durationMs: number;
  /** Easing hint for adapters that interpolate (optional). */
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

export interface ExpressionFrame {
  blend: ExpressionBlend;
  timing: ExpressionTiming;
  /** Monotonic or wall-clock ms; used for ordering and sync. */
  timestampMs: number;
  /** Optional client correlation id. */
  sequenceId?: string;
}

export function createExpressionFrame(
  blend: ExpressionBlend,
  options: {
    durationMs?: number;
    timestampMs?: number;
    easing?: ExpressionTiming["easing"];
    sequenceId?: string;
  } = {},
): ExpressionFrame {
  return {
    blend: normalizeBlend(blend),
    timing: {
      durationMs: Math.max(0, options.durationMs ?? 300),
      easing: options.easing ?? "ease-in-out",
    },
    timestampMs: options.timestampMs ?? Date.now(),
    sequenceId: options.sequenceId,
  };
}
