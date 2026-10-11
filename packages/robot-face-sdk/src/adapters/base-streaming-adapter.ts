import type { ExpressionFrame } from "../expressions/frame.js";
import { ExpressionStreamChannel } from "../stream/channel.js";
import type {
  RobotAdapter,
  RobotAdapterCapabilities,
  RobotAdapterId,
  RobotConnectionOptions,
} from "./types.js";

/**
 * Base class for adapters that mirror expressionStream publishes to hardware.
 */
export abstract class BaseStreamingRobotAdapter implements RobotAdapter {
  abstract readonly id: RobotAdapterId;
  abstract readonly capabilities: RobotAdapterCapabilities;

  readonly expressionStream = new ExpressionStreamChannel();

  private connected = false;
  private streamUnsub: (() => void) | undefined;
  private lastApplied: ExpressionFrame | undefined;

  async connect(_options?: RobotConnectionOptions): Promise<void> {
    if (this.connected) return;
    this.connected = true;
    this.streamUnsub = this.expressionStream.subscribe((frame) => {
      void this.applyToHardware(frame);
    });
    await this.onConnect(_options);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.streamUnsub?.();
    this.streamUnsub = undefined;
    await this.onDisconnect();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async setExpression(frame: ExpressionFrame): Promise<void> {
    this.expressionStream.publish(frame);
    if (!this.connected) {
      await this.applyToHardware(frame);
    }
  }

  /** Last frame applied (for demos and tests). */
  getLastAppliedFrame(): ExpressionFrame | undefined {
    return this.lastApplied;
  }

  protected async applyToHardware(frame: ExpressionFrame): Promise<void> {
    this.lastApplied = frame;
    if (this.connected) {
      await this.sendFrameToRobot(frame);
    }
  }

  protected abstract onConnect(options?: RobotConnectionOptions): Promise<void>;
  protected abstract onDisconnect(): Promise<void>;
  protected abstract sendFrameToRobot(frame: ExpressionFrame): Promise<void>;
}
