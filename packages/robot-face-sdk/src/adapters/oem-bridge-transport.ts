export interface OemBridgeConfig {
  url: string;
  mode: "http" | "ws";
  bearerToken?: string;
}
export type OemBridgePayload = Record<string, unknown>;

export interface OemBridgeTransport {
  send(config: OemBridgeConfig, payload: OemBridgePayload): Promise<void>;
}

let transportOverride: OemBridgeTransport | undefined;
let wsCache: { url: string; socket: import("ws").WebSocket } | undefined;

export function setOemBridgeTransportForTests(t: OemBridgeTransport | undefined): void {
  transportOverride = t;
}

export class FetchOemBridgeTransport implements OemBridgeTransport {
  async send(config: OemBridgeConfig, payload: OemBridgePayload): Promise<void> {
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
      throw new Error(`OEM bridge HTTP ${res.status}: ${res.statusText}`);
    }
  }
}

async function sendViaWebSocket(
  config: OemBridgeConfig,
  payload: OemBridgePayload,
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

export async function sendOemBridgePayload(
  config: OemBridgeConfig,
  payload: OemBridgePayload,
): Promise<void> {
  const transport = transportOverride ?? new FetchOemBridgeTransport();
  await transport.send(config, payload);
}

export function parseBridgeFromCredentials(
  extras: Record<string, string>,
  prefix: "unitree" | "humanoid",
): OemBridgeConfig | undefined {
  const flag = extras[`${prefix}Bridge`];
  if (flag !== "1") return undefined;
  const url = extras[`${prefix}BridgeUrl`];
  if (!url) {
    throw new Error(`${prefix}BridgeUrl required when ${prefix}Bridge=1`);
  }
  const mode = extras[`${prefix}BridgeMode`] === "ws" ? "ws" : "http";
  return {
    url,
    mode,
    bearerToken: extras[`${prefix}BridgeToken`],
  };
}
