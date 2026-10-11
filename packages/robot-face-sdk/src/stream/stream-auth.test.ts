import { describe, expect, it } from "vitest";
import { appendTokenQuery, validateStreamToken } from "./stream-auth.js";

describe("stream auth", () => {
  it("allows all when token unset", () => {
    expect(validateStreamToken({ url: "/stream", headers: {} }, undefined)).toBe(
      true,
    );
  });

  it("accepts query token", () => {
    expect(
      validateStreamToken(
        { url: "/stream?token=secret", headers: {} },
        "secret",
      ),
    ).toBe(true);
  });

  it("accepts bearer header", () => {
    expect(
      validateStreamToken(
        {
          url: "/stream",
          headers: { authorization: "Bearer secret" },
        },
        "secret",
      ),
    ).toBe(true);
  });

  it("rejects wrong token", () => {
    expect(
      validateStreamToken({ url: "/stream?token=wrong", headers: {} }, "secret"),
    ).toBe(false);
  });

  it("appends token to ws url", () => {
    expect(appendTokenQuery("ws://localhost/stream", "abc")).toBe(
      "ws://localhost/stream?token=abc",
    );
  });
});
