import {
  ExpressionStreamClient,
  type ExpressionStreamClientOptions,
  type StreamClientListener,
} from "./ws-client.js";
import type { WireClientMessage, WireServerMessage } from "./wire-protocol.js";

export type StreamConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface ResilientStreamClientOptions extends ExpressionStreamClientOptions {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  onConnectionStateChange?: (state: StreamConnectionState) => void;
}

export class ResilientStreamClient {
  private client: ExpressionStreamClient | null = null;
  private state: StreamConnectionState = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private backoffMs: number;
  private attempts = 0;
  private intentionalClose = false;
  private readonly listeners = new Set<StreamClientListener>();
  private readonly pendingSend: WireClientMessage[] = [];

  constructor(private readonly options: ResilientStreamClientOptions) {
    this.backoffMs = options.initialBackoffMs ?? 1000;
    if (options.onMessage) this.listeners.add(options.onMessage);
  }

  getConnectionState(): StreamConnectionState {
    return this.state;
  }

  private setState(state: StreamConnectionState): void {
    this.state = state;
    this.options.onConnectionStateChange?.(state);
  }

  async connect(): Promise<void> {
    this.intentionalClose = false;
    await this.openOnce();
  }

  private async openOnce(): Promise<void> {
    this.setState(this.attempts > 0 ? "reconnecting" : "connecting");
    this.client?.close();
    this.client = new ExpressionStreamClient({
      url: this.options.url,
      webSocketFactory: this.options.webSocketFactory,
      onOpen: () => {
        this.attempts = 0;
        this.backoffMs = this.options.initialBackoffMs ?? 1000;
        this.setState("connected");
        this.flushPending();
        this.options.onOpen?.();
      },
      onClose: () => {
        this.options.onClose?.();
        if (!this.intentionalClose && this.options.autoReconnect !== false) {
          this.scheduleReconnect();
        } else {
          this.setState("disconnected");
        }
      },
      onError: (err) => this.options.onError?.(err),
      onMessage: (msg) => this.dispatch(msg),
    });
    try {
      await this.client.connect();
    } catch {
      if (!this.intentionalClose && this.options.autoReconnect !== false) {
        this.scheduleReconnect();
        return;
      }
      this.setState("disconnected");
      throw new Error("WebSocket connection failed");
    }
  }

  private scheduleReconnect(): void {
    const max = this.options.maxReconnectAttempts ?? Infinity;
    if (this.attempts >= max) {
      this.setState("disconnected");
      return;
    }
    this.setState("reconnecting");
    this.attempts += 1;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(
      this.backoffMs * 2,
      this.options.maxBackoffMs ?? 30_000,
    );
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      void this.openOnce().catch(() => this.scheduleReconnect());
    }, delay);
  }

  subscribe(listener: StreamClientListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private dispatch(msg: WireServerMessage): void {
    for (const l of this.listeners) l(msg);
  }

  send(message: WireClientMessage): void {
    if (this.client?.isOpen()) {
      this.client.send(message);
      return;
    }
    this.pendingSend.push(message);
  }

  private flushPending(): void {
    if (!this.client?.isOpen()) return;
    while (this.pendingSend.length > 0) {
      const msg = this.pendingSend.shift();
      if (msg) this.client.send(msg);
    }
  }

  close(): void {
    this.intentionalClose = true;
    clearTimeout(this.reconnectTimer);
    this.client?.close();
    this.client = null;
    this.pendingSend.length = 0;
    this.setState("disconnected");
  }

  isOpen(): boolean {
    return this.client?.isOpen() ?? false;
  }
}
