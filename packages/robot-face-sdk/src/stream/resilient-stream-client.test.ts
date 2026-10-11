import { describe, expect, it, vi } from "vitest";
import { ResilientStreamClient } from "./resilient-stream-client.js";

describe("ResilientStreamClient", () => {
  it("reports connection state transitions", async () => {
    const states: string[] = [];
    const client = new ResilientStreamClient({
      url: "ws://127.0.0.1:1/not-real",
      autoReconnect: false,
      onConnectionStateChange: (s) => states.push(s),
    });
    await expect(client.connect()).rejects.toThrow();
    expect(states).toContain("connecting");
    client.close();
    expect(client.getConnectionState()).toBe("disconnected");
  });

  it("schedules reconnect with backoff", async () => {
    vi.useFakeTimers();
    const states: string[] = [];
    const client = new ResilientStreamClient({
      url: "ws://127.0.0.1:1/not-real",
      autoReconnect: true,
      maxReconnectAttempts: 2,
      initialBackoffMs: 100,
      onConnectionStateChange: (s) => states.push(s),
    });
    void client.connect().catch(() => undefined);
    await vi.waitFor(() => {
      expect(states).toContain("reconnecting");
    });
    client.close();
    vi.useRealTimers();
  });
});
