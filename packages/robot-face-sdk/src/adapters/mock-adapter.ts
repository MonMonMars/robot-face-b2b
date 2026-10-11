import type { ExpressionFrame } from "../expressions/frame.js";
import { BaseStreamingRobotAdapter } from "./base-streaming-adapter.js";
import type { RobotConnectionOptions } from "./types.js";

export interface MockRobotState {
  connected: boolean;
  frameCount: number;
  lastFrame?: ExpressionFrame;
  log: string[];
}

/**
 * Software-only adapter for local demos and tests.
 * Records each applied frame and optional debug log lines.
 */
export class MockRobotAdapter extends BaseStreamingRobotAdapter {
  readonly id = "mock" as const;
  readonly capabilities = {
    streaming: true,
    maxStreamHz: 60,
    platformLabel: "Mock Robot (simulator)",
  };

  readonly state: MockRobotState = {
    connected: false,
    frameCount: 0,
    log: [],
  };

  protected async onConnect(options?: RobotConnectionOptions): Promise<void> {
    void options;
    this.state.connected = true;
    this.state.log.push("mock: connected");
  }

  protected async onDisconnect(): Promise<void> {
    this.state.connected = false;
    this.state.log.push("mock: disconnected");
  }

  protected async sendFrameToRobot(frame: ExpressionFrame): Promise<void> {
    this.state.frameCount += 1;
    this.state.lastFrame = frame;
    const dominant = dominantPrimitive(frame);
    this.state.log.push(
      `mock: frame #${this.state.frameCount} → ${dominant} @ ${(frame.blend.intensity * 100).toFixed(0)}%`,
    );
  }
}

function dominantPrimitive(frame: ExpressionFrame): string {
  let best = "neutral";
  let bestW = -1;
  for (const [name, w] of Object.entries(frame.blend.weights)) {
    if (w > bestW) {
      bestW = w;
      best = name;
    }
  }
  return best;
}
