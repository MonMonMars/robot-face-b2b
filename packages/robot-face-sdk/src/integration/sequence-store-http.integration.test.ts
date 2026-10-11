import { createServer, type Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRobotAdapter, StreamConnectionGuard, StreamPresenceTracker, readStreamServerGuardConfig } from "../index.js";
import {
  handleStreamHttpRequest,
  SequenceFilesystemStore,
  StreamMetricsCollector,
} from "../server-entry.js";

describe("integration: sequence library HTTP", () => {
  it("lists and saves sequences via HTTP", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rf-seq-http-"));
    const store = new SequenceFilesystemStore({ directory: dir });
    await store.ensureReady();
    const adapter = createRobotAdapter("mock");
    await adapter.connect();

    const guardConfig = readStreamServerGuardConfig({ STREAM_MAX_CLIENTS: "32" });
    const ctx = {
      adapter,
      adapterId: "mock" as const,
      streamToken: undefined,
      guardConfig,
      connectionGuard: new StreamConnectionGuard(guardConfig),
      presenceTracker: new StreamPresenceTracker(),
      sequenceStore: store,
      sequenceStoreDir: dir,
      metrics: new StreamMetricsCollector(),
    };

    const server: Server = createServer((req, res) => {
      void handleStreamHttpRequest(req, res, ctx);
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const base = `http://127.0.0.1:${addr.port}`;

    const putRes = await fetch(`${base}/sequences/demo-lib`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "demo-lib",
        name: "Library Demo",
        loop: false,
        keyframes: [
          {
            atMs: 0,
            blend: {
              weights: {
                neutral: 1,
                happiness: 0,
                surprise: 0,
                anger: 0,
                sadness: 0,
              },
              intensity: 1,
            },
          },
        ],
      }),
    });
    expect(putRes.ok).toBe(true);

    const listRes = await fetch(`${base}/sequences`);
    expect(listRes.ok).toBe(true);
    const listBody = (await listRes.json()) as {
      sequences: { id: string; name: string }[];
    };
    expect(listBody.sequences.some((s) => s.id === "demo-lib")).toBe(true);

    const getRes = await fetch(`${base}/sequences/demo-lib`);
    expect(getRes.ok).toBe(true);
    const getBody = (await getRes.json()) as { sequence: { name: string } };
    expect(getBody.sequence.name).toBe("Library Demo");

    const metricsRes = await fetch(`${base}/metrics`);
    expect(metricsRes.ok).toBe(true);
    const metrics = (await metricsRes.json()) as { adapter: string };
    expect(metrics.adapter).toBe("mock");

    server.close();
    await adapter.disconnect();
    await rm(dir, { recursive: true, force: true });
  });
});
