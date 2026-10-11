import { createServer } from "node:http";
import { describe, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import {
  createStreamClientId,
  ExpressionStreamHub,
  createRobotAdapter,
  StreamPresenceTracker,
  serializeWireMessage,
  type WireServerMessage,
} from "../index.js";

function attachPresenceStream(
  wss: WebSocketServer,
  hub: ExpressionStreamHub,
  tracker: StreamPresenceTracker,
): void {
  const broadcastPresence = (): void => {
    const raw = hub.serialize(tracker.toPresenceMessage());
    for (const socket of wss.clients) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(raw);
      }
    }
  };

  wss.on("connection", (socket) => {
    const clientId = createStreamClientId();
    tracker.register(clientId);
    broadcastPresence();

    const unsub = hub.subscribe((message) => {
      socket.send(hub.serialize(message));
    });

    socket.on("message", (data) => {
      const text = data.toString();
      try {
        const peek = JSON.parse(text) as { type?: string; label?: string };
        if (peek.type === "identify") {
          tracker.setLabel(
            clientId,
            typeof peek.label === "string" ? peek.label : undefined,
          );
          broadcastPresence();
          return;
        }
      } catch {
        // fall through to hub
      }
      void hub.handleRawMessage(text);
    });

    socket.on("close", () => {
      unsub();
      tracker.unregister(clientId);
      broadcastPresence();
    });
  });
}

describe("integration: stream presence", () => {
  it("broadcasts client count to all connected clients", async () => {
    const adapter = createRobotAdapter("mock");
    const hub = new ExpressionStreamHub(adapter);
    await hub.start();
    const tracker = new StreamPresenceTracker();

    const httpServer = createServer();
    const wss = new WebSocketServer({ server: httpServer, path: "/stream" });
    attachPresenceStream(wss, hub, tracker);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = httpServer.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const url = `ws://127.0.0.1:${addr.port}/stream`;

    const waitPresence = (ws: WebSocket, count: number): Promise<void> =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("presence timeout")), 5000);
        const onMessage = (data: WebSocket.RawData): void => {
          const msg = JSON.parse(data.toString()) as WireServerMessage;
          if (msg.type === "presence" && msg.clientCount === count) {
            clearTimeout(timer);
            ws.off("message", onMessage);
            resolve();
          }
        };
        ws.on("message", onMessage);
      });

    const a = new WebSocket(url);
    const waitA1 = waitPresence(a, 1);
    await new Promise<void>((r) => a.once("open", () => r()));
    await waitA1;

    const b = new WebSocket(url);
    const waitA2 = waitPresence(a, 2);
    const waitB2 = waitPresence(b, 2);
    await new Promise<void>((r) => b.once("open", () => r()));
    await Promise.all([waitA2, waitB2]);

    b.send(serializeWireMessage({ type: "identify", label: "partner-b" }));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("label timeout")), 5000);
      a.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as WireServerMessage;
        if (msg.type === "presence" && msg.clients.some((c) => c.label === "partner-b")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    a.close();
    b.close();
    wss.close();
    httpServer.close();
    await hub.stop();
  });
});
