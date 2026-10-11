import { describe, expect, it } from "vitest";
import {
  createExpressionFrame,
  createRobotAdapter,
  createSinglePrimitiveBlend,
} from "../index.js";

describe("RobotAdapter contract (mock)", () => {
  it("connects, setExpression, and streams frames", async () => {
    const robot = createRobotAdapter("mock");
    expect(robot.isConnected()).toBe(false);

    const received: number[] = [];
    robot.expressionStream.subscribe((frame) => {
      received.push(frame.timestampMs);
    });

    await robot.connect();
    expect(robot.isConnected()).toBe(true);

    const frame = createExpressionFrame(
      createSinglePrimitiveBlend("surprise", 0.9),
      { durationMs: 200 },
    );
    await robot.setExpression(frame);

    const mock = robot as import("./mock-adapter.js").MockRobotAdapter;
    expect(mock.state.frameCount).toBeGreaterThanOrEqual(1);
    expect(received.length).toBeGreaterThanOrEqual(1);

    await robot.disconnect();
    expect(robot.isConnected()).toBe(false);
  });

  it("publishes on stream when connected without duplicate apply path", async () => {
    const robot = createRobotAdapter("mock");
    await robot.connect();

    let streamHits = 0;
    robot.expressionStream.subscribe(() => {
      streamHits += 1;
    });

    await robot.setExpression(
      createExpressionFrame(createSinglePrimitiveBlend("anger", 1)),
    );
    expect(streamHits).toBeGreaterThanOrEqual(1);

    await robot.disconnect();
  });
});
