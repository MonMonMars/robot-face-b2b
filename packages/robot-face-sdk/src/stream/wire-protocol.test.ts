import { describe, expect, it } from "vitest";
import { createSinglePrimitiveBlend } from "../expressions/blend.js";
import { createExpressionFrame } from "../expressions/frame.js";
import { exportSequenceJson, importSequenceJson } from "./sequence-io.js";
import { parseWireMessage, serializeWireMessage } from "./wire-protocol.js";

describe("wire protocol", () => {
  it("round-trips setExpression", () => {
    const frame = createExpressionFrame(createSinglePrimitiveBlend("happiness", 0.7), {
      durationMs: 250,
    });
    const raw = serializeWireMessage({ type: "setExpression", frame });
    const msg = parseWireMessage(raw);
    expect(msg.type).toBe("setExpression");
    if (msg.type === "setExpression") {
      expect(msg.frame.blend.weights.happiness).toBeCloseTo(1, 5);
    }
  });

  it("rejects unknown types", () => {
    expect(() => parseWireMessage(JSON.stringify({ type: "nope" }))).toThrow();
  });

  it("parses identify", () => {
    const msg = parseWireMessage(JSON.stringify({ type: "identify", label: "studio" }));
    expect(msg).toEqual({ type: "identify", label: "studio" });
  });
});

describe("sequence io", () => {
  it("exports and imports sequence JSON", () => {
    const json = exportSequenceJson({
      id: "test-seq",
      name: "Test",
      keyframes: [
        {
          atMs: 0,
          blend: createSinglePrimitiveBlend("neutral", 1),
        },
        {
          atMs: 300,
          blend: createSinglePrimitiveBlend("surprise", 0.9),
          holdMs: 100,
        },
      ],
    });
    const seq = importSequenceJson(json);
    expect(seq.keyframes).toHaveLength(2);
    expect(seq.keyframes[1].atMs).toBe(300);
  });
});
