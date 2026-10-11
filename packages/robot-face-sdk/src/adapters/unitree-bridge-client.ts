import type { ExpressionFrame } from "../expressions/frame.js";
import {
  parseBridgeFromCredentials,
  sendOemBridgePayload,
  setOemBridgeTransportForTests,
  type OemBridgeConfig,
  type OemBridgePayload,
} from "./oem-bridge-transport.js";

/**
 * Configurable OEM bridge — NOT a verified Unitree protocol.
 *
 * **Documented payload shape** (JSON POST body or WS text frame):
 * ```json
 * {
 *   "schema": "robot-face.unitree-expression.v1",
 *   "model": "g1",
 *   "timestampMs": 1710000000000,
 *   "sequenceId": "optional",
 *   "weights": { "neutral": 0, "happiness": 1, "surprise": 0, "anger": 0, "sadness": 0 },
 *   "intensity": 1,
 *   "durationMs": 300
 * }
 * ```
 */
export type UnitreeBridgeConfig = OemBridgeConfig; // same wire transport shape
export type UnitreeBridgePayload = OemBridgePayload;

export function buildUnitreeBridgePayload(
  model: string,
  frame: ExpressionFrame,
): UnitreeBridgePayload {
  return {
    schema: "robot-face.unitree-expression.v1",
    model,
    timestampMs: frame.timestampMs,
    sequenceId: frame.sequenceId,
    weights: frame.blend.weights,
    intensity: frame.blend.intensity,
    durationMs: frame.timing.durationMs,
  };
}

export interface UnitreeBridgeTransport {
  send(config: UnitreeBridgeConfig, payload: UnitreeBridgePayload): Promise<void>;
}

export async function sendUnitreeBridgeFrame(
  config: UnitreeBridgeConfig,
  model: string,
  frame: ExpressionFrame,
): Promise<void> {
  const payload = buildUnitreeBridgePayload(model, frame);
  await sendOemBridgePayload(config, payload);
}

export function parseUnitreeBridgeFromCredentials(
  extras: Record<string, string>,
): UnitreeBridgeConfig | undefined {
  return parseBridgeFromCredentials(extras, "unitree");
}

export { setOemBridgeTransportForTests as setUnitreeBridgeTransportForTests };
