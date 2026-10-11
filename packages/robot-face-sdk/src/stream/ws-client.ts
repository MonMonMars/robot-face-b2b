import { serializeWireMessage, type WireClientMessage, type WireServerMessage } from "./wire-protocol.js";

export type StreamClientListener = (message: WireServerMessage) => void;

export interface ExpressionStreamClientOptions {
  url: string;
  onMessage?: StreamClientListener;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
  /** Node.js: supply a WebSocket from `ws` or similar instead of globalThis.WebSocket */
  webSocketFactory?: (url: string) => StreamWebSocketLike;
}

export interface StreamWebSocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener?: (type: string, listener: (ev: { data: unknown }) => void) => void;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  OPEN?: number;
}

const OPEN = 1;

/**
 * WebSocket client for the expression stream (browser; pass a custom socket in Node).
 */
export class ExpressionStreamClient {
  private ws: StreamWebSocketLike | null = null;
  private readonly listeners = new Set<StreamClientListener>();

  constructor(private readonly options: ExpressionStreamClientOptions) {
    if (options.onMessage) {
      this.listeners.add(options.onMessage);
    }
  }

  /** Attach an already-constructed WebSocket (e.g. Node `ws` package). */
  attachWebSocket(ws: StreamWebSocketLike): void {
    this.ws = ws;
    const onMessage = (raw: string): void => {
      try {
        const msg = JSON.parse(raw) as WireServerMessage;
        if (msg && typeof msg === "object" && "type" in msg) {
          for (const listener of this.listeners) {
            listener(msg);
          }
        }
      } catch {
        // ignore
      }
    };

    if (typeof ws.addEventListener === "function") {
      ws.addEventListener("message", (ev) => {
        onMessage(typeof ev.data === "string" ? ev.data : String(ev.data));
      });
      ws.addEventListener("open", () => this.options.onOpen?.());
      ws.addEventListener("close", () => this.options.onClose?.());
      ws.addEventListener("error", () =>
        this.options.onError?.(new Error("WebSocket error")),
      );
    } else if (typeof ws.on === "function") {
      ws.on("message", (data: unknown) => onMessage(String(data)));
      ws.on("open", () => this.options.onOpen?.());
      ws.on("close", () => this.options.onClose?.());
      ws.on("error", () => this.options.onError?.(new Error("WebSocket error")));
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.options.webSocketFactory) {
        const ws = this.options.webSocketFactory(this.options.url);
        this.attachWebSocket(ws);
        if (typeof ws.on === "function") {
          ws.on("open", () => resolve());
          ws.on("error", () => reject(new Error("WebSocket connection failed")));
        } else {
          reject(new Error("webSocketFactory must return a socket with .on()"));
        }
        return;
      }
      const WsImpl = globalThis.WebSocket;
      if (!WsImpl) {
        reject(new Error("WebSocket not available — use attachWebSocket() in Node"));
        return;
      }
      const ws = new WsImpl(this.options.url);
      this.attachWebSocket(ws as unknown as StreamWebSocketLike);
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", () => {
        reject(new Error("WebSocket connection failed"));
      });
    });
  }

  subscribe(listener: StreamClientListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(message: WireClientMessage): void {
    if (!this.ws || this.ws.readyState !== (this.ws.OPEN ?? OPEN)) {
      throw new Error("WebSocket is not open");
    }
    this.ws.send(serializeWireMessage(message));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  isOpen(): boolean {
    return this.ws?.readyState === (this.ws?.OPEN ?? OPEN);
  }
}
