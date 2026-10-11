#!/usr/bin/env node
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  configToConnectionOptions,
  createRobotAdapter,
  createStreamClientId,
  ExpressionStreamHub,
  parseAdapterConfig,
  readStreamServerGuardConfig,
  StreamConnectionGuard,
  StreamPresenceTracker,
  validateStreamToken,
  type RobotAdapterId,
} from "@robot-face/sdk";
import {
  handleStreamHttpRequest,
  readSequenceStoreConfig,
  SequenceFilesystemStore,
  StreamMetricsCollector,
} from "@robot-face/sdk/server";

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

function humanoidCredentialsExtras(): Record<string, string> {
  const extras: Record<string, string> = {};
  if (process.env.HUMANOID_BRIDGE === "1") {
    extras.humanoidBridge = "1";
    extras.humanoidBridgeUrl =
      process.env.HUMANOID_BRIDGE_URL ??
      "http://127.0.0.1:9841/v1/expression/frame";
    extras.humanoidBridgeMode =
      process.env.HUMANOID_BRIDGE_MODE === "ws" ? "ws" : "http";
    if (process.env.HUMANOID_BRIDGE_TOKEN) {
      extras.humanoidBridgeToken = process.env.HUMANOID_BRIDGE_TOKEN;
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

  const humanoidDryRun =
    process.env.HUMANOID_BRIDGE !== "1" ||
    process.env.HUMANOID_BRIDGE_DRY_RUN !== "0";
  const cfg = parseAdapterConfig({
    adapterId: "humanoid-generic",
    address: process.env.BRIDGE_URL ?? "http://127.0.0.1:9840",
    dryRun: humanoidDryRun,
    platform: "optimus-class",
  });
  const opts = configToConnectionOptions(cfg);
  opts.credentials = {
    ...(opts.credentials ?? {}),
    ...humanoidCredentialsExtras(),
  };
  return opts;
}

async function main(): Promise<void> {
  const guardConfig = readStreamServerGuardConfig();
  const connectionGuard = new StreamConnectionGuard(guardConfig);
  const presenceTracker = new StreamPresenceTracker();
  const metrics = new StreamMetricsCollector();
  const sequenceStoreConfig = readSequenceStoreConfig();
  const sequenceStore = new SequenceFilesystemStore(sequenceStoreConfig);
  await sequenceStore.ensureReady();

  const adapter = createRobotAdapter(ADAPTER_ID);
  const hub = new ExpressionStreamHub(adapter, {
    authRequired: Boolean(STREAM_TOKEN),
    progressBroadcastHz: 10,
  });
  await hub.start(adapterConnectOptions(ADAPTER_ID));

  const httpCtx = {
    adapter,
    adapterId: ADAPTER_ID,
    streamToken: STREAM_TOKEN,
    guardConfig,
    connectionGuard,
    presenceTracker,
    sequenceStore,
    sequenceStoreDir: sequenceStoreConfig.directory,
    metrics,
  };

  const httpServer = createServer((req, res) => {
    void handleStreamHttpRequest(req, res, httpCtx);
  });

  const wss = new WebSocketServer({ noServer: true });

  const broadcastPresence = (): void => {
    const raw = hub.serialize(presenceTracker.toPresenceMessage());
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(raw);
      }
    }
  };

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
    if (!connectionGuard.canAcceptConnection()) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket: WebSocket) => {
    connectionGuard.registerClient();
    let lastInboundAt = 0;
    const clientId = createStreamClientId();
    presenceTracker.register(clientId);

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
    broadcastPresence();

    socket.on("message", (data) => {
      metrics.recordInboundMessage();
      if (!connectionGuard.checkMessageRate(lastInboundAt)) {
        socket.send(
          hub.serialize({
            type: "error",
            message: "Rate limit: messages too fast (see STREAM_MIN_MESSAGE_MS)",
          }),
        );
        return;
      }
      lastInboundAt = Date.now();

      const text = data.toString();
      try {
        const peek = JSON.parse(text) as { type?: string; label?: string };
        if (peek.type === "identify") {
          presenceTracker.setLabel(
            clientId,
            typeof peek.label === "string" ? peek.label : undefined,
          );
          broadcastPresence();
          return;
        }
      } catch {
        // hub handles invalid JSON
      }

      void hub.handleRawMessage(text);
    });

    socket.on("close", () => {
      unsub();
      connectionGuard.unregisterClient();
      presenceTracker.unregister(clientId);
      broadcastPresence();
    });
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(
      `Robot Face stream server  http://${HOST}:${PORT}  ws://${HOST}:${PORT}/stream  adapter=${ADAPTER_ID}  auth=${STREAM_TOKEN ? "on" : "off"}  sequences=${sequenceStoreConfig.directory}`,
    );
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
