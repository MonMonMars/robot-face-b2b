#!/usr/bin/env node
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  configToConnectionOptions,
  createRobotAdapter,
  ExpressionStreamHub,
  parseAdapterConfig,
  type RobotAdapterId,
} from "@robot-face/sdk";

const PORT = Number(process.env.PORT ?? 8765);
const HOST = process.env.HOST ?? "0.0.0.0";
const ADAPTER_ID = (process.env.ADAPTER ?? "mock") as RobotAdapterId;

function adapterConnectOptions(id: RobotAdapterId) {
  if (id === "mock") return undefined;
  if (id === "unitree") {
    return configToConnectionOptions(
      parseAdapterConfig({
        adapterId: "unitree",
        address: process.env.UNITREE_ADDRESS ?? "127.0.0.1",
        dryRun: true,
        model: process.env.UNITREE_MODEL ?? "g1",
      }),
    );
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
  const hub = new ExpressionStreamHub(adapter);
  await hub.start(adapterConnectOptions(ADAPTER_ID));

  const httpServer = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        service: "robot-face-stream",
        adapter: ADAPTER_ID,
        connected: adapter.isConnected(),
        wsPath: "/stream",
      }),
    );
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/stream" });

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
      }),
    );

    socket.on("message", (data) => {
      void hub.handleRawMessage(data.toString());
    });

    socket.on("close", () => {
      unsub();
    });
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(
      `Robot Face stream server  http://${HOST}:${PORT}  ws://${HOST}:${PORT}/stream  adapter=${ADAPTER_ID}`,
    );
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
