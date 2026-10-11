import { createServer } from "node:http";
import { describe, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import {
  createExpressionFrame,
  createRobotAdapter,
  createSinglePrimitiveBlend,
  ExpressionStreamHub,
} from "../index.js";

describe("integration: WebSocket stream path", () => {
  it("broadcasts frames to connected clients", async () => {
    const adapter = createRobotAdapter("mock");
    const hub = new ExpressionStreamHub(adapter);
    await hub.start();

    const httpServer = createServer();
    const wss = new WebSocketServer({ server: httpServer, path: "/stream" });

    wss.on("connection", (socket) => {
      const unsub = hub.subscribe((message) => {
        socket.send(hub.serialize(message));
      });
      socket.on("message", (data) => {
        void hub.handleRawMessage(data.toString());
      });
      socket.on("close", () => unsub());
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = httpServer.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const url = `ws://127.0.0.1:${addr.port}/stream`;

    const frameReceived = new Promise<void>((resolve) => {
      const ws = new WebSocket(url);
      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "setExpression",
            frame: createExpressionFrame(
              createSinglePrimitiveBlend("happiness", 0.5),
            ),
          }),
        );
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as { type: string };
        if (msg.type === "frame") {
          ws.close();
          resolve();
        }
      });
      ws.on("error", () => resolve());
    });

    await Promise.race([
      frameReceived,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout waiting for frame")), 3000),
      ),
    ]);

    wss.close();
    httpServer.close();
    await hub.stop();
  });
});
