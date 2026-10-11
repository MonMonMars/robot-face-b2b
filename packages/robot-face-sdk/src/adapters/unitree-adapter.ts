import type { ExpressionFrame } from "../expressions/frame.js";
import { BaseStreamingRobotAdapter } from "./base-streaming-adapter.js";
import type { RobotConnectionOptions } from "./types.js";
import {
  logDryRunFrame,
  readStubOptions,
  type VendorStubState,
} from "./vendor-stub.js";

/**
 * Placeholder for Unitree-class platforms (e.g. G1 humanoid with expression hardware).
 *
 * **Extension point:** override {@link mapFrameToUnitreePayload} and call your SDK from
 * {@link sendFrameToRobot} when `dryRun` is false.
 *
 * **Assumptions (not verified in this repo):**
 * - Robot reachable at `address` (IP/hostname).
 * - Face actuators accept a normalized weight vector keyed by {@link ExpressionPrimitive}.
 */
export class UnitreeRobotAdapter extends BaseStreamingRobotAdapter {
  readonly id = "unitree" as const;
  readonly capabilities = {
    streaming: true,
    maxStreamHz: 30,
    platformLabel: "Unitree (stub)",
  };

  readonly stubState: VendorStubState = {
    address: "",
    dryRun: false,
    sentFrames: [],
    log: [],
  };

  private model = "g1";

  protected async onConnect(options?: RobotConnectionOptions): Promise<void> {
    const { address, dryRun, extras } = readStubOptions(options);
    this.stubState.address = address;
    this.stubState.dryRun = dryRun;
    this.model = extras.model ?? "g1";
    this.stubState.log.push(`unitree: connect ${address} model=${this.model} dryRun=${dryRun}`);
  }

  protected async onDisconnect(): Promise<void> {
    this.stubState.log.push("unitree: disconnected");
  }

  protected async sendFrameToRobot(frame: ExpressionFrame): Promise<void> {
    if (this.stubState.dryRun) {
      logDryRunFrame(this.stubState, "unitree", frame);
      return;
    }
    const payload = this.mapFrameToUnitreePayload(frame);
    void payload;
    throw new Error(
      "UnitreeRobotAdapter: integrate Unitree SDK — set dryRun:true in config for local testing",
    );
  }

  /** Override in a fork to map SDK motor commands. */
  mapFrameToUnitreePayload(frame: ExpressionFrame): Record<string, unknown> {
    return {
      model: this.model,
      timestampMs: frame.timestampMs,
      weights: frame.blend.weights,
      intensity: frame.blend.intensity,
      durationMs: frame.timing.durationMs,
    };
  }
}
