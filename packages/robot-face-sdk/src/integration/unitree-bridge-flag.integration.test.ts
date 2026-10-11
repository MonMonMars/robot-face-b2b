import { describe, expect, it } from "vitest";
import {
  configToConnectionOptions,
  createExpressionFrame,
  createRobotAdapter,
  createSinglePrimitiveBlend,
  parseAdapterConfig,
  setUnitreeBridgeTransportForTests,
} from "../index.js";
import type { UnitreeRobotAdapter } from "../adapters/unitree-adapter.js";

describe("integration: UNITREE_BRIDGE flag path", () => {
  it("dry-run logs bridge target when bridge enabled", async () => {
    const cfg = parseAdapterConfig({
      adapterId: "unitree",
      address: "10.0.0.2",
      dryRun: true,
    });
    const opts = configToConnectionOptions(cfg);
    opts.credentials = {
      ...(opts.credentials ?? {}),
      unitreeBridge: "1",
      unitreeBridgeUrl: "http://127.0.0.1:9870/expression/frame",
      unitreeBridgeMode: "http",
    };

    setUnitreeBridgeTransportForTests({
      send: async () => {
        throw new Error("should not call transport in dry-run");
      },
    });

    const robot = createRobotAdapter("unitree") as UnitreeRobotAdapter;
    await robot.connect(opts);
    await robot.setExpression(
      createExpressionFrame(createSinglePrimitiveBlend("surprise", 1)),
    );

    expect(robot.stubState.log.some((l) => l.includes("bridge:dry-run"))).toBe(
      true,
    );

    setUnitreeBridgeTransportForTests(undefined);
    await robot.disconnect();
  });
});
