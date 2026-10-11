import type { ExpressionFrame } from "../expressions/frame.js";
import {
  parseBridgeFromCredentials,
  sendOemBridgePayload,
  setOemBridgeTransportForTests,
  type OemBridgeConfig,
  type OemBridgePayload,
} from "./oem-bridge-transport.js";

/**
 * Configurable humanoid OEM bridge — NOT a verified Tesla/Optimus protocol.
 *
 * **Payload shape** (`robot-face.humanoid-expression.v1`):
 * ```json
 * {
 *   "schema": "robot-face.humanoid-expression.v1",
 *   "platform": "optimus-class",
 *   "timestampMs": 1710000000000,
 *   "sequenceId": "optional",
 *   "weights": { "neutral": 0, "happiness": 1, "surprise": 0, "anger": 0, "sadness": 0 },
 *   "intensity": 1,
 *   "durationMs": 300,
 *   "timing": { "durationMs": 300, "easing": "ease-in-out" }
 * }
 * ```
 */
export type HumanoidBridgeConfig = OemBridgeConfig;
export type HumanoidBridgePayload = OemBridgePayload;

export function buildHumanoidBridgePayload(
  platform: string,
  frame: ExpressionFrame,
): HumanoidBridgePayload {
  return {
    schema: "robot-face.humanoid-expression.v1",
    platform,
    timestampMs: frame.timestampMs,
    sequenceId: frame.sequenceId,
    weights: frame.blend.weights,
    intensity: frame.blend.intensity,
    durationMs: frame.timing.durationMs,
    timing: frame.timing,
  };
}

export async function sendHumanoidBridgeFrame(
  config: HumanoidBridgeConfig,
  platform: string,
  frame: ExpressionFrame,
): Promise<void> {
  const payload = buildHumanoidBridgePayload(platform, frame);
  await sendOemBridgePayload(config, payload);
}

export function parseHumanoidBridgeFromCredentials(
  extras: Record<string, string>,
): HumanoidBridgeConfig | undefined {
  return parseBridgeFromCredentials(extras, "humanoid");
}

export { setOemBridgeTransportForTests as setHumanoidBridgeTransportForTests };
