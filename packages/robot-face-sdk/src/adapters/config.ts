import type { RobotAdapterId } from "./types.js";

export interface UnitreeAdapterConfig {
  adapterId: "unitree";
  address: string;
  /** e.g. g1, h1 — used when mapping presets to motor groups */
  model?: string;
  streamHz?: number;
  /** When true, stub adapter logs frames instead of throwing on send */
  dryRun?: boolean;
  credentials?: {
    apiKey?: string;
    token?: string;
  };
}

export interface HumanoidGenericAdapterConfig {
  adapterId: "humanoid-generic";
  /** Base URL for on-robot expression bridge */
  address: string;
  platform?: "optimus-class" | "generic";
  streamHz?: number;
  dryRun?: boolean;
  credentials?: {
    bearerToken?: string;
  };
  /** Future: path template e.g. /v1/expression/frame */
  frameEndpoint?: string;
}

export type VendorAdapterConfig = UnitreeAdapterConfig | HumanoidGenericAdapterConfig;

export function parseAdapterConfig(json: unknown): VendorAdapterConfig {
  if (!json || typeof json !== "object") {
    throw new Error("Adapter config must be a JSON object");
  }
  const o = json as Record<string, unknown>;
  const id = o.adapterId;
  if (id === "unitree") {
    if (typeof o.address !== "string" || !o.address) {
      throw new Error("unitree config requires string address");
    }
    return {
      adapterId: "unitree",
      address: o.address,
      model: typeof o.model === "string" ? o.model : undefined,
      streamHz: typeof o.streamHz === "number" ? o.streamHz : undefined,
      dryRun: o.dryRun === true,
      credentials:
        o.credentials && typeof o.credentials === "object"
          ? (o.credentials as UnitreeAdapterConfig["credentials"])
          : undefined,
    };
  }
  if (id === "humanoid-generic") {
    if (typeof o.address !== "string" || !o.address) {
      throw new Error("humanoid-generic config requires string address");
    }
    return {
      adapterId: "humanoid-generic",
      address: o.address,
      platform:
        o.platform === "optimus-class" || o.platform === "generic"
          ? o.platform
          : undefined,
      streamHz: typeof o.streamHz === "number" ? o.streamHz : undefined,
      dryRun: o.dryRun === true,
      frameEndpoint:
        typeof o.frameEndpoint === "string" ? o.frameEndpoint : undefined,
      credentials:
        o.credentials && typeof o.credentials === "object"
          ? (o.credentials as HumanoidGenericAdapterConfig["credentials"])
          : undefined,
    };
  }
  throw new Error(`Unknown adapterId in config: ${String(id)}`);
}

export function configToConnectionOptions(
  config: VendorAdapterConfig,
): import("./types.js").RobotConnectionOptions {
  return {
    address: config.address,
    credentials: flattenCredentials(config),
  };
}

function flattenCredentials(config: VendorAdapterConfig): Record<string, string> {
  const out: Record<string, string> = {
    dryRun: config.dryRun ? "true" : "false",
  };
  const creds = config.credentials;
  if (creds) {
    for (const [k, v] of Object.entries(creds)) {
      if (typeof v === "string") out[k] = v;
    }
  }
  if (config.adapterId === "unitree" && config.model) {
    out.model = config.model;
  }
  if (config.adapterId === "humanoid-generic") {
    if (config.platform) out.platform = config.platform;
    if (config.frameEndpoint) out.frameEndpoint = config.frameEndpoint;
  }
  return out;
}

export function isVendorAdapterId(id: RobotAdapterId): id is "unitree" | "humanoid-generic" {
  return id === "unitree" || id === "humanoid-generic";
}
