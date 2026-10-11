import type { IncomingMessage, ServerResponse } from "node:http";
import type { RobotAdapter } from "../adapters/types.js";
import { parseSequence } from "./wire-protocol.js";
import type { SequenceFilesystemStore } from "../sequence/sequence-store.js";
import { validateStreamToken } from "./stream-auth.js";
import type { StreamConnectionGuard, StreamServerGuardConfig } from "./stream-server-guards.js";
import type { StreamMetricsCollector } from "./stream-metrics.js";
import type { StreamPresenceTracker } from "./stream-presence.js";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export interface StreamHttpContext {
  adapter: RobotAdapter;
  adapterId: string;
  streamToken: string | undefined;
  guardConfig: StreamServerGuardConfig;
  connectionGuard: StreamConnectionGuard;
  presenceTracker: StreamPresenceTracker;
  sequenceStore: SequenceFilesystemStore;
  sequenceStoreDir: string;
  metrics: StreamMetricsCollector;
}

export async function handleStreamHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: StreamHttpContext,
): Promise<void> {
  if (!validateStreamToken(req, ctx.streamToken)) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const path = url.pathname;

  if (path === "/" && req.method === "GET") {
    json(res, 200, {
      service: "robot-face-stream",
      adapter: ctx.adapterId,
      connected: ctx.adapter.isConnected(),
      wsPath: "/stream",
      authRequired: Boolean(ctx.streamToken),
      maxClients: ctx.guardConfig.maxClients,
      minMessageIntervalMs: ctx.guardConfig.minMessageIntervalMs,
      activeClients: ctx.connectionGuard.getActiveClients(),
      streamClients: ctx.presenceTracker.snapshot().clientCount,
      sequenceApi: "/sequences",
      metricsPath: "/metrics",
    });
    return;
  }

  if (path === "/metrics" && req.method === "GET") {
    json(
      res,
      200,
      ctx.metrics.snapshot({
        adapter: ctx.adapterId,
        authEnabled: Boolean(ctx.streamToken),
        activeClients: ctx.connectionGuard.getActiveClients(),
        streamClients: ctx.presenceTracker.snapshot().clientCount,
        sequenceStoreDir: ctx.sequenceStoreDir,
      }),
    );
    return;
  }

  if (path === "/sequences" && req.method === "GET") {
    try {
      const sequences = await ctx.sequenceStore.list();
      json(res, 200, { sequences });
    } catch (err: unknown) {
      json(res, 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (path.startsWith("/sequences/")) {
    const id = decodeURIComponent(path.slice("/sequences/".length));
    if (!id) {
      json(res, 400, { error: "Missing sequence id" });
      return;
    }

    if (req.method === "GET") {
      try {
        const sequence = await ctx.sequenceStore.get(id);
        json(res, 200, { sequence });
      } catch {
        json(res, 404, { error: "Sequence not found" });
      }
      return;
    }

    if (req.method === "PUT" || req.method === "POST") {
      try {
        const raw = await readBody(req);
        const sequence = parseSequence(JSON.parse(raw) as unknown);
        const saved = await ctx.sequenceStore.save(id, sequence);
        json(res, 200, { ok: true, entry: saved });
      } catch (err: unknown) {
        json(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    if (req.method === "DELETE") {
      try {
        await ctx.sequenceStore.delete(id);
        json(res, 200, { ok: true });
      } catch {
        json(res, 404, { error: "Sequence not found" });
      }
      return;
    }
  }

  json(res, 404, { error: "Not found" });
}
