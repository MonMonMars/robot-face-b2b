import { describe, expect, it } from "vitest";
import { createRobotAdapter } from "../adapters/registry.js";
import {
  createExpressionFrame,
  createSinglePrimitiveBlend,
} from "../index.js";
import { ExpressionStreamHub } from "./expression-stream-hub.js";
import type { MockRobotAdapter } from "../adapters/mock-adapter.js";

describe("ExpressionStreamHub", () => {
  it("applies setExpression from wire message to adapter", async () => {
    const adapter = createRobotAdapter("mock") as MockRobotAdapter;
    const hub = new ExpressionStreamHub(adapter);
    await hub.start();

    const frames: unknown[] = [];
    hub.subscribe((msg) => {
      if (msg.type === "frame") frames.push(msg.frame);
    });

    await hub.handleRawMessage(
      JSON.stringify({
        type: "setExpression",
        frame: createExpressionFrame(createSinglePrimitiveBlend("anger", 1)),
      }),
    );

    expect(adapter.state.frameCount).toBeGreaterThanOrEqual(1);
    expect(frames.length).toBeGreaterThanOrEqual(1);

    await hub.stop();
  });

  it("syncs playback progress on pause and seek", async () => {
    const adapter = createRobotAdapter("mock");
    const hub = new ExpressionStreamHub(adapter);
    await hub.start();

    const progress: number[] = [];
    hub.subscribe((msg) => {
      if (msg.type === "playbackProgress") {
        progress.push(msg.progress.localTimeMs);
      }
    });

    await hub.handleClientMessage({
      type: "playSequence",
      sequence: {
        id: "t",
        name: "t",
        keyframes: [
          { atMs: 0, blend: createSinglePrimitiveBlend("neutral", 1) },
          { atMs: 500, blend: createSinglePrimitiveBlend("happiness", 1) },
        ],
      },
    });

    await hub.handleClientMessage({ type: "pausePlayback" });
    await hub.handleClientMessage({ type: "seekPlayback", localTimeMs: 250 });

    expect(progress.length).toBeGreaterThan(0);

    await hub.stop();
  });
});
