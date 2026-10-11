import { describe, expect, it } from "vitest";
import {
  readStreamServerGuardConfig,
  StreamConnectionGuard,
} from "./stream-server-guards.js";

describe("stream server guards", () => {
  it("reads defaults from env", () => {
    const cfg = readStreamServerGuardConfig({
      STREAM_MAX_CLIENTS: "32",
      STREAM_MIN_MESSAGE_MS: "20",
    });
    expect(cfg.maxClients).toBe(32);
    expect(cfg.minMessageIntervalMs).toBe(20);
  });

  it("enforces max clients", () => {
    const guard = new StreamConnectionGuard({ maxClients: 2, minMessageIntervalMs: 0 });
    expect(guard.canAcceptConnection()).toBe(true);
    guard.registerClient();
    guard.registerClient();
    expect(guard.canAcceptConnection()).toBe(false);
    guard.unregisterClient();
    expect(guard.canAcceptConnection()).toBe(true);
  });

  it("rate limits message interval", () => {
    const guard = new StreamConnectionGuard({ maxClients: 0, minMessageIntervalMs: 100 });
    const now = Date.now();
    expect(guard.checkMessageRate(now - 50)).toBe(false);
    expect(guard.checkMessageRate(now - 150)).toBe(true);
  });
});
