import type { ExpressionFrame } from "../expressions/frame.js";
import { BaseStreamingRobotAdapter } from "./base-streaming-adapter.js";
import type { RobotConnectionOptions } from "./types.js";
import {
  logDryRunFrame,
  readStubOptions,
  type VendorStubState,
} from "./vendor-stub.js";

/**
 * Extension point for Tesla Optimus–class and similar humanoid face/display stacks.
 *
 * **Extension point:** implement {@link postFrameToBridge} (HTTP/WebSocket/gRPC) and disable dry-run.
 *
 * **Assumptions:**
 * - An on-robot or edge bridge exposes HTTP POST `{base}{frameEndpoint}` with JSON body from
 *   {@link serializeFrameForBridge}.
 */
export class HumanoidGenericRobotAdapter extends BaseStreamingRobotAdapter {
  readonly id = "humanoid-generic" as const;
  readonly capabilities = {
    streaming: true,
    maxStreamHz: 24,
    platformLabel: "Humanoid generic (Tesla-class stub)",
  };

  readonly stubState: VendorStubState = {
    address: "",
    dryRun: false,
    sentFrames: [],
    log: [],
  };

  private frameEndpoint = "/v1/expression/frame";
  private platform = "generic";

  protected async onConnect(options?: RobotConnectionOptions): Promise<void> {
    const { address, dryRun, extras } = readStubOptions(options);
    this.stubState.address = address;
    this.stubState.dryRun = dryRun;
    this.platform = extras.platform ?? "generic";
    if (extras.frameEndpoint) {
      this.frameEndpoint = extras.frameEndpoint;
    }
    this.stubState.log.push(
      `humanoid: connect ${address} platform=${this.platform} dryRun=${dryRun}`,
    );
  }

  protected async onDisconnect(): Promise<void> {
    this.stubState.log.push("humanoid: disconnected");
  }

  protected async sendFrameToRobot(frame: ExpressionFrame): Promise<void> {
    if (this.stubState.dryRun) {
      logDryRunFrame(this.stubState, "humanoid", frame);
      return;
    }
    const url = `${this.stubState.address.replace(/\/$/, "")}${this.frameEndpoint}`;
    const body = this.serializeFrameForBridge(frame);
    await this.postFrameToBridge(url, body);
  }

  serializeFrameForBridge(frame: ExpressionFrame): Record<string, unknown> {
    return {
      platform: this.platform,
      timestampMs: frame.timestampMs,
      sequenceId: frame.sequenceId,
      blend: frame.blend,
      timing: frame.timing,
    };
  }

  /** Override to perform real network I/O. */
  protected async postFrameToBridge(
    url: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    void url;
    void body;
    throw new Error(
      "HumanoidGenericRobotAdapter: postFrameToBridge not implemented — use dryRun:true in config",
    );
  }
}
