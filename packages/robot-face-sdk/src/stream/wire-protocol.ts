import { createExpressionFrame, type ExpressionFrame } from "../expressions/frame.js";
import type { ExpressionSequence } from "../expressions/keyframes.js";
import { normalizeBlend, type ExpressionBlend } from "../expressions/blend.js";
import { EXPRESSION_PRIMITIVES } from "../expressions/primitives.js";
import type {
  PlaybackProgressSnapshot,
  PlaybackState,
} from "../expressions/playback.js";
import type { EasingName } from "../expressions/transitions.js";

export type WireExpressionFrame = ExpressionFrame;

export type WireClientMessage =
  | { type: "setExpression"; frame: WireExpressionFrame }
  | { type: "playSequence"; sequence: ExpressionSequence; loop?: boolean }
  | { type: "stopPlayback" }
  | { type: "pausePlayback" }
  | { type: "resumePlayback" }
  | { type: "seekPlayback"; localTimeMs: number }
  | { type: "identify"; label?: string }
  | { type: "ping" };

export type WireServerMessage =
  | {
      type: "hello";
      adapterId: string;
      platformLabel: string;
      connected: boolean;
      authRequired?: boolean;
    }
  | { type: "frame"; frame: WireExpressionFrame }
  | { type: "playbackState"; state: PlaybackState }
  | { type: "playbackProgress"; progress: PlaybackProgressSnapshot }
  | { type: "pong" }
  | {
      type: "presence";
      clientCount: number;
      clients: { id: string; label?: string }[];
    }
  | { type: "error"; message: string }
  | { type: "log"; line: string };

export type WireMessage = WireClientMessage | WireServerMessage;

export function parseWireMessage(raw: string): WireClientMessage {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Invalid JSON");
  }
  if (!data || typeof data !== "object" || !("type" in data)) {
    throw new Error("Message must have type");
  }
  const msg = data as Record<string, unknown>;
  switch (msg.type) {
    case "ping":
      return { type: "ping" };
    case "identify":
      return {
        type: "identify",
        label: typeof msg.label === "string" ? msg.label : undefined,
      };
    case "stopPlayback":
      return { type: "stopPlayback" };
    case "pausePlayback":
      return { type: "pausePlayback" };
    case "resumePlayback":
      return { type: "resumePlayback" };
    case "seekPlayback":
      if (typeof msg.localTimeMs !== "number") {
        throw new Error("seekPlayback.localTimeMs must be a number");
      }
      return { type: "seekPlayback", localTimeMs: msg.localTimeMs };
    case "setExpression":
      return { type: "setExpression", frame: parseFrame(msg.frame) };
    case "playSequence":
      return {
        type: "playSequence",
        sequence: parseSequence(msg.sequence),
        loop: msg.loop === true,
      };
    default:
      throw new Error(`Unknown message type: ${String(msg.type)}`);
  }
}

export function serializeWireMessage(message: WireMessage): string {
  return JSON.stringify(message);
}

export function parseFrame(value: unknown): ExpressionFrame {
  if (!value || typeof value !== "object") {
    throw new Error("frame must be an object");
  }
  const o = value as Record<string, unknown>;
  const blend = parseBlend(o.blend);
  const timing = o.timing as Record<string, unknown> | undefined;
  if (!timing || typeof timing.durationMs !== "number") {
    throw new Error("frame.timing.durationMs required");
  }
  return createExpressionFrame(blend, {
    durationMs: timing.durationMs,
    easing:
      timing.easing === "linear" ||
      timing.easing === "ease-in" ||
      timing.easing === "ease-out" ||
      timing.easing === "ease-in-out"
        ? timing.easing
        : undefined,
    timestampMs: typeof o.timestampMs === "number" ? o.timestampMs : Date.now(),
    sequenceId: typeof o.sequenceId === "string" ? o.sequenceId : undefined,
  });
}

function parseBlend(value: unknown): ExpressionBlend {
  if (!value || typeof value !== "object") {
    throw new Error("blend required");
  }
  const o = value as Record<string, unknown>;
  const weightsRaw = o.weights;
  if (!weightsRaw || typeof weightsRaw !== "object") {
    throw new Error("blend.weights required");
  }
  const weights = {} as ExpressionBlend["weights"];
  for (const p of EXPRESSION_PRIMITIVES) {
    const w = (weightsRaw as Record<string, unknown>)[p];
    weights[p] = typeof w === "number" ? w : 0;
  }
  const intensity = typeof o.intensity === "number" ? o.intensity : 1;
  return normalizeBlend({ weights, intensity });
}

export function parseSequence(value: unknown): ExpressionSequence {
  if (!value || typeof value !== "object") {
    throw new Error("sequence must be an object");
  }
  const o = value as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") {
    throw new Error("sequence.id and sequence.name required");
  }
  if (!Array.isArray(o.keyframes)) {
    throw new Error("sequence.keyframes must be array");
  }
  const keyframes = o.keyframes.map((kf, i) => {
    if (!kf || typeof kf !== "object") {
      throw new Error(`keyframes[${i}] invalid`);
    }
    const k = kf as Record<string, unknown>;
    if (typeof k.atMs !== "number") {
      throw new Error(`keyframes[${i}].atMs required`);
    }
    let easing: EasingName | undefined;
    if (
      k.easing === "linear" ||
      k.easing === "ease-in" ||
      k.easing === "ease-out" ||
      k.easing === "ease-in-out"
    ) {
      easing = k.easing as EasingName;
    }
    return {
      atMs: k.atMs,
      blend: parseBlend(k.blend),
      holdMs: typeof k.holdMs === "number" ? k.holdMs : undefined,
      easing,
    };
  });
  return {
    id: o.id,
    name: o.name,
    loop: o.loop === true,
    keyframes,
  };
}
