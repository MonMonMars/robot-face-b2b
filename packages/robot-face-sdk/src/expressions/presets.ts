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
    id: "sales-wave",
    label: "Sales wave",
    description: "Friendly loop for booth demos",
    sequence: {
      id: "sales-wave",
      name: "Sales wave",
      loop: true,
      keyframes: [
        kf(0, "neutral", 1, 300),
        kf(300, "happiness", 0.75, 400),
        kf(700, "happiness", 0.95, 200),
        kf(900, "neutral", 1, 400),
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
    id: "listening-attentive",
    label: "Listening",
    description: "Subtle attentive pulse for voice UX",
    sequence: {
      id: "listening-attentive",
      name: "Listening",
      loop: true,
      keyframes: [
        kf(0, "neutral", 1, 600),
        kf(600, "surprise", 0.35, 350),
        kf(950, "neutral", 1, 600),
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
    id: "error-concern",
    label: "Error / concern",
    description: "Surprise + sadness for failure states",
    sequence: {
      id: "error-concern",
      name: "Error concern",
      loop: false,
      keyframes: [
        kf(0, "surprise", 0.7, 200),
        kf(200, "sadness", 0.75, 500),
        kf(700, "neutral", 1, 300),
      ],
    },
  },
  {
    id: "celebrate",
    label: "Celebrate",
    description: "High-energy happiness burst for success moments",
    sequence: {
      id: "celebrate",
      name: "Celebrate",
      keyframes: [
        kf(0, "happiness", 0.5, 100),
        kf(100, "happiness", 1, 450),
        kf(550, "surprise", 0.6, 150),
        kf(700, "happiness", 0.85, 400),
        kf(1100, "neutral", 1, 250),
      ],
    },
  },
  {
    id: "farewell",
    label: "Farewell",
    description: "Warm goodbye smile fading to neutral",
    sequence: {
      id: "farewell",
      name: "Farewell",
      keyframes: [
        kf(0, "happiness", 0.9, 500),
        kf(500, "happiness", 0.55, 400),
        kf(900, "neutral", 1, 400),
      ],
    },
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
  {
    id: "demo-showcase",
    label: "Demo showcase",
    description: "Cycles primitives for sales walkthrough",
    sequence: {
      id: "demo-showcase",
      name: "Demo showcase",
      loop: true,
      keyframes: [
        kf(0, "happiness", 0.85, 400),
        kf(400, "surprise", 0.8, 350),
        kf(750, "neutral", 1, 300),
        kf(1050, "sadness", 0.5, 350),
        kf(1400, "anger", 0.45, 300),
        kf(1700, "neutral", 1, 400),
      ],
    },
  },
];

export function getPresetById(id: string): ExpressionPreset | undefined {
  return BUILTIN_PRESETS.find((p) => p.id === id);
}
