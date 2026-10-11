import { createServer } from "node:http";
import { describe, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { createRobotAdapter, ExpressionStreamHub, validateStreamToken } from "../index.js";

describe("integration: stream auth gate", () => {
  it("rejects WebSocket when token required and missing", async () => {
    const adapter = createRobotAdapter("mock");
    const hub = new ExpressionStreamHub(adapter, { authRequired: true });
    await hub.start();

    const token = "test-secret";
    const httpServer = createServer();
    const wss = new WebSocketServer({ noServer: true });

    httpServer.on("upgrade", (req, socket, head) => {
      if (!validateStreamToken(req, token)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
    });

    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const addr = httpServer.address();
    if (!addr || typeof addr === "string") throw new Error("no port");

    await new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${addr.port}/stream`);
      ws.on("error", () => resolve());
      ws.on("open", () => {
        ws.close();
        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${addr.port}/stream?token=${encodeURIComponent(token)}`,
      );
      ws.on("open", () => {
        ws.close();
        resolve();
      });
      ws.on("error", reject);
    });

    wss.close();
    httpServer.close();
    await hub.stop();
  });
});
