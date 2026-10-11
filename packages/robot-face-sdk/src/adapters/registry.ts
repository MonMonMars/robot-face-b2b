import {
  configToConnectionOptions,
  parseAdapterConfig,
  type VendorAdapterConfig,
} from "./config.js";
import { HumanoidGenericRobotAdapter } from "./humanoid-generic-adapter.js";
import { MockRobotAdapter } from "./mock-adapter.js";
import type { RobotAdapter, RobotAdapterId } from "./types.js";
import { UnitreeRobotAdapter } from "./unitree-adapter.js";

export type RobotAdapterFactory = () => RobotAdapter;

const factories: Record<RobotAdapterId, RobotAdapterFactory> = {
  mock: () => new MockRobotAdapter(),
  unitree: () => new UnitreeRobotAdapter(),
  "humanoid-generic": () => new HumanoidGenericRobotAdapter(),
};

export function createRobotAdapter(id: RobotAdapterId): RobotAdapter {
  const factory = factories[id];
  return factory();
}

export function listRobotAdapterIds(): RobotAdapterId[] {
  return Object.keys(factories) as RobotAdapterId[];
}

export async function connectAdapterFromConfig(
  config: VendorAdapterConfig | unknown,
): Promise<RobotAdapter> {
  const parsed =
    config && typeof config === "object" && "adapterId" in config
      ? (config as VendorAdapterConfig)
      : parseAdapterConfig(config);
  const adapter = createRobotAdapter(parsed.adapterId);
  await adapter.connect(configToConnectionOptions(parsed));
  return adapter;
}

export { parseAdapterConfig, configToConnectionOptions };
