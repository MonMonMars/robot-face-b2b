import { createNeutralBlend, createSinglePrimitiveBlend } from "./blend.js";
import type { ExpressionKeyframe } from "./keyframes.js";
import type { ExpressionSequence } from "./keyframes.js";
import type { ExpressionPrimitive } from "./primitives.js";

export interface ExpressionPreset {
  id: string;
  label: string;
  description: string;
  /** Instant pose */
  blend?: ReturnType<typeof createSinglePrimitiveBlend>;
  /** Optional animated sequence */
  sequence?: ExpressionSequence;
}

function kf(
  atMs: number,
  primitive: ExpressionPrimitive,
  intensity: number,
  holdMs = 0,
): ExpressionKeyframe {
  return {
    atMs,
    blend: createSinglePrimitiveBlend(primitive, intensity),
    holdMs,
    easing: "ease-in-out",
  };
}

export const BUILTIN_PRESETS: ExpressionPreset[] = [
  {
    id: "idle-neutral",
    label: "Idle neutral",
    description: "Default resting face",
    blend: createNeutralBlend(1),
  },
  {
    id: "greet-happy",
    label: "Greet (happy)",
    description: "Short welcoming smile",
    sequence: {
      id: "greet-happy",
      name: "Greet happy",
      loop: false,
      keyframes: [
        kf(0, "neutral", 1, 200),
        kf(200, "happiness", 0.85, 400),
        kf(600, "neutral", 1, 300),
      ],
    },
  },
  {
    id: "alert-surprise",
    label: "Alert surprise",
    description: "Quick surprise then neutral",
    sequence: {
      id: "alert-surprise",
      name: "Alert surprise",
      keyframes: [
        kf(0, "surprise", 1, 150),
        kf(150, "neutral", 1, 200),
      ],
    },
  },
  {
    id: "empathy-sad",
    label: "Empathy (sad)",
    description: "Soft sadness hold",
    blend: createSinglePrimitiveBlend("sadness", 0.65),
  },
  {
    id: "warning-anger",
    label: "Warning (anger)",
    description: "Firm anger pulse loop",
    sequence: {
      id: "warning-anger",
      name: "Warning anger",
      loop: true,
      keyframes: [
        kf(0, "anger", 0.4, 100),
        kf(100, "anger", 0.95, 200),
        kf(300, "anger", 0.35, 100),
        kf(400, "neutral", 1, 200),
      ],
    },
  },
  {
    id: "think-cycle",
    label: "Thinking cycle",
    description: "Neutral → surprise → neutral loop",
    sequence: {
      id: "think-cycle",
      name: "Thinking cycle",
      loop: true,
      keyframes: [
        kf(0, "neutral", 1, 500),
        kf(500, "surprise", 0.5, 400),
        kf(900, "neutral", 1, 500),
      ],
    },
  },
];

export function getPresetById(id: string): ExpressionPreset | undefined {
  return BUILTIN_PRESETS.find((p) => p.id === id);
}
