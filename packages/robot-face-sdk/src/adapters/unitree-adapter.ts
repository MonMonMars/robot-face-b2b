import type { ExpressionFrame } from "../expressions/frame.js";
import {
  parseUnitreeBridgeFromCredentials,
  sendUnitreeBridgeFrame,
} from "./unitree-bridge-client.js";
import { BaseStreamingRobotAdapter } from "./base-streaming-adapter.js";
import type { RobotConnectionOptions } from "./types.js";
import {
  logDryRunFrame,
  readStubOptions,
  type VendorStubState,
} from "./vendor-stub.js";
import type { UnitreeBridgeConfig } from "./unitree-bridge-client.js";

/**
 * Placeholder for Unitree-class platforms (e.g. G1 humanoid with expression hardware).
 *
 * **Bridge mode** (`unitreeBridge=1` in credentials / `UNITREE_BRIDGE=1` on server):
 * POST/WS JSON payload from {@link mapFrameToUnitreePayload} to `unitreeBridgeUrl`.
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
  private bridge: UnitreeBridgeConfig | undefined;

  protected async onConnect(options?: RobotConnectionOptions): Promise<void> {
    const { address, dryRun, extras } = readStubOptions(options);
    this.stubState.address = address;
    this.stubState.dryRun = dryRun;
    this.model = extras.model ?? "g1";
    this.bridge = parseUnitreeBridgeFromCredentials(extras);
    this.stubState.log.push(
      `unitree: connect ${address} model=${this.model} dryRun=${dryRun} bridge=${this.bridge ? this.bridge.mode : "off"}`,
    );
  }

  protected async onDisconnect(): Promise<void> {
    this.stubState.log.push("unitree: disconnected");
  }

  protected async sendFrameToRobot(frame: ExpressionFrame): Promise<void> {
    const payload = this.mapFrameToUnitreePayload(frame);

    if (this.stubState.dryRun) {
      logDryRunFrame(this.stubState, "unitree", frame);
      if (this.bridge) {
        this.stubState.log.push(
          `unitree:bridge:dry-run → ${this.bridge.mode} ${this.bridge.url}`,
        );
      }
      return;
    }

    if (this.bridge) {
      await sendUnitreeBridgeFrame(this.bridge, this.model, frame);
      this.stubState.log.push(`unitree:bridge:sent ${this.bridge.url}`);
      void payload;
      return;
    }

    void payload;
    throw new Error(
      "UnitreeRobotAdapter: enable UNITREE_BRIDGE=1 + UNITREE_BRIDGE_URL or dryRun",
    );
  }

  /** Maps to documented `robot-face.unitree-expression.v1` JSON (see unitree-bridge-client). */
  mapFrameToUnitreePayload(frame: ExpressionFrame): Record<string, unknown> {
    return {
      schema: "robot-face.unitree-expression.v1",
      model: this.model,
      timestampMs: frame.timestampMs,
      sequenceId: frame.sequenceId,
      weights: frame.blend.weights,
      intensity: frame.blend.intensity,
      durationMs: frame.timing.durationMs,
    };
  }
}
