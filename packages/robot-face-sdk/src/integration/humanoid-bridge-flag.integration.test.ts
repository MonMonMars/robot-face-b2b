import { describe, expect, it } from "vitest";
import {
  configToConnectionOptions,
  createExpressionFrame,
  createRobotAdapter,
  createSinglePrimitiveBlend,
  parseAdapterConfig,
  setHumanoidBridgeTransportForTests,
} from "../index.js";
import type { HumanoidGenericRobotAdapter } from "../adapters/humanoid-generic-adapter.js";

describe("integration: HUMANOID_BRIDGE flag path", () => {
  it("dry-run logs bridge target when bridge enabled", async () => {
    const cfg = parseAdapterConfig({
      adapterId: "humanoid-generic",
      address: "http://10.0.0.5:9840",
      dryRun: true,
      platform: "optimus-class",
    });
    const opts = configToConnectionOptions(cfg);
    opts.credentials = {
      ...(opts.credentials ?? {}),
      humanoidBridge: "1",
      humanoidBridgeUrl: "http://127.0.0.1:9841/v1/expression/frame",
      humanoidBridgeMode: "http",
    };

    setHumanoidBridgeTransportForTests({
      send: async () => {
        throw new Error("no network in dry-run");
      },
    });

    const robot = createRobotAdapter("humanoid-generic") as HumanoidGenericRobotAdapter;
    await robot.connect(opts);
    await robot.setExpression(
      createExpressionFrame(createSinglePrimitiveBlend("neutral", 1)),
    );

    expect(robot.stubState.log.some((l) => l.includes("bridge:dry-run"))).toBe(true);

    setHumanoidBridgeTransportForTests(undefined);
    await robot.disconnect();
  });
});
