import type { ExpressionFrame } from "../expressions/frame.js";
import type { ExpressionStreamChannel } from "../stream/channel.js";

export type RobotAdapterId = "mock" | "unitree" | "humanoid-generic";

export interface RobotAdapterCapabilities {
  /** Supports continuous streaming vs single-shot setExpression only. */
  streaming: boolean;
  /** Max recommended publish rate (Hz). */
  maxStreamHz?: number;
  /** Vendor or platform label for UI. */
  platformLabel: string;
}

export interface RobotConnectionOptions {
  /** Host, serial, or device id — meaning is adapter-specific. */
  address?: string;
  /** Optional API key or token (never logged by SDK). */
  credentials?: Record<string, string>;
  /** Connection timeout in ms. */
  timeoutMs?: number;
}

export interface RobotAdapter {
  readonly id: RobotAdapterId;
  readonly capabilities: RobotAdapterCapabilities;

  connect(options?: RobotConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  /** Apply a single expression frame (may interpolate using timing). */
  setExpression(frame: ExpressionFrame): Promise<void>;

  /**
   * Shared stream for realtime control. Implementations should publish
   * frames received via stream subscription to hardware when connected.
   */
  readonly expressionStream: ExpressionStreamChannel;
}
