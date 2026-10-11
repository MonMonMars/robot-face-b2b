import type { ExpressionFrame } from "../expressions/frame.js";
import {
  parseHumanoidBridgeFromCredentials,
  sendHumanoidBridgeFrame,
  type HumanoidBridgeConfig,
} from "./humanoid-bridge-client.js";
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
 * **Bridge mode** (`humanoidBridge=1` / `HUMANOID_BRIDGE=1`): sends
 * `robot-face.humanoid-expression.v1` JSON to `humanoidBridgeUrl`.
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
  private bridge: HumanoidBridgeConfig | undefined;

  protected async onConnect(options?: RobotConnectionOptions): Promise<void> {
    const { address, dryRun, extras } = readStubOptions(options);
    this.stubState.address = address;
    this.stubState.dryRun = dryRun;
    this.platform = extras.platform ?? "generic";
    if (extras.frameEndpoint) {
      this.frameEndpoint = extras.frameEndpoint;
    }
    this.bridge = parseHumanoidBridgeFromCredentials(extras);
    this.stubState.log.push(
      `humanoid: connect ${address} platform=${this.platform} dryRun=${dryRun} bridge=${this.bridge ? this.bridge.mode : "off"}`,
    );
  }

  protected async onDisconnect(): Promise<void> {
    this.stubState.log.push("humanoid: disconnected");
  }

  protected async sendFrameToRobot(frame: ExpressionFrame): Promise<void> {
    const body = this.serializeFrameForBridge(frame);

    if (this.stubState.dryRun) {
      logDryRunFrame(this.stubState, "humanoid", frame);
      if (this.bridge) {
        this.stubState.log.push(
          `humanoid:bridge:dry-run → ${this.bridge.mode} ${this.bridge.url}`,
        );
      }
      return;
    }

    if (this.bridge) {
      await sendHumanoidBridgeFrame(this.bridge, this.platform, frame);
      this.stubState.log.push(`humanoid:bridge:sent ${this.bridge.url}`);
      return;
    }

    const url = `${this.stubState.address.replace(/\/$/, "")}${this.frameEndpoint}`;
    await this.postFrameToBridge(url, body);
  }

  serializeFrameForBridge(frame: ExpressionFrame): Record<string, unknown> {
    return {
      schema: "robot-face.humanoid-expression.v1",
      platform: this.platform,
      timestampMs: frame.timestampMs,
      sequenceId: frame.sequenceId,
      blend: frame.blend,
      timing: frame.timing,
    };
  }

  /** Override to perform legacy base-URL POST when bridge flag is off. */
  protected async postFrameToBridge(
    url: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    void url;
    void body;
    throw new Error(
      "HumanoidGenericRobotAdapter: enable HUMANOID_BRIDGE=1 + URL or dryRun",
    );
  }
}
