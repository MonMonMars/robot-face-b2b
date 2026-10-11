import type { ExpressionFrame } from "../expressions/frame.js";

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
 *
 * Point `url` at your edge translator that maps this to vendor SDK calls.
 */
export interface UnitreeBridgeConfig {
  url: string;
  mode: "http" | "ws";
  bearerToken?: string;
}

export type UnitreeBridgePayload = Record<string, unknown>;

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

export class FetchUnitreeBridgeTransport implements UnitreeBridgeTransport {
  async send(config: UnitreeBridgeConfig, payload: UnitreeBridgePayload): Promise<void> {
    if (config.mode === "ws") {
      await sendViaWebSocket(config, payload);
      return;
    }
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (config.bearerToken) {
      headers.authorization = `Bearer ${config.bearerToken}`;
    }
    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Unitree bridge HTTP ${res.status}: ${res.statusText}`);
    }
  }
}

let wsCache: { url: string; socket: import("ws").WebSocket } | undefined;

async function sendViaWebSocket(
  config: UnitreeBridgeConfig,
  payload: UnitreeBridgePayload,
): Promise<void> {
  const ws = await import("ws");
  if (!wsCache || wsCache.url !== config.url || wsCache.socket.readyState !== ws.WebSocket.OPEN) {
    wsCache?.socket.close();
    wsCache = {
      url: config.url,
      socket: new ws.WebSocket(config.url, {
        headers: config.bearerToken
          ? { authorization: `Bearer ${config.bearerToken}` }
          : undefined,
      }),
    };
    await new Promise<void>((resolve, reject) => {
      wsCache!.socket.once("open", () => resolve());
      wsCache!.socket.once("error", reject);
    });
  }
  wsCache.socket.send(JSON.stringify(payload));
}

/** Test hook: replace transport globally in unit tests. */
let transportOverride: UnitreeBridgeTransport | undefined;

export function setUnitreeBridgeTransportForTests(t: UnitreeBridgeTransport | undefined): void {
  transportOverride = t;
}

export async function sendUnitreeBridgeFrame(
  config: UnitreeBridgeConfig,
  model: string,
  frame: ExpressionFrame,
): Promise<void> {
  const payload = buildUnitreeBridgePayload(model, frame);
  const transport = transportOverride ?? new FetchUnitreeBridgeTransport();
  await transport.send(config, payload);
}

export function parseUnitreeBridgeFromCredentials(
  extras: Record<string, string>,
): UnitreeBridgeConfig | undefined {
  if (extras.unitreeBridge !== "1") return undefined;
  const url = extras.unitreeBridgeUrl;
  if (!url) {
    throw new Error("unitreeBridgeUrl required when unitreeBridge=1");
  }
  const mode = extras.unitreeBridgeMode === "ws" ? "ws" : "http";
  return {
    url,
    mode,
    bearerToken: extras.unitreeBridgeToken,
  };
}
