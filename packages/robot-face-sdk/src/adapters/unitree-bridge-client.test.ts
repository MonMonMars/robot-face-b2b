import { describe, expect, it } from "vitest";
import { createExpressionFrame, createSinglePrimitiveBlend } from "../index.js";
import {
  buildUnitreeBridgePayload,
  sendUnitreeBridgeFrame,
  setUnitreeBridgeTransportForTests,
  type UnitreeBridgeTransport,
} from "./unitree-bridge-client.js";

describe("unitree bridge client", () => {
  it("builds documented v1 payload", () => {
    const frame = createExpressionFrame(createSinglePrimitiveBlend("happiness", 0.8));
    const payload = buildUnitreeBridgePayload("g1", frame);
    expect(payload.schema).toBe("robot-face.unitree-expression.v1");
    expect(payload.model).toBe("g1");
    expect(payload.weights).toBeDefined();
  });

  it("uses injectable transport when bridge flag path runs", async () => {
    const sent: unknown[] = [];
    const transport: UnitreeBridgeTransport = {
      send: async (_config, payload) => {
        sent.push(payload);
      },
    };
    setUnitreeBridgeTransportForTests(transport);
    const frame = createExpressionFrame(createSinglePrimitiveBlend("neutral", 1));
    await sendUnitreeBridgeFrame(
      { url: "http://example.test/frame", mode: "http" },
      "g1",
      frame,
    );
    setUnitreeBridgeTransportForTests(undefined);
    expect(sent).toHaveLength(1);
  });
});
