import { describe, expect, it } from "vitest";
import { createRobotAdapter } from "../adapters/registry.js";
import { getPresetById } from "../expressions/presets.js";
import { ExpressionPlayback } from "../expressions/playback.js";
import type { MockRobotAdapter } from "../adapters/mock-adapter.js";

describe("integration: preset playback on mock adapter", () => {
  it("plays greet-happy preset and updates mock state", async () => {
    const robot = createRobotAdapter("mock") as MockRobotAdapter;
    await robot.connect();

    const preset = getPresetById("greet-happy");
    expect(preset?.sequence).toBeDefined();

    const playback = new ExpressionPlayback();
    const frames: number[] = [];

    await playback.playSequence(preset!.sequence!, robot, {
      onFrame: (f) => frames.push(f.timestampMs),
    });

    await new Promise((r) => setTimeout(r, 750));
    playback.stop();

    expect(robot.state.frameCount).toBeGreaterThan(2);
    expect(frames.length).toBeGreaterThan(2);

    await robot.disconnect();
  }, 10_000);
});

describe("integration: unitree dry-run config path", () => {
  it("connects and accepts frames in dry-run", async () => {
    const { parseAdapterConfig, configToConnectionOptions } = await import(
      "../adapters/config.js"
    );
    const { createRobotAdapter } = await import("../adapters/registry.js");
    const { createExpressionFrame, createSinglePrimitiveBlend } = await import(
      "../index.js"
    );

    const cfg = parseAdapterConfig({
      adapterId: "unitree",
      address: "192.168.1.10",
      dryRun: true,
    });
    const robot = createRobotAdapter("unitree");
    await robot.connect(configToConnectionOptions(cfg));

    await robot.setExpression(
      createExpressionFrame(createSinglePrimitiveBlend("surprise", 0.8)),
    );

    const unitree = robot as import("../adapters/unitree-adapter.js").UnitreeRobotAdapter;
    expect(unitree.stubState.sentFrames.length).toBe(1);
    await robot.disconnect();
  });
});
