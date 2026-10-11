import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSinglePrimitiveBlend } from "../expressions/blend.js";
import {
  SequenceFilesystemStore,
  validateSequenceStoreId,
} from "./sequence-store.js";

describe("SequenceFilesystemStore", () => {
  it("validates ids", () => {
    expect(() => validateSequenceStoreId("../evil")).toThrow();
    expect(() => validateSequenceStoreId("ok-id_1")).not.toThrow();
  });

  it("saves, lists, loads, and deletes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rf-seq-"));
    const store = new SequenceFilesystemStore({ directory: dir });
    await store.save("demo-wave", {
      id: "demo-wave",
      name: "Demo Wave",
      loop: false,
      keyframes: [
        { atMs: 0, blend: createSinglePrimitiveBlend("neutral", 1) },
      ],
    });
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("Demo Wave");
    const loaded = await store.get("demo-wave");
    expect(loaded.name).toBe("Demo Wave");
    await store.delete("demo-wave");
    expect(await store.list()).toHaveLength(0);
    await rm(dir, { recursive: true, force: true });
  });
});
