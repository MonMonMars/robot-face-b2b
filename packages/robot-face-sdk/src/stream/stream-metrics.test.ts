import { describe, expect, it, vi } from "vitest";
import { StreamMetricsCollector } from "./stream-metrics.js";

describe("StreamMetricsCollector", () => {
  it("tracks message totals and rate", () => {
    vi.useFakeTimers();
    const metrics = new StreamMetricsCollector();
    metrics.recordInboundMessage();
    metrics.recordInboundMessage();
    const snap = metrics.snapshot({
      adapter: "mock",
      authEnabled: false,
      activeClients: 1,
      streamClients: 1,
      sequenceStoreDir: "/tmp",
    });
    expect(snap.messagesTotal).toBe(2);
    expect(snap.adapter).toBe("mock");
    vi.advanceTimersByTime(100);
    expect(metrics.messagesPerSecond()).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});
