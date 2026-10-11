import type { ExpressionFrame } from "../expressions/frame.js";

export type ExpressionStreamListener = (frame: ExpressionFrame) => void;
export type Unsubscribe = () => void;

/**
 * In-process pub/sub channel for realtime expression frames.
 * Can be bridged to WebSocket, ROS2, or vendor SDK topics by adapters.
 */
export class ExpressionStreamChannel {
  private readonly listeners = new Set<ExpressionStreamListener>();
  private lastFrame: ExpressionFrame | undefined;

  subscribe(listener: ExpressionStreamListener): Unsubscribe {
    this.listeners.add(listener);
    if (this.lastFrame) {
      listener(this.lastFrame);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(frame: ExpressionFrame): void {
    this.lastFrame = frame;
    for (const listener of this.listeners) {
      listener(frame);
    }
  }

  getLastFrame(): ExpressionFrame | undefined {
    return this.lastFrame;
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}
