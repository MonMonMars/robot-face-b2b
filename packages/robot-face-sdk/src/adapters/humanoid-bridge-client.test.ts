import { describe, expect, it } from "vitest";
import { createExpressionFrame, createSinglePrimitiveBlend } from "../index.js";
import {
  buildHumanoidBridgePayload,
  sendHumanoidBridgeFrame,
  setHumanoidBridgeTransportForTests,
} from "./humanoid-bridge-client.js";

describe("humanoid bridge client", () => {
  it("builds documented v1 payload", () => {
    const frame = createExpressionFrame(createSinglePrimitiveBlend("neutral", 1));
    const payload = buildHumanoidBridgePayload("optimus-class", frame);
    expect(payload.schema).toBe("robot-face.humanoid-expression.v1");
    expect(payload.platform).toBe("optimus-class");
  });

  it("uses injectable transport", async () => {
    const sent: unknown[] = [];
    setHumanoidBridgeTransportForTests({
      send: async (_c, payload) => {
        sent.push(payload);
      },
    });
    await sendHumanoidBridgeFrame(
      { url: "http://example.test/h", mode: "http" },
      "generic",
      createExpressionFrame(createSinglePrimitiveBlend("happiness", 1)),
    );
    setHumanoidBridgeTransportForTests(undefined);
    expect(sent).toHaveLength(1);
  });
});
