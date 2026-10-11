import { describe, expect, it } from "vitest";
import {
  configToConnectionOptions,
  parseAdapterConfig,
} from "./config.js";

describe("adapter config", () => {
  it("parses unitree example shape", () => {
    const cfg = parseAdapterConfig({
      adapterId: "unitree",
      address: "10.0.0.1",
      dryRun: true,
      model: "g1",
    });
    expect(cfg.adapterId).toBe("unitree");
    const opts = configToConnectionOptions(cfg);
    expect(opts.address).toBe("10.0.0.1");
    expect(opts.credentials?.dryRun).toBe("true");
    expect(opts.credentials?.model).toBe("g1");
  });
});
