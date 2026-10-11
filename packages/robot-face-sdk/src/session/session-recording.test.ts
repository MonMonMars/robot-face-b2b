import { describe, expect, it, vi } from "vitest";
import { createExpressionFrame, createSinglePrimitiveBlend } from "../index.js";
import {
  parseSessionRecording,
  SessionRecorder,
  SessionReplayer,
} from "./session-recording.js";

describe("session recording", () => {
  it("records frames and round-trips JSON", () => {
    const rec = new SessionRecorder();
    rec.start("demo");
    rec.recordFrame(
      createExpressionFrame(createSinglePrimitiveBlend("happiness", 0.8)),
    );
    rec.recordCommand({ type: "stopPlayback" });
    const json = rec.exportJson();
    const parsed = parseSessionRecording(json);
    expect(parsed.label).toBe("demo");
    expect(parsed.events).toHaveLength(2);
  });

  it("replays frames in order", async () => {
    vi.useFakeTimers();
    const recording = parseSessionRecording(
      JSON.stringify({
        version: 1,
        label: "t",
        recordedAt: new Date().toISOString(),
        durationMs: 100,
        events: [
          {
            kind: "frame",
            atMs: 0,
            frame: createExpressionFrame(createSinglePrimitiveBlend("neutral", 1)),
          },
          {
            kind: "frame",
            atMs: 50,
            frame: createExpressionFrame(createSinglePrimitiveBlend("surprise", 1)),
          },
        ],
      }),
    );
    const seen: string[] = [];
    const replayer = new SessionReplayer();
    void replayer.play(recording, {
      onFrame: (f) => {
        const top = Object.entries(f.blend.weights).sort((a, b) => b[1] - a[1])[0][0];
        seen.push(top);
      },
    });
    await vi.runAllTimersAsync();
    expect(seen.length).toBe(2);
    vi.useRealTimers();
  });
});
