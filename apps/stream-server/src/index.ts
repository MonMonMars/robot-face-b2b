#!/usr/bin/env node
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  configToConnectionOptions,
  createRobotAdapter,
  ExpressionStreamHub,
  parseAdapterConfig,
  validateStreamToken,
  type RobotAdapterId,
} from "@robot-face/sdk";

const PORT = Number(process.env.PORT ?? 8765);
const HOST = process.env.HOST ?? "0.0.0.0";
const ADAPTER_ID = (process.env.ADAPTER ?? "mock") as RobotAdapterId;
const STREAM_TOKEN = process.env.STREAM_TOKEN?.trim() || undefined;

function unitreeCredentialsExtras(): Record<string, string> {
  const extras: Record<string, string> = {};
  if (process.env.UNITREE_BRIDGE === "1") {
    extras.unitreeBridge = "1";
    extras.unitreeBridgeUrl =
      process.env.UNITREE_BRIDGE_URL ?? "http://127.0.0.1:9870/expression/frame";
    extras.unitreeBridgeMode =
      process.env.UNITREE_BRIDGE_MODE === "ws" ? "ws" : "http";
    if (process.env.UNITREE_BRIDGE_TOKEN) {
      extras.unitreeBridgeToken = process.env.UNITREE_BRIDGE_TOKEN;
    }
  }
  return extras;
}

function adapterConnectOptions(id: RobotAdapterId) {
  if (id === "mock") return undefined;

  const bridgeExtras = unitreeCredentialsExtras();
  const unitreeDryRun =
    process.env.UNITREE_BRIDGE !== "1" || process.env.UNITREE_BRIDGE_DRY_RUN !== "0";

  if (id === "unitree") {
    const cfg = parseAdapterConfig({
      adapterId: "unitree",
      address: process.env.UNITREE_ADDRESS ?? "127.0.0.1",
      dryRun: unitreeDryRun,
      model: process.env.UNITREE_MODEL ?? "g1",
    });
    const opts = configToConnectionOptions(cfg);
    opts.credentials = { ...(opts.credentials ?? {}), ...bridgeExtras };
    return opts;
  }

  return configToConnectionOptions(
    parseAdapterConfig({
      adapterId: "humanoid-generic",
      address: process.env.BRIDGE_URL ?? "http://127.0.0.1:9840",
      dryRun: true,
      platform: "optimus-class",
    }),
  );
}

async function main(): Promise<void> {
  const adapter = createRobotAdapter(ADAPTER_ID);
  const hub = new ExpressionStreamHub(adapter, {
    authRequired: Boolean(STREAM_TOKEN),
    progressBroadcastHz: 10,
  });
  await hub.start(adapterConnectOptions(ADAPTER_ID));

  const httpServer = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        service: "robot-face-stream",
        adapter: ADAPTER_ID,
        connected: adapter.isConnected(),
        wsPath: "/stream",
        authRequired: Boolean(STREAM_TOKEN),
        unitreeBridge: process.env.UNITREE_BRIDGE === "1",
      }),
    );
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/stream")) {
      socket.destroy();
      return;
    }
    if (!validateStreamToken(req, STREAM_TOKEN)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket: WebSocket) => {
    const unsub = hub.subscribe((message) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(hub.serialize(message));
      }
    });

    socket.send(
      hub.serialize({
        type: "hello",
        adapterId: adapter.id,
        platformLabel: adapter.capabilities.platformLabel,
        connected: adapter.isConnected(),
        authRequired: Boolean(STREAM_TOKEN),
      }),
    );
    const snap = hub.getPlayback().getSnapshot();
    if (snap) {
      socket.send(
        hub.serialize({ type: "playbackProgress", progress: snap }),
      );
    }

    socket.on("message", (data) => {
      void hub.handleRawMessage(data.toString());
    });

    socket.on("close", () => {
      unsub();
    });
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(
      `Robot Face stream server  http://${HOST}:${PORT}  ws://${HOST}:${PORT}/stream  adapter=${ADAPTER_ID}  auth=${STREAM_TOKEN ? "on" : "off"}`,
    );
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
