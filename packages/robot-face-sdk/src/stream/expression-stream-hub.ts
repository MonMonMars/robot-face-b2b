import type { RobotAdapter } from "../adapters/types.js";
import { ExpressionPlayback } from "../expressions/playback.js";
import type { Unsubscribe } from "./channel.js";
import {
  parseWireMessage,
  serializeWireMessage,
  type WireClientMessage,
  type WireServerMessage,
} from "./wire-protocol.js";

export type StreamHubListener = (message: WireServerMessage) => void;

/**
 * Adapter-facing hub: applies client wire messages to the robot adapter and
 * broadcasts adapter stream events to subscribers.
 */
export class ExpressionStreamHub {
  private readonly playback = new ExpressionPlayback();
  private streamUnsub: Unsubscribe | undefined;
  private readonly listeners = new Set<StreamHubListener>();

  constructor(private readonly adapter: RobotAdapter) {}

  async start(options?: Parameters<RobotAdapter["connect"]>[0]): Promise<void> {
    if (!this.adapter.isConnected()) {
      await this.adapter.connect(options);
    }
    this.streamUnsub?.();
    this.streamUnsub = this.adapter.expressionStream.subscribe((frame) => {
      this.emit({ type: "frame", frame });
    });
    this.emit({
      type: "hello",
      adapterId: this.adapter.id,
      platformLabel: this.adapter.capabilities.platformLabel,
      connected: this.adapter.isConnected(),
    });
  }

  async stop(): Promise<void> {
    this.playback.stop();
    this.streamUnsub?.();
    this.streamUnsub = undefined;
    if (this.adapter.isConnected()) {
      await this.adapter.disconnect();
    }
  }

  subscribe(listener: StreamHubListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async handleRawMessage(raw: string): Promise<void> {
    try {
      const msg = parseWireMessage(raw);
      await this.handleClientMessage(msg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit({ type: "error", message });
    }
  }

  async handleClientMessage(msg: WireClientMessage): Promise<void> {
    switch (msg.type) {
      case "ping":
        this.emit({ type: "pong" });
        break;
      case "stopPlayback":
        this.playback.stop();
        this.emit({ type: "playbackState", state: this.playback.getState() });
        break;
      case "setExpression":
        await this.adapter.setExpression(msg.frame);
        break;
      case "playSequence":
        this.playback.stop();
        this.emit({ type: "playbackState", state: "playing" });
        await this.playback.playSequence(msg.sequence, this.adapter, {
          loop: msg.loop ?? msg.sequence.loop,
          onFrame: () => {
            this.emit({ type: "playbackState", state: this.playback.getState() });
          },
        });
        this.emit({ type: "playbackState", state: this.playback.getState() });
        break;
      default: {
        const _exhaustive: never = msg;
        throw new Error(`Unhandled message: ${String(_exhaustive)}`);
      }
    }
  }

  emit(message: WireServerMessage): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  serialize(message: WireServerMessage): string {
    return serializeWireMessage(message);
  }

  getAdapter(): RobotAdapter {
    return this.adapter;
  }

  getPlayback(): ExpressionPlayback {
    return this.playback;
  }
}
