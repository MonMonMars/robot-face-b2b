import { describe, expect, it } from "vitest";
import { BUILTIN_PRESETS, getPresetById } from "./presets.js";

describe("BUILTIN_PRESETS", () => {
  it("includes demo-oriented sequences", () => {
    const ids = BUILTIN_PRESETS.map((p) => p.id);
    expect(ids).toContain("sales-wave");
    expect(ids).toContain("celebrate");
    expect(ids).toContain("demo-showcase");
    expect(ids.length).toBeGreaterThanOrEqual(10);
  });

  it("resolves presets by id", () => {
    const p = getPresetById("listening-attentive");
    expect(p?.sequence?.loop).toBe(true);
    expect(p?.sequence?.keyframes.length).toBeGreaterThan(1);
  });

  it("every preset has label and description", () => {
    for (const p of BUILTIN_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.blend ?? p.sequence).toBeTruthy();
    }
  });
});
